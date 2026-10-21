import { HASHTAGS, THEMES, MUSIQUES } from './concepts.js';
import { LIEN_EXTERNE } from './personas.js';
import { echapper } from '../utils/texte.js';

const OUVERTURES = {
  fitness: [
    'Personne ne t’a dit que le plus dur, c’était de commencer.',
    'Une séance ratée vaut mieux qu’une séance imaginée.',
    'Le corps que tu veux se construit les jours où tu n’as pas envie.',
    'Pas de hashtag magique : juste des répétitions.',
    'Ce n’est pas une question de motivation, c’est une question de système.',
  ],
  nutrition: [
    'Une assiette simple vaut mieux qu’un plan parfait.',
    'Manger utile, sans se compliquer la vie.',
    'La constance se construit une assiette à la fois.',
    'Pas de régime, des habitudes qui tiennent.',
  ],
  running: [
    'Les jambes suivent ce que la tête accepte.',
    'Chaque foulée régulière construit la suivante.',
    'La course ne ment jamais : elle récompense la patience.',
    'Le chrono est une conséquence, pas un objectif.',
  ],
  bienetre: [
    'Ralentir n’est pas abandonner.',
    'Le calme s’entraîne comme un muscle.',
    'Ta récupération fait partie de ton entraînement.',
    'Un rituel simple bat une routine parfaite.',
  ],
  ia: [
    'La technologie est utile quand elle sert ta voix, pas quand elle la remplace.',
    'Un avatar IA bien réglé, c’est un double qui prépare — pas qui décide.',
    'Gagner du temps, c’est gagner de la présence.',
    'Ce qui se mesure s’améliore, surtout quand une IA fait la veille.',
  ],
};

const MOTS_CLES_IA = ['avatar IA', 'double digital', 'productivité'];

function hashtagsPour(theme, graine = 0) {
  const base = [...(HASHTAGS[theme] || HASHTAGS.fitness)];
  const locaux = HASHTAGS.local;
  const marque = HASHTAGS.marque;
  const rotation = graine % Math.max(1, base.length);
  const themes = [...base.slice(rotation), ...base.slice(0, rotation)].slice(0, 6);
  const choisis = [...themes, ...locaux.slice(0, 2), ...marque];
  return [...new Set(choisis)].join(' ');
}

function tirer(liste, graine) {
  return liste[Math.abs(graine) % liste.length];
}

/** Compose la légende finale d'un contenu (publication Instagram). */
export function composerLegende(concept, { graine = 0, jour = 0, type = 'Reel' } = {}) {
  const theme = concept.theme || 'fitness';
  const ouverture = tirer(OUVERTURES[theme] || OUVERTURES.fitness, graine + jour);
  const cta = concept.cta || 'Dis-moi ce que tu en penses en commentaire.';
  const mentionAvatar =
    theme === 'ia' || graine % 3 === 0
      ? `\n\n🌐 Mon avatar IA : ${LIEN_EXTERNE.libelle} (lien en bio)`
      : '\n\n📩 Le lien de l’avatar est en bio.';
  const signature = '\n\n— Maya · coach & avatar IA';
  const hashtags = hashtagsPour(concept.hashtagsTheme || theme, graine + (type === 'Story' ? 3 : 0));
  return `${ouverture}\n\n${concept.caption}\n\n${cta}${mentionAvatar}${signature}\n\n${hashtags}`;
}

export function musiquePour(graine) {
  return MUSIQUES[Math.abs(graine) % MUSIQUES.length];
}

export function libelleTheme(theme) {
  return THEMES[theme]?.libelle || theme;
}

export function texteStory(concept, graine = 0) {
  const stickers = [
    { type: 'sondage', question: 'Tu tries ça ?', options: ['Oui, demain', 'Pas encore'] },
    { type: 'question', question: 'Ta plus grosse difficulté ?', options: [] },
    { type: 'lien', libelle: 'Voir l’avatar', url: LIEN_EXTERNE.url },
    { type: 'compteur', libelle: 'Jours de régularité', valeur: (graine % 30) + 1 },
    { type: 'emoji', libelle: 'Réagis si tu testes', options: ['🔥', '💪', '🌿'] },
  ];
  const sticker = stickers[Math.abs(graine) % stickers.length];
  return { ...sticker, motsCles: MOTS_CLES_IA };
}

/** Échappe un texte pour un document XML/SVG. */
export { echapper };
