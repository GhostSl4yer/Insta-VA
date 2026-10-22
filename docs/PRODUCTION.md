# Mise en production

Ce guide décrit la version **production** : celle où **les données sont fournies** par le
responsable, où aucune donnée de démonstration n'est créée, et où la console est protégée par
mot de passe.

---

## 1. Ce qui change par rapport à la démonstration

| Sujet | Développement | Production |
|---|---|---|
| Compte Instagram | avatar de démonstration créé d'office | **fourni** dans la console |
| Historique | 6 journées simulées au démarrage | **aucun** historique fabriqué |
| Visuels | SVG générés localement | **médias importés** par le responsable |
| Photo de profil | générée | **fournie** |
| Cibles | 170 profils générés | **aucune** cible générée |
| Interactions | likes / commentaires / suivis simulés | **désactivées** |
| Identifiants Graph | absents (mode simulation) | **jeton réel**, chiffré AES-256-GCM |
| Accès | libre | **mot de passe** obligatoire |
| Horloge | accélérée | rythme réel (1 min/s) par défaut |

Tant que la configuration n'est pas complète, **le moteur ne démarre pas** : l'interface affiche
l'écran « Mise en service » et chaque donnée manquante est listée.

---

## 2. Prérequis

1. **Node.js ≥ 22.5** (module `node:sqlite` intégré) — ou Docker.
2. Un **compte Instagram professionnel** (créateur ou entreprise) relié à une page Facebook.
3. Une **application Meta** avec le produit *Instagram Graph API*, et un **jeton longue durée**
   (`IG_USER_ID` + `IG_ACCESS_TOKEN`) disposant des permissions `instagram_basic`,
   `instagram_content_publish` et `instagram_manage_insights`.
4. Un **nom de domaine** pointant vers le serveur (HTTPS automatique avec Caddy).
5. Les **médias** à publier : MP4/MOV/WebM pour les Reels, JPG/PNG/WebP pour les stories.

> Les jetons Meta expirent (60 jours pour un jeton longue durée). Prévoyez leur rotation :
> l'écran de mise en service permet de les remplacer sans redémarrer l'application.

---

## 3. Préparer les contenus

Le moteur **ne fabrique aucun média**. Il répartit le stock fourni :

| Type | Quota quotidien | Format conseillé |
|---|---:|---|
| Story | 3 | image 1080 × 1920 |
| Reel | 2 | vidéo verticale 1080 × 1920, H.264 |
| UnePleine | 1 (lun./mer./ven.) | image 1080 × 1350 |
| PhotoProfil | 1 (une fois) | carré 420 × 420 |

Un contenu sans jour affecté est automatiquement placé sur la première journée qui a de la place.
Prévoyez au minimum **3 stories par jour de cycle** (90 pour 30 jours) et **2 Reels par jour**
(60) pour couvrir un cycle complet.

### Source Google Drive

1. Créer un dossier racine dans le Drive du compte, partagé avec l'application.
2. Créer les sous-dossiers `Reels/`, `Stories/`, `UnePleine/`, `PhotoProfil/`, `Archive/`.
3. Renseigner dans `.env` : `GOOGLE_DRIVE_ENABLED=true`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, puis les identifiants de dossiers
   (`/folders/<ID>` dans l'URL Drive).
4. Redémarrer, puis vérifier dans **Drive → Synchroniser** que les fichiers sont indexés.

Après une publication confirmée, le fichier est **déplacé** vers `Archive/` : ce n'est pas une
suppression. Si la publication échoue, le fichier reste en place et sera réessayé au cycle
suivant. Les fichiers de plus de 200 Mo sont ignorés et journalisés.

### Lien de suivi

Placez dans la bio le lien court affiché dans **Lien & commentaires** (par exemple
`https://bot.exemple.com/l/abc2345`). Chaque visite est comptée (jour, pays, référent tronqué)
puis redirigée en `302`; aucune adresse IP ni cookie n'est conservé. Le lien fonctionne sans
authentification et doit donc rester accessible derrière Caddy.

---

## 4. Déploiement A — Docker + Caddy (recommandé)

```bash
git clone https://github.com/GhostSl4yer/Insta-VA.git
cd Insta-VA

cp .env.production.example .env
# renseigner au minimum : DOMAINE, INSTAVA_MOT_DE_PASSE_HASH, INSTAVA_SECRET

node scripts/hash-mot-de-passe.js "votre mot de passe"   # → INSTAVA_MOT_DE_PASSE_HASH
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → INSTAVA_SECRET

docker compose up -d --build
docker compose logs -f app
```

Caddy obtient le certificat TLS automatiquement. L'application écoute uniquement sur le réseau
interne de Compose : **seul Caddy est exposé** (ports 80/443).

Ouvrez ensuite `https://votre.domaine` : la console demande le mot de passe, puis affiche la
mise en service.

Les données persistent dans `./data` (base SQLite, médias, rapports, clé de chiffrement).

---

## 5. Déploiement B — VPS + systemd (sans Docker)

```bash
sudo adduser --system --group --home /opt/insta-va instava
sudo mkdir -p /opt/insta-va && sudo chown instava:instava /opt/insta-va

# copier le dépôt dans /opt/insta-va, puis :
sudo -u instava cp .env.production.example /opt/insta-va/.env
sudo -u instava nano /opt/insta-va/.env

sudo cp deploy/insta-va.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now insta-va
sudo journalctl -u insta-va -f
```

Placez **Nginx** ou **Caddy** devant, en proxy vers `127.0.0.1:3000`, avec :

- `X-Forwarded-For` et `X-Forwarded-Proto` transmis (`INSTAVA_DERRIERE_PROXY=true`) ;
- la mise en tampon désactivée pour `/api/stream` (SSE) ;
- HSTS activé.

Exemple Caddy minimal :

```caddy
bot.exemple.com {
	encode zstd gzip
	@flux path /api/stream
	reverse_proxy @flux 127.0.0.1:3000 { flush_interval -1 }
	reverse_proxy 127.0.0.1:3000
}
```

---

## 6. Hébergement serverless (Vercel, Netlify, Lambda)

**L'architecture actuelle ne peut pas y tourner**, et ce n'est pas un réglage : c'est structurel.

| Besoin du moteur | Contrainte serverless |
|---|---|
| boucle de fond qui avance l'horloge toutes les 400 ms | aucune fonction ne survit entre deux requêtes |
| SQLite sur disque (`node:sqlite`) | système de fichiers éphémère et non partagé |
| flux SSE permanent | durée d'exécution plafonnée |
| redirection mesurée `/l/:code` | liens courts fonctionnels, mais comptage non partagé entre instances |
| état en mémoire (plan de journée, sessions) | chaque invocation repart d'un processus neuf |

Trois voies existent :

1. **Héberger le conteneur** chez un fournisseur qui fait tourner un processus en continu
   (VPS, Fly.io, Render, Railway, Scalingo). C'est la voie recommandée : aucun code à changer.
2. **Réécrire le moteur** en tâches planifiées (cron) + base managée (Postgres/Turso), en
   acceptant la perte du temps réel et de l'affichage SSE. C'est un chantier séparé, à chiffrer.
3. **Garder Vercel pour la vitrine** et le moteur chez un hébergeur de conteneurs, avec un
   sous-domaine dédié pour la console.

Le fichier `Dockerfile` fourni fonctionne tel quel sur Fly.io, Render, Railway et Scalingo.

**Ce qui reste utilisable sur Vercel** : l'interface statique, les endpoints de lecture et la
documentation. **Ce qui ne l'est pas** : la publication planifiée, la synchronisation Drive, la
collecte des commentaires et le comptage fiable des clics. Le détail des décisions ouvertes est
dans [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 7. Mise en service (dans l'interface)

Après connexion, l'écran **Mise en service** demande, bloc par bloc :

1. **Responsable** — prénom, nom, e-mail (destinataire des rapports et alertes) ;
2. **Compte Instagram** — nom d'utilisateur, nom affiché, bio, lien de la bio, localisation ;
3. **Audience** — âge minimum (plancher 25 ans), pays autorisés, genre ;
4. **Identifiants Graph** — `IG_USER_ID` et jeton (chiffré avant stockage) ;
5. **Contenus** — import des médias réels (ou synchronisation Google Drive) ;
6. **Validation** — vérifie l'ensemble et démarre le moteur.

Chaque bloc est enregistré séparément : vous pouvez fermer la console et reprendre plus tard.

Les **réponses aux commentaires** sont activées par défaut (`INSTAVA_REPONSES_COMMENTAIRES=true`)
et ne s'exécutent qu'avec des identifiants Graph valides. Elles sont la seule interaction
sortante réellement disponible : likes, abonnements et visionnages ne sont pas automatisés.

---

## 8. Sécurité

- **Mot de passe obligatoire** en production. Préférez `INSTAVA_MOT_DE_PASSE_HASH`
  (scrypt) à `INSTAVA_MOT_DE_PASSE` en clair.
- **Sessions signées** HMAC-SHA256, cookie `HttpOnly` + `SameSite=Lax` + `Secure`.
- **Limitation** : 8 tentatives par IP et par quart d'heure.
- **Jeton Graph chiffré** (AES-256-GCM) ; la clé vit dans `data/.cle` (0600) et n'est jamais
  servie par l'API. Sauvegardez-la : sans elle, les jetons stockés sont illisibles.
- **Aucun appel sortant** hormis l'API Graph : pas de CDN, pas de police distante.
- **En-têtes** : `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS via le proxy.
- Le conteneur tourne avec l'utilisateur **non privilégié** `node`.
- N'exposez jamais le port 3000 directement sur Internet : passez par le proxy TLS.

⚠️ **Ne versionnez jamais `.env`** — il contient le mot de passe et le secret de session.

---

## 9. Sauvegardes

```bash
# sauvegarde immédiate (base + médias + clé), 14 dernières conservées
node scripts/sauvegarde.js
# ou vers un disque externe
node scripts/sauvegarde.js /mnt/sauvegardes/insta-va
```

Automatisation quotidienne (cron) :

```cron
15 3 * * * cd /opt/insta-va && /usr/bin/node scripts/sauvegarde.js /mnt/sauvegardes/insta-va >> /var/log/insta-va-sauvegarde.log 2>&1
```

Restauration : arrêter le service, remplacer `data/` par la sauvegarde, redémarrer.

---

## 10. Mise à jour

```bash
git pull
docker compose up -d --build        # Docker
# ou : sudo systemctl restart insta-va
```

La base est migrée automatiquement au démarrage (schéma `CREATE TABLE IF NOT EXISTS`).
Faites une sauvegarde avant chaque mise à jour.

---

## 11. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| La console redirige sans cesse vers `/connexion` | cookie refusé (HTTPS absent ou domaine différent) | servir en HTTPS, vérifier `INSTAVA_HTTPS` |
| « Configuration incomplète » au démarrage | une donnée manque | ouvrir la console, l'écran liste les blocs manquants |
| Aucune publication planifiée | Drive vide ou types absents | importer des Story/Reel dans la mise en service |
| Erreur Graph 190 | jeton expiré | régénérer le jeton et le saisir dans la console |
| Erreur Graph 9007 / 2207026 | média non accessible ou format refusé | vérifier `URL_PUBLIQUE` et le format (MP4 H.264) |
| `healthz` répond 503 | base illisible | consulter les journaux, restaurer une sauvegarde |

Journaux : `docker compose logs -f app` ou `journalctl -u insta-va -f`.
