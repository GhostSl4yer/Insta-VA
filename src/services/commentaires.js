import { config } from '../config.js';
import { identifiantsGraph } from '../domaine/configuration.js';

/**
 * Commentaires — la seule interaction réellement disponible via l'API officielle.
 *
 * `instagram_manage_comments` permet de :
 *   - lire les commentaires des médias du compte ;
 *   - répondre publiquement à un commentaire (`POST /{comment-id}/replies`).
 *
 * Le like, le suivi et le visionnage ne sont pas exposés par l'API : ils ne sont
 * donc pas implémentés ici (voir la matrice de capacités du README).
 */

const VERSION = () => config.graph.version || 'v21.0';

async function appel(chemin, params = {}, methode = 'GET') {
  const { token } = identifiantsGraph();
  if (!token) throw new Error('Jeton Instagram Graph manquant.');
  const url = new URL(`https://graph.facebook.com/${VERSION()}${chemin}`);
  const corps = new URLSearchParams({ ...params, access_token: token });
  let options = { method: methode };
  if (methode === 'GET') {
    for (const [cle, valeur] of corps) url.searchParams.set(cle, valeur);
  } else {
    options = { ...options, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: corps.toString() };
  }
  const reponse = await fetch(url, options);
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || donnees.error) {
    throw new Error(donnees?.error?.message || `Erreur Graph ${reponse.status}`);
  }
  return donnees;
}

/** Commentaires d'un média, avec l'éventuelle réponse déjà publiée. */
export async function listerCommentaires(mediaId, { limite = 50 } = {}) {
  const donnees = await appel(`/${mediaId}/comments`, {
    fields: 'id,text,username,timestamp,replies{id,text,username,timestamp}',
    limit: String(limite),
  });
  return (donnees.data || []).map((c) => ({
    id: c.id,
    texte: c.text || '',
    auteur: c.username || '',
    date: c.timestamp || '',
    dejaRepondu: Boolean(c.replies?.data?.length),
  }));
}

/** Réponse publique à un commentaire. */
export async function repondreCommentaire(commentId, message) {
  const donnees = await appel(
    `/${commentId}/replies`,
    { message: String(message).slice(0, 2200) },
    'POST',
  );
  return { id: donnees.id || null };
}

/** Masque un commentaire (modération) — utile en cas de contenu indésirable. */
export async function masquerCommentaire(commentId) {
  await appel(`/${commentId}`, { hide: 'true' }, 'POST');
  return { masque: true };
}
