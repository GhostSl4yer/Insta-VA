import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Charge un fichier .env minimaliste (aucune dépendance externe). */
function chargerEnv(fichier) {
  if (!fs.existsSync(fichier)) return;
  const contenu = fs.readFileSync(fichier, 'utf8');
  for (const ligne of contenu.split(/\r?\n/)) {
    const net = ligne.trim();
    if (!net || net.startsWith('#')) continue;
    const i = net.indexOf('=');
    if (i < 1) continue;
    const cle = net.slice(0, i).trim();
    let valeur = net.slice(i + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    if (process.env[cle] === undefined) process.env[cle] = valeur;
  }
}

chargerEnv(path.join(RACINE, '.env'));

const nombre = (valeur, defaut) => {
  const n = Number(valeur);
  return Number.isFinite(n) ? n : defaut;
};
const booleen = (valeur, defaut = false) =>
  valeur === undefined ? defaut : ['1', 'true', 'oui', 'yes', 'on'].includes(String(valeur).toLowerCase());

const dossierDonnees = path.resolve(RACINE, process.env.DATA_DIR || 'data');

/** `production` verrouille les données de démonstration : rien n'est inventé. */
const environnement = (process.env.APP_ENV || 'developpement').toLowerCase();
const production = environnement === 'production';

export const config = Object.freeze({
  racine: RACINE,
  port: nombre(process.env.PORT, 3000),
  hote: process.env.HOST || '0.0.0.0',
  dossierDonnees,
  dossierPublic: path.join(RACINE, 'public'),
  dossierDrive: path.join(dossierDonnees, 'drive'),
  dossierRapports: path.join(dossierDonnees, 'rapports'),
  fichierBase: path.join(dossierDonnees, 'insta-va.sqlite'),
  fichierCle: path.join(dossierDonnees, '.cle'),
  fuseau: process.env.IG_TIMEZONE || 'America/New_York',
  environnement,
  production,
  modeInstagram: (process.env.INSTAGRAM_MODE || (production ? 'graph' : 'simulation')).toLowerCase(),
  vitesseDefaut: Math.max(1, nombre(process.env.VITESSE_DEFAUT, production ? 1 : 6)),
  // En production, aucun historique n'est fabriqué : les données sont fournies.
  amorcageJours: production ? 0 : Math.max(0, nombre(process.env.AMORCAGE_JOURS, 6)),
  interactionsActives: booleen(process.env.INSTAVA_INTERACTIONS, !production),
  motDePasse: process.env.INSTAVA_MOT_DE_PASSE || '',
  hashMotDePasse: process.env.INSTAVA_MOT_DE_PASSE_HASH || '',
  secretSession: process.env.INSTAVA_SECRET || '',
  sessionHeures: Math.max(1, nombre(process.env.INSTAVA_SESSION_HEURES, 12)),
  forcerHttps: booleen(process.env.INSTAVA_HTTPS, production),
  derriereProxy: booleen(process.env.INSTAVA_DERRIERE_PROXY, production),
  pauseInterJourMs: Math.max(0, nombre(process.env.PAUSE_INTERJOUR_MS, 2200)),
  dureeCycleJours: 30,
  heureDebut: '16:00',
  heureFin: '00:00',
  visionnageObjectifMin: 30,
  ageMinimum: 25,
  graph: Object.freeze({
    userId: process.env.IG_USER_ID || '',
    token: process.env.IG_ACCESS_TOKEN || '',
    version: process.env.IG_API_VERSION || 'v21.0',
  }),
  googleDrive: Object.freeze({
    active: booleen(process.env.GOOGLE_DRIVE_ENABLED),
    token: process.env.GOOGLE_ACCESS_TOKEN || '',
    dossiers: Object.freeze({
      Reel: process.env.GOOGLE_DRIVE_REELS_FOLDER_ID || '',
      Story: process.env.GOOGLE_DRIVE_STORIES_FOLDER_ID || '',
      PhotoProfil: process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID || '',
    }),
  }),
  webhookRapport: process.env.RAPPORT_WEBHOOK_URL || '',
  urlPublique: (process.env.URL_PUBLIQUE || '').replace(/\/$/, ''),
  version: '1.1.0',
  versionApi: '1.1.0',
});

export function preparerDossiers() {
  for (const dossier of [
    config.dossierDonnees,
    config.dossierDrive,
    path.join(config.dossierDrive, 'reels'),
    path.join(config.dossierDrive, 'stories'),
    path.join(config.dossierDrive, 'photos'),
    path.join(config.dossierDrive, 'livre'),
    path.join(config.dossierDrive, 'telecharges'),
    config.dossierRapports,
  ]) {
    fs.mkdirSync(dossier, { recursive: true });
  }
}
