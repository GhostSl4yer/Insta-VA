/**
 * Données de référence de l'avatar IA et de son audience cible.
 * Toutes les valeurs sont réalistes mais fictives : aucun compte réel n'est manipulé.
 */
import { OBJECTIF, TYPE_PAYS } from '../../public/shared/enums.js';

export const AVATAR = Object.freeze({
  id: 'avatar-maya',
  nomComplet: 'Maya Rivera',
  username: 'maya.rivera.fit',
  nomInstagram: 'Maya Rivera · Coach',
  bio: 'Coach fitness & lifestyle 🌿\nProgrammes courts, résultats réels.\nMiami → monde entier\n👇 Découvre mon double IA',
  lienBio: 'https://tavia.app/avatar/maya',
  localisation: 'Miami, Floride, États-Unis',
  fuseau: 'America/New_York',
  genre: 'Femme',
  ageAffiche: 29,
  palettes: ['corail', 'menthe', 'nuit', 'sable', 'aurore'],
  signesParticuliers: 'Tatouage discret au poignet · sourire franc · lumière dorée',
});

export const AGENT_DEFAUT = Object.freeze({
  nom: 'Responsable',
  prenom: 'Aïcha',
  role: 'Responsable / Propriétaire',
  email: 'responsable@insta-va.local',
  statut: 'Actif',
});

/** Personas d'audience — chacun porte ses pays, ses intérêts et ses codes de langage. */
export const PERSONAS = Object.freeze([
  {
    id: 'fitness-urbain',
    nom: 'Fitness urbain',
    description: 'Actifs de 25 à 34 ans qui s’entraînent en salle ou en extérieur après le travail.',
    icone: '🏋️',
    poids: 0.34,
    interets: ['fitness', 'musculation', 'cardio', 'récupération', 'protéines'],
    tranches: ['25-34', '35-44'],
    pays: { USA: 0.45, France: 0.15, RoyaumeUni: 0.14, Allemagne: 0.1, Pologne: 0.08, AutresPays: 0.08 },
    tailleCompte: [9_000, 320_000],
  },
  {
    id: 'nutrition-saine',
    nom: 'Nutrition saine',
    description: 'Personnes qui cuisinent, comptent leurs protéines et cherchent des recettes rapides.',
    icone: '🥗',
    poids: 0.22,
    interets: ['nutrition', 'recettes', 'meal prep', 'protéines', 'détox'],
    tranches: ['25-34', '35-44'],
    pays: { USA: 0.4, France: 0.22, RoyaumeUni: 0.12, Allemagne: 0.1, Pologne: 0.08, AutresPays: 0.08 },
    tailleCompte: [4_000, 180_000],
  },
  {
    id: 'running-endurance',
    nom: 'Running & endurance',
    description: 'Coureurs de 25 à 44 ans, du 5 km au semi, à la recherche de plans d’entraînement.',
    icone: '🏃',
    poids: 0.18,
    interets: ['running', 'marathon', 'endurance', 'trail', 'PGC'],
    tranches: ['25-34', '35-44'],
    pays: { USA: 0.32, RoyaumeUni: 0.2, France: 0.16, Allemagne: 0.16, Pologne: 0.09, AutresPays: 0.07 },
    tailleCompte: [3_000, 150_000],
  },
  {
    id: 'bienetre-mental',
    nom: 'Bien-être & mental',
    description: 'Public de 30 à 44 ans : routines, sommeil, respiration, équilibre vie pro / vie perso.',
    icone: '🧘',
    poids: 0.16,
    interets: ['bien-être', 'méditation', 'sommeil', 'routine du matin', 'mindset'],
    tranches: ['25-34', '35-44'],
    pays: { USA: 0.33, RoyaumeUni: 0.18, Allemagne: 0.16, France: 0.16, Pologne: 0.09, AutresPays: 0.08 },
    tailleCompte: [2_000, 120_000],
  },
  {
    id: 'startup-tech',
    nom: 'Startup & IA',
    description: 'Curieux de technologie, d’IA et de productivité, 25 à 44 ans.',
    icone: '🤖',
    poids: 0.10,
    interets: ['IA', 'productivité', 'startup', 'outils', 'no-code'],
    tranches: ['25-34', '35-44'],
    pays: { USA: 0.52, France: 0.14, RoyaumeUni: 0.14, Allemagne: 0.1, Pologne: 0.05, AutresPays: 0.05 },
    tailleCompte: [10_000, 480_000],
  },
]);

export const PRENOMS = Object.freeze({
  USA: ['Jessica', 'Michael', 'Ashley', 'David', 'Emily', 'Chris', 'Sarah', 'Daniel', 'Rachel', 'Tyler', 'Megan', 'Brandon', 'Olivia', 'Ethan', 'Chloe', 'Jordan', 'Morgan', 'Tara'],
  France: ['Camille', 'Lucas', 'Léa', 'Théo', 'Manon', 'Hugo', 'Chloé', 'Nathan', 'Justine', 'Maxime', 'Élodie', 'Antoine', 'Sofia', 'Romain'],
  RoyaumeUni: ['Sophie', 'James', 'Emma', 'Oliver', 'Hannah', 'Jack', 'Grace', 'Harry', 'Lucy', 'Tom', 'Beth', 'Sam', 'Niamh', 'Callum'],
  Allemagne: ['Lena', 'Jonas', 'Anna', 'Lukas', 'Sophie', 'Felix', 'Marie', 'Max', 'Lea', 'Paul', 'Johanna', 'Nils'],
  Pologne: ['Zofia', 'Jakub', 'Julia', 'Michał', 'Anna', 'Piotr', 'Kasia', 'Krzysztof', 'Magda', 'Tomek', 'Ewa', 'Mateusz'],
  AutresPays: ['Diego', 'María', 'Giulia', 'Luca', 'Ayşe', 'Yusuf', 'Amara', 'Kwame', 'Nadia', 'Omar', 'Aya', 'Ravi'],
});

export const NOMS = Object.freeze({
  USA: ['Miller', 'Johnson', 'Lewis', 'Walker', 'Bennett', 'Hayes', 'Carter', 'Reilly', 'Foster', 'Parker', 'Reed', 'Brooks'],
  France: ['Martin', 'Bernard', 'Dubois', 'Leroy', 'Moreau', 'Girard', 'Fontaine', 'Rousseau', 'Lefèvre', 'Mercier'],
  RoyaumeUni: ['Smith', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Turner', 'Hughes', 'Wright', 'Clarke', 'Bennett'],
  Allemagne: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Klein'],
  Pologne: ['Nowak', 'Lewandowski', 'Wójcik', 'Kowalski', 'Zielińska', 'Szymański', 'Kaczmarek'],
  AutresPays: ['Garcia', 'Rossi', 'Silva', 'Yılmaz', 'Mensah', 'Diallo', 'Haddad', 'Patel'],
});

export const SUFFIXES_PSEUDO = Object.freeze([
  'fit', 'coach', 'daily', 'life', 'run', 'strong', 'mind', 'glow', 'moves', 'well',
  'fuel', 'fueled', 'flow', 'body', 'gains', 'train', 'eatclean', 'recovery', 'pace', 'roots',
  'studio', 'lab', 'project', 'journal', 'habit', 'balance', 'energy', 'active', 'plant', 'power',
]);

export const PREFIXES_PSEUDO = Object.freeze(['the', 'daily', 'just', 'real', 'my', 'go', 'stay', 'its']);

/** Comptes de référence à suivre (fictifs, cohérents avec la niche). */
export const COMPTES_REFERENCE = Object.freeze([
  { username: 'the.strengthlab', nomAffichage: 'The Strength Lab', pays: 'USA', categorie: 'fitness', abonnes: [180_000, 340_000], bio: 'Force & mobilité · programmes 3×/semaine' },
  { username: 'coach.ameliafit', nomAffichage: 'Amelia · Coach', pays: 'USA', categorie: 'fitness', abonnes: [95_000, 210_000], bio: 'Coach certifiée NASM · transformations réelles' },
  { username: 'proteinplate', nomAffichage: 'Protein Plate', pays: 'RoyaumeUni', categorie: 'nutrition', abonnes: [120_000, 260_000], bio: 'Recettes 20 g de protéines · batch cooking' },
  { username: 'lucie.runningclub', nomAffichage: 'Lucie Running Club', pays: 'France', categorie: 'running', abonnes: [70_000, 160_000], bio: 'Plan semi-marathon · 3 séances / semaine' },
  { username: 'mindsetshift.de', nomAffichage: 'Mindset Shift', pays: 'Allemagne', categorie: 'bien-être', abonnes: [55_000, 140_000], bio: 'Routine du matin · 10 minutes pour changer la journée' },
  { username: 'kasia.moves', nomAffichage: 'Kasia Moves', pays: 'Pologne', categorie: 'fitness', abonnes: [40_000, 110_000], bio: 'Trening w domu · 20 minut dziennie' },
  { username: 'thehealthengineer', nomAffichage: 'The Health Engineer', pays: 'USA', categorie: 'nutrition', abonnes: [200_000, 420_000], bio: 'Science du métabolisme, expliquée simplement' },
  { username: 'runwithtom', nomAffichage: 'Run With Tom', pays: 'RoyaumeUni', categorie: 'running', abonnes: [85_000, 190_000], bio: 'Londres · marathon de Berlin 2025' },
  { username: 'clara.wellstudio', nomAffichage: 'Clara · Well Studio', pays: 'France', categorie: 'bien-être', abonnes: [60_000, 130_000], bio: 'Yoga, respiration, sommeil profond' },
  { username: 'brave.new.body', nomAffichage: 'Brave New Body', pays: 'Allemagne', categorie: 'fitness', abonnes: [110_000, 240_000], bio: 'Krafttraining ohne Drama · 3× pro Woche' },
  { username: 'themorningritual', nomAffichage: 'The Morning Ritual', pays: 'USA', categorie: 'bien-être', abonnes: [150_000, 300_000], bio: 'Rituels de 5 minutes pour démarrer fort' },
  { username: 'tavia.labs', nomAffichage: 'TAVIA Labs', pays: 'USA', categorie: 'IA', abonnes: [25_000, 90_000], bio: 'Avatars IA · ton jumeau digital, en ligne' },
]);

/** Le lien externe que l’avatar doit promouvoir (sans sortie de plateforme non autorisée). */
export const LIEN_EXTERNE = Object.freeze({
  url: 'https://tavia.app/avatar/maya',
  libelle: 'tavia.app/avatar/maya',
  description: 'Page de l’avatar IA (TAVIA) — démo, tarifs et prise de contact.',
});

export const OBJECTIF_AUDIENCE = Object.freeze({
  abonnesCible: 1_200,
  tauxEngagementCible: 5.5,
  porteeCible: 22_000,
  commentairesCible: 420,
});

export { OBJECTIF, TYPE_PAYS };
