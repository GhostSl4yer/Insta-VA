/**
 * Réponses aux commentaires reçus.
 *
 * Le cahier des charges place la réponse aux commentaires en priorité : ce sont
 * les seules interactions que l'API officielle permet d'exécuter réellement.
 *
 * Les réponses sont **écrites à l'avance** (pas générées à la volée) et varient
 * selon la langue détectée du commentaire et son intention. Le responsable peut
 * les remplacer dans `data/reponses.json` sans toucher au code.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const BANQUE_PAR_DEFAUT = {
  fr: {
    remerciement: [
      'Merci beaucoup pour votre retour !',
      'Merci pour ce message, ça fait plaisir à lire.',
      'Merci d’avoir pris le temps de commenter.',
    ],
    question: [
      'Bonne question — tout est détaillé dans le lien de la bio.',
      'Je réponds en détail dans le lien de la bio, jetez-y un œil.',
      'La réponse complète est dans le lien de la bio.',
    ],
    compliment: [
      'Ça me touche, merci !',
      'Merci, c’est exactement l’effet recherché.',
      'Content que ça vous plaise.',
    ],
    neutre: [
      'Merci pour votre passage !',
      'Merci d’avoir laissé un mot.',
      'Au plaisir de vous relire ici.',
    ],
  },
  en: {
    remerciement: [
      'Thank you so much for the feedback!',
      'Appreciate you taking the time to comment.',
      'Thanks for stopping by!',
    ],
    question: [
      'Great question — the full breakdown is linked in bio.',
      'I go deeper on this in the link in bio.',
      'The complete answer is in the bio link.',
    ],
    compliment: [
      'That means a lot, thank you!',
      'Thanks — that is exactly the goal.',
      'Glad you liked it.',
    ],
    neutre: [
      'Thanks for being here!',
      'Appreciate the comment.',
      'See you in the next one.',
    ],
  },
};

const MOTS_QUESTION = /(\?|comment|combien|pourquoi|quand|où|which|how|what|why|when|where|price|prix)/i;
const MOTS_COMPLIMENT = /(super|génial|genial|top|magnifique|bravo|joli|love|amazing|great|awesome|beautiful|nice|cool)/i;
const MOTS_MERCI = /(merci|thanks|thank you|thx)/i;

/** Devine la langue du commentaire (français si accents/mots français, sinon anglais). */
export function langueDe(texte = '') {
  const t = String(texte).toLowerCase();
  if (/[àâäéèêëîïôöùûüç]/.test(t)) return 'fr';
  const motsFrancais =
    /\b(le|la|les|un|une|des|du|je|tu|il|elle|nous|vous|ils|très|bien|merci|bonjour|salut|magnifique|genial|génial|super|bravo|joli|belle|beau|trop|contenu|vidéo|video|partage|réponse|reponse|question|prix|combien|pourquoi|comment|bonne|journée|journee)\b/;
  if (motsFrancais.test(t)) return 'fr';
  return 'en';
}

/** Classe l'intention du commentaire pour choisir une famille de réponse. */
export function intentionDe(texte = '') {
  const t = String(texte);
  if (MOTS_QUESTION.test(t)) return 'question';
  if (MOTS_MERCI.test(t)) return 'remerciement';
  if (MOTS_COMPLIMENT.test(t)) return 'compliment';
  return 'neutre';
}

/** Surcharge optionnelle : `data/reponses.json` (même structure) remplace la banque. */
function chargerBanque() {
  try {
    const fichier = path.join(config.dossierDonnees, 'reponses.json');
    if (!fs.existsSync(fichier)) return BANQUE_PAR_DEFAUT;
    const perso = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    const fusion = { ...BANQUE_PAR_DEFAUT };
    for (const langue of Object.keys(perso)) {
      fusion[langue] = { ...(BANQUE_PAR_DEFAUT[langue] || {}), ...perso[langue] };
    }
    return fusion;
  } catch {
    return BANQUE_PAR_DEFAUT;
  }
}

export const REPONSES = chargerBanque();

/**
 * Choisit une réponse. `graine` rend le choix déterministe pour un même
 * commentaire (pas de doublon, pas d'aléatoire qui change au redémarrage).
 */
export function choisirReponse(texteRecu, { graine = 0, banque = REPONSES } = {}) {
  const langue = langueDe(texteRecu);
  const intention = intentionDe(texteRecu);
  const liste = banque[langue]?.[intention] || banque.en.neutre;
  const index = Math.abs(Number(graine) || 0) % liste.length;
  return { langue, intention, texte: liste[index] };
}
