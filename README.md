# Insta-VA — le bot Instagram de l’avatar IA, 100 % autonome

> Orchestrateur web autonome pour le compte Instagram d’un avatar IA.
> Cycle de **30 jours**, journées **16 h → 00 h** en deux sessions, publications planifiées,
> visionnage, interactions ciblées, statistiques et rapports — sans intervention humaine.

Ce dépôt implémente **les deux diagrammes fournis** (diagramme de classes et diagramme de cas
d’utilisation) sous la forme d’une application web complète : un moteur autonome côté serveur,
une console de pilotage dans le navigateur, un Drive de contenus, et une base SQLite locale.

**Console** — 14 écrans : tableau de bord temps réel, cycle & journées, programme 30 jours,
Drive, publications, cibles scorées, interactions, abonnements, statistiques, rapports, journal,
anomalies, architecture et paramètres.

| | |
|---|---|
| **Stack** | Node.js ≥ 22.5, `node:sqlite`, HTTP natif — **0 dépendance npm, 0 build** |
| **Autonomie** | moteur par tick, cycle 30 j relancé automatiquement, rapports quotidiens |
| **Conformité** | âge ≥ 25 ans, pays autorisés, fenêtre 16 h → 00 h, aucun message privé |
| **Tests** | `npm test` — 18 tests (`node:test`), domaine + intégration moteur |

---

## 1. Démarrage rapide

Prérequis : **Node.js ≥ 22.5** (module `node:sqlite` intégré). Aucune dépendance npm, aucun build.

```bash
npm start
# ▶ Interface : http://localhost:3000
```

Au premier lancement, l’application :

1. crée le compte Instagram de l’avatar (`@maya.rivera.fit`), l’agent responsable et les paramètres d’audience ;
2. génère un Drive complet (visuels SVG + légendes) ;
3. simule **6 journées d’historique** pour que les statistiques et les rapports soient immédiatement lisibles ;
4. démarre le moteur sur la journée en cours, à 16 h virtuelle.

```bash
npm run dev      # rechargement automatique (--watch)
npm test         # 18 tests (moteur, règles, publications, rapports…)
npm run reset    # remet le cycle à zéro (conserve le profil et le Drive)
npm run reset -- --effacer   # supprime toutes les données locales
```

### Configuration

Copiez `.env.example` vers `.env` pour ajuster :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Écoute du serveur |
| `DATA_DIR` | `data` | Base SQLite, Drive, rapports |
| `IG_TIMEZONE` | `America/New_York` | Fuseau du compte (fenêtre 16 h → 00 h) |
| `VITESSE_DEFAUT` | `6` | Minutes simulées par seconde (1 = rythme réel) |
| `AMORCAGE_JOURS` | `6` | Jours d’historique générés au premier démarrage |
| `PAUSE_INTERJOUR_MS` | `2200` | Pause entre deux journées |
| `INSTAGRAM_MODE` | `simulation` | `simulation` (autonome) ou `graph` (API officielle) |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | — | Identifiants Graph (mode `graph`) |
| `URL_PUBLIQUE` | — | URL HTTPS publique servant les médias (mode `graph`) |
| `RAPPORT_WEBHOOK_URL` | — | Transmission des rapports au responsable |

---

## 2. Ce que fait le bot, tout seul

| Étape du diagramme d’activité | Implémentation |
|---|---|
| 1. Gestion du compte (manuel, une seule fois) | Écran **Paramètres** : profil, bio, lien, âge minimum, mot de passe chiffré AES-256-GCM |
| 2. Gestion du cycle et planification | Moteur : journée 16 h → 00 h, 2 sessions, compteur de jours, relance à J+30 |
| 3. Gestion des contenus (Drive) | Génération quotidienne de 3 stories + 1 Reel (+ 1 Une 3×/semaine, 2e Reel 2×/semaine) et import de médias |
| 4. Publication (à partir du jour 2) | Planification à 16 h 40, 17 h 20, 19 h, 19 h 40, 21 h 10, 21 h 40 — **jamais hors fenêtre** |
| 5. Interactions | Likes, commentaires contextualisés (langue de la cible), suivis de comptes qualifiés — **jamais de DM** |
| 6. Suivi & statistiques | Agrégats quotidiens, répartition par pays, top publications, alertes d’écart |
| 7. Cycle mensuel | Bilan à J30, archivage, relance automatique (même compte, même historique) |
| 8. Gestion des erreurs & sécurité | Détection d’anomalies, notification du responsable, suspension et reprise du moteur |

**Règles du système (R1 → R10)** vérifiées à chaque action : fenêtre horaire, âge minimum 25 ans,
pays autorisés, aucun message privé, publication planifiée, proportion de comptes de référence,
relance automatique. Voir l’écran **Programme 30 jours**.

### Une journée type (heures virtuelles)

| Heure | Action |
|---|---|
| 16:00 | Ouverture de la session 1, initialisation du compte, préparation du Drive |
| 16:25 → 23:45 | Lots d’interactions toutes les 9 minutes (2 à 5 actions) |
| 16:36 → 23:30 | Visionnage par paliers (objectif ≥ 30 min) |
| 16:40 / 19:00 / 21:20 | Stories publiées |
| 17:20 / 21:40 | Reels publiés |
| 19:40 | Publication « une » (lundi, mercredi, vendredi) |
| 23:52 | Calcul des statistiques |
| 23:56 | Génération du rapport quotidien (+ hebdo le 7e jour) |
| 23:59 → 00:00 | Clôture, archivage, relance du jour suivant après une courte pause |

---

## 3. Correspondance avec le diagramme de classes

| Classe du diagramme | Module | Points clés |
|---|---|---|
| `Agent` | `src/domaine/agent.js` | Profil du responsable, rôles, configuration |
| `CompteInstagram` | `src/domaine/compte.js` | Configuration manuelle, mot de passe chiffré, cycle actuel |
| `ParametresAudience` | `src/domaine/audience.js` | `appliquer()`, `verifierDisponibilite()`, `sauvegarder()` |
| `Cycle` | `src/domaine/moteur.js` | `demarrer()`, `terminer()`, `relancer()`, `calculerProchainJour()` |
| `SessionQuotidienne` | `src/domaine/moteur.js` | 16–20 h / 20–00 h, `verifierDureeVisionnage()` |
| `ContenuDrive` | `src/domaine/drive.js` | `telecharger()`, `supprimer()`, `archiver()`, `synchroniser()` |
| `Publication` | `src/domaine/publications.js` | `publier()`, `verifierStatut()`, `supprimer()` |
| `Interaction` | `src/domaine/interactions.js` | `ajouterLike()`, `commenter()`, `visionnerVideo()`, `suivreCompte()` |
| `CompteSuivi` / `Abonnement` | `src/domaine/cibles.js`, `interactions.js` | `suivre()`, `verifierStatut()` |
| `Statistiques` | `src/domaine/statistiques.js` | `analyser()`, `genererRapport()`, séries et agrégats |
| `Rapport` | `src/domaine/rapports.js` | `generer()`, `exporter()`, `envoyer()` |
| Énumérations | `public/shared/enums.js` | Source unique partagée serveur ↔ navigateur |

**Extensions assumées au-delà des diagrammes** (documentées dans l’écran *Architecture*) :

- **Cibles scorées** : le diagramme ne dit pas *comment* choisir les comptes à suivre → scoring
  pays / âge / intérêts / taille / croissance, puis filtrage.
- **Veille éditoriale** : formats, audios et sujets pour éviter la répétition.
- **Journal & anomalies** : l’étape « détecter une anomalie » devient une boucle complète.
- **Moteur de simulation** : l’API Instagram ne permettant pas de liker/commenter automatiquement,
  ces actions sont simulées de façon déterministe, comptabilisées et tracées.

### Écrans de la console

| Écran | Cas d’utilisation couverts |
|---|---|
| **Tableau de bord** | Vue temps réel, chronologie du jour, flux, alertes, mission |
| **Cycle & journées** | Cycle, sessions, historique, clôture/réinitialisation |
| **Programme 30 jours** | Règles R1–R10, jalons, calendrier, relance |
| **Drive** | Téléchargement, import, archivage, suppression, synchronisation |
| **Publications** | Planning, publication, retrait, vérification de statut |
| **Cibles scorées** | Analyse, scoring, rejet hors zone, suivi |
| **Interactions** | Likes, commentaires, visionnages, suivis, filtrage par pays |
| **Abonnements** | Comptes suivis, comptes de référence, conformité R6 |
| **Statistiques** | Portée, vues, engagement, abonnés, pays, top contenus |
| **Rapports** | Génération, lecture, export Markdown, transmission |
| **Journal / Anomalies** | Traçabilité, détection, résolution |
| **Architecture / Paramètres** | Mapping diagramme → code, configuration, contrôle |

---

## 4. API HTTP (extraits)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/etat` | État complet et temps réel de l’application |
| `GET` | `/api/stream` | Flux SSE (mise à jour de l’interface toutes les 1,5 s) |
| `POST` | `/api/controle/demarrer` · `pause` · `reprendre` · `arreter` | Pilotage du moteur |
| `POST` | `/api/controle/vitesse` · `avancer` · `fin-jour` | Horloge virtuelle |
| `PUT` | `/api/compte` | Configuration manuelle du profil (R1) |
| `POST` | `/api/compte/reinitialiser-cycle` · `archiver` | Gestion du cycle et des données |
| `GET/PUT` | `/api/audience` | Paramètres d’audience (pays, âge, genre) |
| `GET` | `/api/cycles`, `/api/cycles/:id` | Cycles, sessions, publications, exécution |
| `GET` | `/api/contenus?type=&theme=&statut=&recherche=` | Drive de contenus |
| `POST` | `/api/contenus/upload` · `synchroniser` | Import de médias |
| `GET` | `/api/publications?jour=&statut=&type=` | Planning et historique |
| `POST` | `/api/publications/:id/publier` | Publication manuelle |
| `GET` | `/api/cibles?statut=&pays=&recherche=` | Cibles scorées |
| `POST` | `/api/cibles/:id/analyser` · `suivre` | Analyse et suivi |
| `GET` | `/api/interactions?type=&sens=&pays=&date=` | Journal des interactions |
| `GET` | `/api/statistiques?periode=jour\|semaine\|mois` | Indicateurs, séries, pays, top |
| `GET` | `/api/rapports`, `/api/rapports/:id` | Rapports et contenu Markdown |
| `POST` | `/api/rapports/generer` · `:id/envoyer` | Génération et transmission |
| `GET` | `/api/journal`, `/api/anomalies`, `/api/veille` | Traçabilité et sécurité |
| `GET` | `/api/export` | Export JSON complet (archive) |
| `GET` | `/api/diagramme` | Classes, relations, énumérations, règles, flux |

Toutes les actions sensibles sont validées côté serveur : âge minimum, pays autorisés, fenêtre
horaire, plafonds anti-spam. Le serveur ne fait jamais confiance à l’interface.

---

## 5. Drive, visuels et rapports

- Chaque publication possède un **visuel réel**, généré en SVG (1080 × 1920 pour Reels/Stories,
  1080 × 1350 pour les Unes, 420 × 420 pour le profil) : dégradés, carte de points clés,
  pied de page `@maya.rivera.fit`, format lisible et léger (< 10 Ko).
- Les légendes sont **contextuelles** : accroche, corps, appel à l’action, lien de l’avatar,
  hashtags par thème, musique simulée.
- Les rapports sont écrits en **Markdown** dans `data/rapports/` et exportables depuis l’interface.
- L’export JSON (`/api/export`) contient compte, cycles, publications, interactions, cibles,
  abonnements, rapports, journal et anomalies.

Organisation des données :

```
data/
├── insta-va.sqlite          # base SQLite (WAL)
├── .cle                     # clé de chiffrement locale (0600)
├── drive/
│   ├── reels/  stories/  livre/  photos/  telecharges/
└── rapports/                # rapports Markdown
```

---

## 6. Mode Instagram Graph (optionnel)

Le mode `simulation` est le mode par défaut : **aucune connexion à Instagram**, tout est exécuté
et comptabilisé localement. Il permet de faire tourner le cycle complet sans identifiants.

Le mode `graph` publie réellement via l’API Instagram Graph (`INSTAGRAM_MODE=graph`,
`IG_USER_ID`, `IG_ACCESS_TOKEN`, médias servis en HTTPS via `URL_PUBLIQUE`). Il nécessite un
compte professionnel et une application Meta validée.

> ⚠️ **Limites de l’API officielle** : Instagram ne fournit pas d’endpoint public pour liker,
> commenter ou s’abonner automatiquement. Ces actions restent donc simulées et tracées, même en
> mode `graph`. Le bot **n’utilise aucun contournement** de l’API (pas de mot de passe, pas
> d’automatisation de l’application mobile) : cela protège le compte et respecte les conditions
> d’utilisation. Les statistiques proviennent de l’API quand elle est disponible, sinon du moteur.

---

## 7. Architecture technique

```
src/
├── main.js                  # démarrage (moteur + serveur)
├── config.js                # configuration & .env
├── db.js                    # SQLite (node:sqlite), schéma, helpers
├── http/
│   ├── serveur.js           # routage HTTP, SSE, fichiers statiques et médias
│   └── api.js               # ~45 routes REST
├── domaine/
│   ├── moteur.js            # horloge, plan de journée, exécution, cycle 30 jours
│   ├── compte.js · agent.js · audience.js · cibles.js
│   ├── drive.js · visuels.js · publications.js · interactions.js
│   ├── statistiques.js · rapports.js · veille.js
│   ├── journal.js · anomalies.js · chiffrement.js
├── donnees/                 # personas, concepts éditoriaux, commentaires, diagramme
├── services/instagram.js    # passerelle simulation / Graph
└── utils/                   # temps, aléa déterministe, texte, HTTP
public/
├── index.html · styles.css · app.js   # shell, routeur, SSE
├── lib/ui.js                # graphiques SVG, markdown, modale, toasts
└── views/                   # 14 vues (pilotage, cycle, drive, cibles, …)
tests/                       # 18 tests node:test
scripts/reset.js
```

Choix techniques :

- **zéro dépendance** : `node:sqlite`, `node:http`, `Intl` suffisent (démarrage instantané, surface d’attaque minimale) ;
- **horloge virtuelle** : la simulation est accélérée (6 min/s par défaut, soit 80 s par journée) et pilotable ;
- **aléa déterministe** (mulberry32) : mêmes journées → mêmes chiffres, donc des tests reproductibles ;
- **un seul écrivain** : chaque tick est sérialisé (`enExecution`), les écritures sont transactionnelles ;
- **source d’énumérations partagée** entre serveur et navigateur (`public/shared/enums.js`).

---

## 8. Tests

```bash
npm test
```

Couverture fonctionnelle : conversions temporelles, chiffrement, configuration du compte,
filtrage d’audience (âge/pays), génération et scoring des cibles, Drive et idempotence,
planification dans la fenêtre horaire, publication, règles d’interaction, statistiques,
rapports, cycle complet, pause/reprise, relance à J+30, vue publique consommée par l’interface.

---

## 9. Sécurité du déploiement

L’application n’embarque pas d’authentification : elle est pensée pour un usage local ou derrière
un reverse proxy protégé (Basic Auth, SSO, réseau privé). Les identifiants éventuels sont chiffrés
sur disque, la clé est stockée avec des permissions `0600`, et toutes les entrées sont validées
côté serveur (forme des paramètres, tailles, chemins de fichiers).

## 10. Limites & conformité

- Ce projet est une **démonstration d’orchestration** : il ne contourne pas les protections
  d’Instagram et n’automatise pas l’application mobile.
- Aucun message privé n’est envoyé, aucune cible de moins de 25 ans ou hors zone n’est traitée.
- Les comptes, contenus, marques, audios et chiffres sont **fictifs**, générés localement.
- Le mot de passe éventuellement saisi est chiffré localement et n’est **jamais utilisé** pour
  se connecter : il illustre l’attribut `motDePasse` du diagramme de classes.

## 11. Licence

MIT — voir `LICENSE`.
