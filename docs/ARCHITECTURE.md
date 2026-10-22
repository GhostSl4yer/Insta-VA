# Architecture technique — Insta-VA

Document de référence répondant au cahier des charges fonctionnel. Il décrit ce qui est
**réellement implémenté**, ce que les API officielles permettent, et les six points qui
restent à trancher. Tout ce qui est écrit ici correspond au code du dépôt : aucun module
« prévu » n'est présenté comme existant.

---

## 1. Principes d'architecture

| Principe | Mise en œuvre |
|---|---|
| Source centrale unique | Google Drive (dossiers par type de contenu), base SQLite comme index local |
| Aucune donnée simulée en production | `APP_ENV=production` désactive tout générateur de démonstration |
| Autonomie après configuration | Le moteur planifie et exécute la journée sans intervention |
| Traçabilité | Chaque tâche, publication, réponse et anomalie est persistée et horodatée |
| Reprise après arrêt | L'état est en base ; au démarrage le moteur reprend au dernier point sûr |
| Sobriété des dépendances | Node.js + SQLite natif (`node:sqlite`), aucune dépendance de production payante |

Le serveur est un processus Node unique (`src/main.js`) qui embarque :

1. un serveur HTTP (interface + API + webhook + SSE) ;
2. un moteur de tâches en mémoire, alimenté par un plan quotidien persisté ;
3. des clients d'intégration (Instagram Graph, Google Drive) appelés uniquement par le moteur.

Hébergement : Docker/VPS (recommandé, processus permanent), ou Vercel en **mode dégradé**
(voir `docs/PRODUCTION.md` § limites : pas de moteur de fond, pas de SQLite fichier durable).

---

## 2. Cartographie des modules

```
src/
├── main.js                  démarrage : dossiers → base → serveur → moteur
├── config.js                environnement, drapeaux, chemins, paramètres par défaut
├── db.js                    schéma, migrations additives, helpers SQL
├── domaine/                 logique métier (aucune dépendance HTTP)
│   ├── moteur.js            planification, exécution, reprise, boucle
│   ├── cycle.js             journée 16:00 → 00:00, compteurs, clôture
│   ├── drive.js             synchronisation, planification, archivage des contenus
│   ├── publications.js      publication Instagram (conteneur → publication → permalien)
│   ├── commentaires.js      collecte et réponse aux commentaires reçus
│   ├── liens.js             lien de suivi, clics, statistiques de trafic externe
│   ├── interactions.js      réactions entrantes (lecture seule en production)
│   ├── audience.js          pays autorisés, âge minimum (≥ 25 ans)
│   ├── statistiques.js      agrégats, séries, répartition géographique
│   ├── rapports.js          rapports quotidien / hebdomadaire / fin de cycle (Markdown)
│   ├── anomalies.js         détection et cycle de vie des anomalies
│   ├── journal.js           événements, notifications
│   └── configuration.js     état de mise en service (6 étapes)
├── services/                clients externes (I/O uniquement)
│   ├── instagram-graph.js   Graph API : médias, insights, conteneurs
│   ├── commentaires.js      Graph API : lecture / réponse aux commentaires
│   └── drive-google.js      Drive v3 : liste, téléchargement, déplacement (OAuth 2.0)
├── http/                    serveur, routeur, auth, pages, API, SSE
└── donnees/                 banques de textes, personas, réponses FR/EN
public/                      interface (vanilla JS, 15 écrans, charte papier/encre)
scripts/                     sauvegarde, empreinte de mot de passe
tests/                       tests unitaires et d'intégration (node --test)
```

Règle de dépendance : `http → domaine → services → db/config`. Un module de domaine ne
connaît jamais la couche HTTP ; un service ne contient aucune règle métier.

---

## 3. Modèle de données

22 tables, toutes créées de façon idempotente (`CREATE TABLE IF NOT EXISTS`) et complétées
par `migrer()` pour les colonnes ajoutées après coup (migration additive, sans perte).

| Domaine | Tables | Rôle |
|---|---|---|
| Compte & configuration | `meta`, `agent`, `compte_instagram`, `parametres_audience` | identité, réglages, pays autorisés, âge plancher |
| Cycle | `cycle`, `session_quotidienne`, `execution` | journée, sessions de veille, avancement des étapes |
| Contenus | `contenu_drive`, `publication` | fichiers indexés, planification, publication |
| Audience | `interaction`, `compte_suivi`, `abonnement`, `cible`, `veille` | réactions, cibles scorées, abonnements |
| Mesure | `statistiques`, `rapport`, `lien_suivi`, `clic_lien` | indicateurs, rapports, trafic externe |
| Pilotage | `journal_evenement`, `anomalie`, `notification` | traçabilité et alertes |
| Réponses | `reponse_commentaire` | commentaires reçus et réponses publiées |

Colonnes clés ajoutées pour Drive/Graph :

- `contenu_drive.drive_file_id`, `contenu_drive.drive_dossier_id` — rattachement au fichier réel ;
- `publication.media_id_externe` — identifiant du média Instagram (indispensable pour lire les commentaires) ;
- `compte_instagram.lien_suivi_actif` — lien court recommandé en bio ;
- `lien_suivi`, `clic_lien`, `reponse_commentaire` — nouvelles tables (voir § 7 et § 8).

---

## 4. Machine à états

### 4.1 Tâche d'exécution (`execution.statut`)

```
Planifie ──► EnCours ──► Effectue
   │            │
   │            ├──► Echec ──► (reprise le jour même) ──► EnCours
   │            ├──► Reporte ──► EnCours (créneau suivant)
   │            └──► Suspendu (restriction / anomalie critique)
   └──► Ignore (créneau dépassé, condition non remplie)
```

Invariants :

- une tâche ne passe **jamais** de `Echec` à `Effectue` sans nouvelle tentative réelle ;
- `Effectue` n'est écrit qu'après confirmation de l'effet (réponse API ou écriture locale) ;
- l'heure d'exécution (`execution.heure`) sert de curseur de reprise.

### 4.2 Publication (`publication.statut`)

```
Planifiee ──► EnCours ──► Publiee
                 └──────► Echec ──► (nouvelle tentative) EnCours
Publiee ──► Supprimee (retrait manuel, jamais automatique)
```

### 4.3 Contenu Drive (`contenu_drive.statut`)

```
Telecharge ──► Planifie ──► Publie ──► Archive
                  └────────► Echec (fichier conservé, réessayé)
```

« Retirer du dossier à publier » = **déplacement** du fichier vers `dossierArchive`
(`deplacerFichier`), jamais une suppression définitive. En cas d'échec de publication, le
fichier reste dans son dossier d'origine.

### 4.4 Réponse à un commentaire (`reponse_commentaire.statut`)

```
ARepondre ──► Repondu
     └──────► Echec ──► (reprise manuelle ou cycle suivant) ARepondre
```

Un commentaire est identifié par `commentaire_id` (unique) : aucun doublon, aucun double
envoi, même après redémarrage.

### 4.5 Cycle (`cycle.statut`)

```
EnCours ──► Termine         (clôture normale à 00:00)
   └─────► Interrompu       (arrêt serveur constaté un jour ultérieur — non rejoué)
   └─────► EnPause          (pause manuelle)
```

---

## 5. Cycle quotidien (16:00 → 00:00)

| Heure | Étape | Nature |
|---|---|---|
| 16:00 | Initialisation du compte | session, contrôles |
| 16:05 | Préparation de la journée | planification des contenus |
| 16:10 | Publication (16h → 00h) | conteneur → publication → permalien |
| 16:20 | Réponses aux commentaires | collecte + réponse (toutes les 20 min) |
| 16:35 | Visionnage (≥ 30 min) | suivi de session |
| 23:40 | Dernière collecte de commentaires | — |
| 23:54 | Contrôle des commentaires en attente | alerte si > 24 h |
| 23:56 | Rapport quotidien | fichier Markdown |
| 23:58 | Clôture de la journée | statistiques, cycle |

Quotas appliqués : Story 3/jour, Reel 2/jour, UnePleine lundi/mercredi/vendredi,
PhotoProfil une seule fois. Heures de publication : Story 16:40 / 19:00 / 21:20,
Reel 17:20 / 21:40, UnePleine 19:40.

---

## 6. Reprise après arrêt

Au démarrage, `demarrerMoteur()` lit le dernier `cycle` :

| Situation | Comportement |
|---|---|
| Journée interrompue **le jour même** | reprise de la journée au dernier créneau non exécuté |
| Journée interrompue **un jour antérieur** | clôture `Interrompu`, **pas de rejeu** (évite une rafale de publications) ; notification + anomalie + journal |
| Aucun cycle | démarrage au jour `jourConfiguration + 1` (le jour 1 est la configuration manuelle) |
| Jour 31 | nouveau cycle, numéro incrémenté, jour 1 |

Le choix « ne pas rejouer » est délibéré : republier plusieurs stories et reels d'un coup
après une panne est le risque le plus élevé pour le compte. Il est signalé, jamais silencieux.

---

## 7. Lien de suivi et clics

Instagram n'expose pas les clics sur le lien de la bio. Le système fournit donc une
redirection mesurée :

1. `POST /api/liens` crée un code court (`/l/:code`, alphabet sans ambiguïté, 7 caractères) ;
2. la page publique `GET /l/:code` enregistre le clic (jour, pays déduit de l'en-tête de
   langue, référent tronqué) puis répond `302` vers la destination réelle, `Cache-Control: no-store` ;
3. aucune adresse IP, aucun identifiant, aucun cookie n'est stocké ;
4. un lien désactivé ne compte plus de clic (`404`).

Indicateurs exposés : clics du jour, 7 jours, 30 jours, moyenne/jour, répartition par pays,
répartition par lien. Ils alimentent le tableau de bord, l'écran « Lien & commentaires »,
les statistiques et les rapports (`Clics sur le lien` dans le tableau des indicateurs).

---

## 8. Intégrations réellement disponibles

| Capacité | Statut | Détail technique |
|---|---|---|
| Publier un média (photo, story, reel, carrousel) | ✅ | Graph `media` + `media_publish` |
| Lire les insights d'un média | ✅ | `insights` (portée, vues, likes, commentaires, partages) |
| Lire les commentaires de ses médias | ✅ | `GET /{media-id}/comments` |
| Répondre publiquement à un commentaire | ✅ | `POST /{comment-id}/replies` |
| Masquer un commentaire | ✅ | `hide` |
| Liker un média tiers | ❌ | Non exposé par l'API (et contraire aux CGU) |
| S'abonner / se désabonner | ❌ | Non exposé |
| Visionner automatiquement | ❌ | Non exposé |
| Messages privés | ❌ | Hors périmètre (exigence explicite) |
| Clics sur le lien de la bio | ⚠️ indirect | redirection mesurée `/l/:code` |
| Liste des fichiers Drive | ✅ | Drive v3 `files.list` + OAuth refresh token |
| Télécharger un fichier | ✅ | `files.get?alt=media` (200 Mo max) |
| Déplacer vers l'archive | ✅ | `files.update` (`addParents` / `removeParents`) |

Conséquence assumée : les likes, suivis et visionnages **ne sont pas automatisés**. Ils
existent dans le modèle (diagramme de classes) et dans l'interface de démonstration, mais
la production ne les exécute pas et l'interface l'indique.

---

## 9. Sécurité et exploitation

- Sessions signées HMAC, mot de passe haché scrypt ; cookies `HttpOnly`, `SameSite=Lax`, `Secure` derrière HTTPS.
- Identifiants Graph et Drive lus dans l'environnement ; le mot de passe Instagram est chiffré (AES-256-GCM) et jamais utilisé pour se connecter.
- Interface en français, design papier/encre, sans ressource externe (aucun CDN, aucune police distante).
- Sauvegarde : `npm run sauvegarde` (base + arborescence Drive locale + rapports + clé).
- Sonde `GET /healthz` (publique) pour Docker/VPS.

---

## 10. Les six points à trancher

| # | Question | Recommandation | Impact si non tranché |
|---|---|---|---|
| 1 | **Accès Instagram** — compte professionnel lié à une page Facebook, app Meta validée ? | Créer l'app en *Instagram Basic Display → Graph* avec le rôle `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights` | sans identifiants, le moteur fonctionne en local (planification, rapports) mais ne publie rien |
| 2 | **Déclenchement du cycle** — heure et fuseau, jour 1 | 16:00 dans le fuseau du compte (`INSTAVA_FUSEAU`, défaut `Africa/Porto-Novo`), jour 1 = configuration | un fuseau erroné décale toutes les publications |
| 3 | **Structure Drive** — noms et arborescence des dossiers | `Reels/`, `Stories/`, `UnePleine/`, `PhotoProfil/`, `Archive/` à la racine d'un dossier partagé au compte de service | le moteur ne trouve aucun fichier |
| 4 | **Comportement au redémarrage** — rejouer ou non la journée manquée | ne pas rejouer (voir § 6), clôturer `Interrompu` et alerter | rejeu = rafale de publications, risque de restriction |
| 5 | **Liste complète des pays + emplacement du paramètre d'âge** | pays saisis dans `parametres_audience` (écran Paramètres / mise en service) ; âge plancher global 25 ans | le ciblage affiché doit correspondre à ce qui est enregistré (règle R7/R9) |
| 6 | **Moyen de supervision** | notification interne + `GET /healthz` + journal ; option e-mail/webhook à brancher | sans supervision, une panne reste invisible au-delà de la notification dans l'interface |

Chaque décision est appliquée par configuration, pas par modification de code, sauf le
point 1 (identifiants) et le point 6 (canal externe, à intégrer si retenu).

---

## 11. Écarts assumés et limites connues

1. **Like / follow / visionnage** : impossibles via l'API officielle ; jamais automatisés.
2. **Limite de ~50 abonnements/jour** : affichée comme recommandation, **jamais** transformée en quota exécuté.
3. **DM** : hors périmètre, aucune route, aucun service.
4. **Vercel** : le moteur de fond, SQLite fichier et SSE ne fonctionnent pas en serverless ; Vercel n'héberge que l'interface et les routes de lecture (voir `docs/PRODUCTION.md`).
5. **Synchronisation Drive** : limitée aux types connus et aux fichiers ≤ 200 Mo ; les autres sont ignorés et journalisés.
6. **Réponses aux commentaires** : banque de textes FR/EN personnalisable via `data/reponses.json` ; le texte est choisi de façon déterministe (aucune génération à la volée).
