import { config } from '../config.js';
import { journaliser } from '../domaine/journal.js';
import { identifiantsGraph } from '../domaine/configuration.js';

/**
 * Passerelle Instagram — mode live uniquement.
 *
 * Aucune simulation : sans identifiants Graph valides, l'appel échoue et
 * l'erreur remonte au moteur (publication en échec, anomalie visible). Les
 * identifiants sont ceux du compte courant.
 */
export const modeSimulation = () => false;

async function appelGraph(chemin, params = {}, methode = 'GET') {
  const identifiants = identifiantsGraph();
  if (!identifiants.token || !identifiants.userId) {
    throw new Error('Publication impossible : identifiants Instagram Graph manquants.');
  }
  const base = `https://graph.facebook.com/${config.graph.version}`;
  const url = new URL(`${base}${chemin}`);
  const options = { method: methode, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
  const corps = new URLSearchParams({ ...params, access_token: identifiants.token });
  if (methode === 'GET') {
    for (const [cle, valeur] of corps) url.searchParams.set(cle, valeur);
  } else {
    options.body = corps.toString();
  }
  const reponse = await fetch(url, options);
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || donnees.error) {
    const message = donnees?.error?.message || `Erreur Graph ${reponse.status}`;
    throw new Error(message);
  }
  return donnees;
}

/** Publie un média réel via l'API Instagram Graph. */
export async function publierMedia({ type, urlMedia, legende, miniatureUrl }) {
  const estVideo = type === 'Reel';
  const champs = {
    media_type: estVideo ? 'REELS' : 'IMAGE',
    caption: legende || '',
  };
  if (estVideo) {
    champs.video_url = urlMedia;
    if (miniatureUrl) champs.thumb_offset = '0';
  } else {
    champs.image_url = urlMedia;
  }
  const creation = await appelGraph(`/${identifiantsGraph().userId}/media`, champs, 'POST');
  const statutPublication = await appelGraph(`/${identifiantsGraph().userId}/media_publish`, {
    creation_id: creation.id,
  }, 'POST');
  const infos = await appelGraph(`/${statutPublication.id}`, { fields: 'permalink' });
  return { id: statutPublication.id, permalink: infos.permalink, simule: false };
}

/** Vérifie le jeton du compte courant (`GET /me`). */
export async function verifierCompte() {
  const infos = await appelGraph('/me', { fields: 'id,username,account_type' });
  return { id: infos.id, username: infos.username, type: infos.account_type };
}

export async function verifierStatutMedia(mediaId) {
  const infos = await appelGraph(`/${mediaId}`, { fields: 'status_code' });
  return { statut: infos.status_code };
}

/** Insights agrégés du compte. */
export async function recupererInsights({ metrique = 'impressions,reach', periode = 'day' } = {}) {
  try {
    const infos = await appelGraph(`/${identifiantsGraph().userId}/insights`, { metric: metrique, period: periode });
    return infos.data;
  } catch (erreur) {
    journaliser(`Insights Graph indisponibles : ${erreur.message}`, { niveau: 'alerte', categorie: 'instagram' });
    return null;
  }
}

/**
 * Suivre un compte n'est pas exposé par l'API Instagram : la fonction reste
 * absente volontairement. Aucun contournement n'est implémenté.
 */
