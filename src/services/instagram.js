import { config } from '../config.js';
import { journaliser } from '../domaine/journal.js';
import { identifiantsGraph } from '../domaine/configuration.js';

/**
 * Passerelle Instagram.
 * - `simulation` : aucune requête réseau, tout est simulé (100 % autonome).
 * - `graph` : publication réelle via l'API Instagram Graph (nécessite un compte
 *   professionnel, un token et des médias accessibles publiquement en HTTPS).
 */
export const modeSimulation = () => config.modeInstagram !== 'graph';

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

/** Publie un média. En simulation, renvoie un identifiant et un permalien fictifs. */
export async function publierMedia({ type, urlMedia, legende, miniatureUrl }) {
  if (modeSimulation()) {
    const id = `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      permalink: `https://www.instagram.com/p/${id.slice(4, 15)}/`,
      simule: true,
    };
  }
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

export async function verifierStatutMedia(mediaId) {
  if (modeSimulation()) return { statut: 'FINISHED', simule: true };
  const infos = await appelGraph(`/${mediaId}`, { fields: 'status_code' });
  return { statut: infos.status_code, simule: false };
}

/** Insights agrégés (mode Graph). En simulation, les statistiques sont calculées localement. */
export async function recupererInsights({ metrique = 'impressions,reach', periode = 'day' } = {}) {
  if (modeSimulation()) return null;
  try {
    const infos = await appelGraph(`/${identifiantsGraph().userId}/insights`, { metric: metrique, period: periode });
    return infos.data;
  } catch (erreur) {
    journaliser(`Insights Graph indisponibles : ${erreur.message}`, { niveau: 'alerte', categorie: 'instagram' });
    return null;
  }
}

export async function suivreUtilisateur(userId) {
  if (modeSimulation()) return { ok: true, simule: true };
  try {
    await appelGraph(`/${userId}/follow`, {}, 'POST');
    return { ok: true };
  } catch (erreur) {
    return { ok: false, erreur: erreur.message };
  }
}
