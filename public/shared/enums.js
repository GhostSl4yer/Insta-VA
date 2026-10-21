/**
 * Énumérations du système — miroir du diagramme de classes.
 * Ce module est chargé tel quel par le navigateur (ES module) et par Node.
 */

export const PAYS_AUTORISES = Object.freeze([
  'USA',
  'France',
  'RoyaumeUni',
  'Allemagne',
  'Pologne',
  'AutresPays',
]);

export const LIBELLES_PAYS = Object.freeze({
  USA: 'États-Unis',
  France: 'France',
  RoyaumeUni: 'Royaume-Uni',
  Allemagne: 'Allemagne',
  Pologne: 'Pologne',
  AutresPays: 'Autres pays (liste fournie)',
  HorsZone: 'Hors zone autorisée',
});

export const TYPE_PAYS = Object.freeze({
  USA: { libelle: 'États-Unis', icone: '🇺🇸', heures: [18, 22], poids: 0.42 },
  France: { libelle: 'France', icone: '🇫🇷', heures: [17, 21], poids: 0.16 },
  RoyaumeUni: { libelle: 'Royaume-Uni', icone: '🇬🇧', heures: [17, 21], poids: 0.13 },
  Allemagne: { libelle: 'Allemagne', icone: '🇩🇪', heures: [17, 21], poids: 0.11 },
  Pologne: { libelle: 'Pologne', icone: '🇵🇱', heures: [17, 21], poids: 0.08 },
  AutresPays: { libelle: 'Autres pays', icone: '🌍', heures: [16, 22], poids: 0.10 },
});

export const TYPE_PAYS_HORS_ZONE = Object.freeze({
  libelle: 'Hors zone',
  icone: '🚫',
  heures: [16, 23],
  poids: 0,
});

export const GENRES = Object.freeze([
  'Femme',
  'Homme',
  'NonBinaire',
  'NonPrecise',
]);

export const TYPE_CONTENU = Object.freeze({
  PhotoProfil: { libelle: 'Photo de profil', dossier: 'photos' },
  Story: { libelle: 'Story', dossier: 'stories' },
  Reel: { libelle: 'Reel', dossier: 'reels' },
  UnePleine: { libelle: 'Une (publication unique)', dossier: 'photos' },
});

export const STATUT_CONTENU = Object.freeze({
  Telecharge: 'Téléchargé',
  Planifie: 'Planifié',
  Publie: 'Publié',
  Archive: 'Archivé',
  Echec: 'Échec',
});

export const STATUT_PUBLICATION = Object.freeze({
  Planifiee: 'Planifiée',
  EnCours: 'En cours',
  Publiee: 'Publiée',
  Echec: 'Échec',
  Supprimee: 'Supprimée',
});

export const STATUT_CYCLE = Object.freeze({
  NonCommence: 'Non commencé',
  EnCours: 'En cours',
  EnPause: 'En pause',
  Termine: 'Terminé',
  Relance: 'Relancé',
});

export const TYPE_INTERACTION = Object.freeze({
  Like: 'Like',
  Commentaire: 'Commentaire',
  Visionnage: 'Visionnage',
  Suivi: 'Suivi',
});

export const AUTORISATION_MESSAGE_GROUPE = Object.freeze({
  Like: true,
  Commentaire: true,
  Visionnage: true,
  Suivi: true,
});

/** Extensions du diagramme (canvas « cible / veille / journal »). */
export const STATUT_CANDIDAT = Object.freeze({
  Nouveau: 'Nouveau',
  Analyse: 'Analysé',
  Qualifie: 'Qualifié',
  Rejete: 'Rejeté',
  Suivi: 'Suivi',
});

export const PRIORITE = Object.freeze({ Urgente: 'Urgente', Haute: 'Haute', Normale: 'Normale', Basse: 'Basse' });

export const SEVERITE = Object.freeze({ Info: 'Info', Avertissement: 'Avertissement', Critique: 'Critique' });

export const TYPE_ANOMALIE = Object.freeze({
  BlocageRestriction: 'Blocage / restriction',
  EchecPublication: 'Échec de publication',
  LimiteAtteinte: 'Limite atteinte',
  VisionnageInsuffisant: 'Visionnage insuffisant',
  SourceIndisponible: 'Source indisponible',
  DepassementHoraire: 'Dépassement horaire',
  CycleIncomplet: 'Cycle incomplet',
});

export const STATUT_ANOMALIE = Object.freeze({ Ouverte: 'Ouverte', EnCours: 'En cours', Resolue: 'Résolue' });

export const STATUT_EXECUTION = Object.freeze({
  Planifie: 'Planifié',
  EnCours: 'En cours',
  Effectue: 'Effectué',
  Reporte: 'Reporté',
  Ignore: 'Ignoré',
  Echec: 'Échec',
  Suspendu: 'Suspendu',
});

export const ETAPES_FLUX = Object.freeze([
  'Initialisation du compte',
  'Préparation de la journée',
  'Publication (16h → 00h)',
  'Visionnage (≥ 30 min)',
  'Interactions (like / commentaire / suivi)',
  'Statistiques & rapport du jour',
  'Clôture de la journée',
]);

export const OBJECTIF = Object.freeze({
  ageMinimum: 25,
  dureeCycleJours: 30,
  sessionsParJour: 2,
  visionnageMinParJour: 30 * 60,
  visionnageMaxParJour: 38 * 60,
  interactionsMinParJour: 48,
  interactionsMaxParJour: 92,
  followsMinParSujet: 0,
  followsMaxParSujet: 1,
  heuresEntrePublications: 2,
  commentairesParHeureMax: 8,
  likesParHeureMax: 26,
});

export const REGLES = Object.freeze([
  { id: 'R1', texte: 'Configuration manuelle du profil (photo, bio, nom, lien) — une seule fois.' },
  { id: 'R2', texte: 'Cycle quotidien de 16 h à 00 h (2 sessions : 16 h–20 h et 20 h–00 h).' },
  { id: 'R3', texte: 'Visionnage de vidéos : 30 min minimum par jour et par compte.' },
  { id: 'R4', texte: 'Interactions uniquement sur les commentaires (pas de messages privés).' },
  { id: 'R5', texte: 'Publication planifiée obligatoire (pas de spam).' },
  { id: 'R6', texte: 'Suivi de comptes de référence ≥ leurs abonnés (12–25 % du volume).' },
  { id: 'R7', texte: 'Statistiques : uniquement les pays autorisés (USA, France, Royaume-Uni, Allemagne, Pologne + autres pays fournis).' },
  { id: 'R8', texte: 'Aucune publication pendant les heures interdites (00 h → 16 h).' },
  { id: 'R9', texte: 'Âge minimum : 25 ans — aucun compte hors zone ou mineur n’est traité.' },
  { id: 'R10', texte: 'À la fin du cycle de 30 jours : relancement automatique (même compte, même historique).' },
]);

export const STATUT_COMPTE = Object.freeze({
  Configure: 'Configuré',
  NonConfigure: 'Non configuré',
});

export function libelle(enumObj, valeur) {
  return enumObj[valeur] || String(valeur);
}
