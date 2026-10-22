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

/**
 * Mode live uniquement : aucune donnée n'est inventée, l'application refuse de
 * publier sans identifiants Graph et sans média réel. `APP_ENV` n'est conservé
 * que pour l'affichage.
 */
const environnement = (process.env.APP_ENV || 'production').toLowerCase();
const production = true;

export const config = Object.freeze({
  racine: RACINE,
  port: nombre(process.env.PORT, 3000),
  hote: process.env.HOST || '0.0.0.0',
  dossierDonnees,
  dossierPublic: path.join(RACINE, 'public'),
  dossierDrive: path.join(dossierDonnees, 'drive'),
  dossierRapports: path.join(dossierDonnees, 'rapports'),
  dossierComptes: path.join(dossierDonnees, 'comptes'),
  // Chaque compte possède ses médias et ses rapports, cloisonnés sur disque.
  dossierCompte: (id) => path.join(dossierDonnees, 'comptes', String(id)),
  dossierMediasCompte: (id) => path.join(dossierDonnees, 'comptes', String(id), 'drive'),
  dossierRapportsCompte: (id) => path.join(dossierDonnees, 'comptes', String(id), 'rapports'),
  fichierBase: path.join(dossierDonnees, 'insta-va.sqlite'),
  fichierCle: path.join(dossierDonnees, '.cle'),
  fuseau: process.env.IG_TIMEZONE || 'America/New_York',
  environnement,
  production,
  modeInstagram: 'graph',
  vitesseDefaut: Math.max(1, nombre(process.env.VITESSE_DEFAUT, 1)),
  // Aucun historique n'est fabriqué : les données viennent d'Instagram et du Drive.
  amorcageJours: 0,
  interactionsActives: false,
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
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    jetonRafraichissement: process.env.GOOGLE_REFRESH_TOKEN || '',
    intervalleSyncMin: Math.max(5, nombre(process.env.GOOGLE_SYNC_MINUTES, 30)),
    dossiers: Object.freeze({
      Reel: process.env.GOOGLE_DRIVE_REELS_FOLDER_ID || '',
      Story: process.env.GOOGLE_DRIVE_STORIES_FOLDER_ID || '',
      PhotoProfil: process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID || '',
      UnePleine: process.env.GOOGLE_DRIVE_LIVRE_FOLDER_ID || '',
    }),
    dossierArchive: process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || '',
  }),
  // Réponses aux commentaires reçus (seule interaction réellement disponible via l'API).
  // Priorité du cahier des charges : répondre aux commentaires reçus.
  // Activé par défaut ; inopérant sans identifiants Graph.
  reponsesCommentaires: booleen(process.env.INSTAVA_REPONSES_COMMENTAIRES, true),
  intervalleCommentairesMin: Math.max(5, nombre(process.env.INSTAVA_COMMENTAIRES_MINUTES, 20)),
  jourConfiguration: Math.max(1, nombre(process.env.INSTAVA_JOUR_CONFIGURATION, 1)),
  rattrapageMaxHeures: Math.max(0, nombre(process.env.INSTAVA_RATTRAPAGE_HEURES, 12)),
  webhookRapport: process.env.RAPPORT_WEBHOOK_URL || '',
  urlPublique: (process.env.URL_PUBLIQUE || '').replace(/\/$/, ''),
  version: '1.2.0',
  versionApi: '1.2.0',
});

export function preparerDossiers() {
  for (const dossier of [config.dossierDonnees, config.dossierComptes, config.dossierRapports]) {
    fs.mkdirSync(dossier, { recursive: true });
  }
}

/** Prépare les dossiers d'un compte (médias téléchargés, rapports). */
export function preparerDossiersCompte(compteId) {
  for (const dossier of [config.dossierMediasCompte(compteId), config.dossierRapportsCompte(compteId)]) {
    fs.mkdirSync(dossier, { recursive: true });
  }
}
