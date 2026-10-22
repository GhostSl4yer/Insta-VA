import { config } from '../config.js';

/**
 * Client minimal de l'API Google Drive v3.
 *
 * Le Drive est la source des contenus : le bot liste les fichiers des dossiers
 * fournis, les télécharge, puis les déplace vers un dossier d'archive après
 * publication confirmée (jamais de suppression définitive).
 *
 * Authentification : jeton d'accès (courte durée) ou, préférable en
 * exploitation, un jeton de rafraîchissement OAuth — le jeton d'accès est alors
 * renouvelé automatiquement.
 */

const BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

let jetonMemoire = null;
let expirationJeton = 0;

class ErreurDrive extends Error {
  constructor(message, statut = 502, details = null) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

/**
 * Les identifiants OAuth sont ceux de l'installation (un seul compte de service
 * peut accéder à tous les dossiers partagés). Le dossier, lui, dépend du compte
 * Instagram et arrive par paramètre.
 */
export const driveConfigure = () =>
  Boolean(config.googleDrive.jetonRafraichissement || config.googleDrive.token || config.googleDrive.clientId);

/** Renvoie un jeton d'accès valide, en le renouvelant si nécessaire. */
async function jeton() {
  const { token, clientId, clientSecret, jetonRafraichissement } = config.googleDrive;

  if (jetonRafraichissement && clientId && clientSecret) {
    if (jetonMemoire && Date.now() < expirationJeton - 60_000) return jetonMemoire;
    const reponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: jetonRafraichissement,
        grant_type: 'refresh_token',
      }),
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !donnees.access_token) {
      throw new ErreurDrive(
        `Renouvellement du jeton Google refusé : ${donnees.error_description || donnees.error || reponse.status}`,
        502,
      );
    }
    jetonMemoire = donnees.access_token;
    expirationJeton = Date.now() + (Number(donnees.expires_in) || 3600) * 1000;
    return jetonMemoire;
  }

  if (token) return token;
  throw new ErreurDrive('Google Drive activé mais aucun identifiant fourni (GOOGLE_ACCESS_TOKEN ou OAuth).', 500);
}

async function appel(chemin, { methode = 'GET', corps = null, brut = false, params = {} } = {}) {
  const url = new URL(`${BASE}${chemin}`);
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') url.searchParams.set(cle, valeur);
  }
  const reponse = await fetch(url, {
    method: methode,
    headers: {
      authorization: `Bearer ${await jeton()}`,
      ...(corps && !brut ? { 'content-type': 'application/json' } : {}),
    },
    body: corps ? (brut ? corps : JSON.stringify(corps)) : undefined,
  });
  if (brut) {
    if (!reponse.ok) throw new ErreurDrive(`Téléchargement Google Drive échoué (${reponse.status}).`);
    return Buffer.from(await reponse.arrayBuffer());
  }
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const message = donnees?.error?.message || `Erreur Google Drive ${reponse.status}`;
    throw new ErreurDrive(message, reponse.status === 401 || reponse.status === 403 ? 502 : reponse.status, donnees?.error);
  }
  return donnees;
}

/** Liste les fichiers d'un dossier (les sous-dossiers sont exclus). */
export async function listerFichiers(dossierId) {
  if (!dossierId) return [];
  const fichiers = [];
  let pageToken;
  do {
    const donnees = await appel('/files', {
      params: {
        q: `'${dossierId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime)',
        orderBy: 'name_natural',
        pageSize: 200,
        pageToken,
      },
    });
    fichiers.push(...(donnees.files || []));
    pageToken = donnees.nextPageToken;
  } while (pageToken);
  return fichiers;
}

/** Liste les sous-dossiers d'un dossier (pour retrouver Reels/Stories/etc.). */
export async function listerDossiers(dossierId) {
  if (!dossierId) return [];
  const donnees = await appel('/files', {
    params: {
      q: `'${dossierId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      pageSize: 200,
    },
  });
  return donnees.files || [];
}

/** Télécharge un fichier par son identifiant. */
export async function telechargerFichier(fichierId) {
  return appel(`/files/${encodeURIComponent(fichierId)}`, { params: { alt: 'media' }, brut: true });
}

/**
 * Déplace un fichier d'un dossier à un autre (archivage après publication).
 * Le fichier n'est jamais supprimé : il sort simplement de la file « à publier ».
 */
export async function deplacerFichier(fichierId, { depuis, vers }) {
  if (!vers) return { deplace: false, raison: 'aucun dossier d’archive configuré' };
  const params = { addParents: vers, fields: 'id, parents' };
  if (depuis) params.removeParents = depuis;
  const donnees = await appel(`/files/${encodeURIComponent(fichierId)}`, {
    methode: 'PATCH',
    params,
  });
  return { deplace: true, parents: donnees.parents };
}

/** Crée un dossier (utilisé pour Archive/ quand il manque). */
export async function creerDossier({ nom, parentId }) {
  return appel('/files', {
    methode: 'POST',
    corps: {
      name: nom,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    params: { fields: 'id, name' },
  });
}

/** Informations d'un fichier (nom, taille, type MIME). */
export async function infosFichier(fichierId) {
  return appel(`/files/${encodeURIComponent(fichierId)}`, {
    params: { fields: 'id, name, mimeType, size, modifiedTime' },
  });
}

export { ErreurDrive };
