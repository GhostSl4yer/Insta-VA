import { executer, tous, un } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { creerAlea, borner, arrondi } from '../utils/alea.js';
import { PERSONAS, COMPTES_REFERENCE, PRENOMS, NOMS, PREFIXES_PSEUDO, SUFFIXES_PSEUDO } from '../donnees/personas.js';
import { LANGUE_PAR_PAYS } from '../donnees/commentaires.js';
import { verifierDisponibilite, obtenirParametres } from './audience.js';
import { journaliser } from './journal.js';

const PAYS_POIDS = { USA: 0.4, France: 0.16, RoyaumeUni: 0.14, Allemagne: 0.1, Pologne: 0.07, AutresPays: 0.075, HorsZone: 0.055 };

function mapper(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    username: ligne.username,
    nomAffichage: ligne.nom_affichage,
    bio: ligne.bio,
    pays: ligne.pays,
    genre: ligne.genre,
    trancheAge: ligne.tranche_age,
    age: ligne.age,
    interets: JSON.parse(ligne.interets || '[]'),
    nombreAbonnes: ligne.nombre_abonnes,
    abonnesPrecedents: ligne.nombre_abonnes_precedent,
    scoreAttractivite: ligne.score_attractivite,
    statut: ligne.statut,
    motifStatut: ligne.motif_statut,
    estReference: Boolean(ligne.est_compte_reference),
    referenceId: ligne.reference_id,
    derniereAnalyse: ligne.derniere_analyse,
    langue: LANGUE_PAR_PAYS[ligne.pays] || 'en',
    croissance: ligne.nombre_abonnes_precedent
      ? arrondi(((ligne.nombre_abonnes - ligne.nombre_abonnes_precedent) / ligne.nombre_abonnes_precedent) * 100, 1)
      : 0,
  };
}

function tirerPoids(alea, poids) {
  const r = alea();
  let cumul = 0;
  for (const [cle, valeur] of Object.entries(poids)) {
    cumul += valeur;
    if (r <= cumul) return cle;
  }
  return Object.keys(poids)[0];
}

function insererCible(cible) {
  executer(
    `INSERT OR IGNORE INTO cible
      (id, username, nom_affichage, bio, pays, genre, tranche_age, age, interets,
       nombre_abonnes, nombre_abonnes_precedent, score_attractivite, statut, motif_statut,
       est_compte_reference, reference_id, derniere_analyse, created_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    cible.id,
    cible.username,
    cible.nomAffichage,
    cible.bio,
    cible.pays,
    cible.genre,
    cible.trancheAge,
    cible.age,
    JSON.stringify(cible.interets),
    cible.nombreAbonnes,
    cible.abonnesPrecedents,
    cible.score,
    cible.statut,
    cible.motif,
    cible.estReference ? 1 : 0,
    cible.referenceId ?? null,
    cible.derniereAnalyse ?? null,
    cible.createdLe ?? new Date().toISOString(),
  );
}

function ageDepuisTranche(alea, tranche) {
  const [min, max] = tranche.split('-').map(Number);
  return alea.entier(min, max);
}

export function genererCibles({ nombre = 160, graine = 20261021 } = {}) {
  const alea = creerAlea(graine);
  const dejaVus = new Set(tous('SELECT username FROM cible').map((l) => l.username));
  const generees = [];
  let garde = 0;
  while (generees.length < nombre && garde < nombre * 8) {
    garde += 1;
    const persona = PERSONAS[Math.floor(alea() * PERSONAS.length)];
    let pays = tirerPoids(alea, PAYS_POIDS);
    // 5 % de profils hors zone / 7 % mineurs : ils illustrent le filtrage R7/R9.
    if (pays === 'HorsZone') pays = alea.choisir(['Brésil', 'Inde', 'Nigeria', 'Mexique', 'Indonésie']);
    const tranche = alea.probabilite(0.13) ? '18-24' : alea.choisir(persona.tranches);
    const prenom = alea.choisir(PRENOMS[pays] || PRENOMS.AutresPays);
    const nom = alea.choisir(NOMS[pays] || NOMS.AutresPays);
    const base = prenom.toLowerCase().replace(/[^a-z]/g, '');
    const suffixe = alea.choisir(SUFFIXES_PSEUDO);
    const motif = alea.entier(0, 3);
    let username =
      motif === 0 ? `${base}.${suffixe}`
      : motif === 1 ? `${alea.choisir(PREFIXES_PSEUDO)}${base}${suffixe}`
      : motif === 2 ? `${base}_${suffixe}`
      : `${base}${alea.entier(1, 99)}`;
    username = username.slice(0, 28);
    if (dejaVus.has(username)) continue;
    dejaVus.add(username);

    const [minAb, maxAb] = persona.tailleCompte;
    const abonnes = alea.entier(minAb, maxAb);
    const croissance = alea.entre(-1.5, 9.5);
    const precedents = Math.max(500, Math.round(abonnes / (1 + croissance / 100)));
    const interets = [...new Set([alea.choisir(persona.interets), alea.choisir(persona.interets), alea.choisir(persona.interets)])];
    const genre = alea.choisir(['Femme', 'Femme', 'Homme', 'NonPrecise']);
    const cible = {
      id: uuid(),
      username,
      nomAffichage: `${prenom} ${nom}`,
      bio: `${alea.choisir(persona.interets)} · ${pays}${alea.probabilite(0.35) ? ' · coach' : ''}`,
      pays,
      genre,
      trancheAge: tranche,
      age: ageDepuisTranche(alea, tranche),
      interets,
      nombreAbonnes: abonnes,
      abonnesPrecedents: precedents,
      score: 0,
      statut: 'Nouveau',
      motif: '',
      estReference: false,
      referenceId: persona.id,
      createdLe: new Date().toISOString(),
    };
    insererCible(cible);
    generees.push(cible);
  }
  return generees;
}

export function genererReferences() {
  const alea = creerAlea(777);
  const existants = new Set(tous('SELECT username FROM cible').map((l) => l.username));
  const crees = [];
  for (const ref of COMPTES_REFERENCE) {
    if (existants.has(ref.username)) continue;
    const [min, max] = ref.abonnes;
    const abonnes = alea.entier(min, max);
    const cible = {
      id: uuid(),
      username: ref.username,
      nomAffichage: ref.nomAffichage,
      bio: ref.bio,
      pays: ref.pays,
      genre: 'NonPrecise',
      trancheAge: '25-34',
      age: alea.entier(25, 34),
      interets: [ref.categorie],
      nombreAbonnes: abonnes,
      abonnesPrecedents: Math.round(abonnes / 1.035),
      score: 0,
      statut: 'Qualifie',
      motif: 'Compte de référence',
      estReference: true,
      referenceId: null,
      createdLe: new Date().toISOString(),
    };
    insererCible(cible);
    crees.push(cible);
  }
  return crees;
}

export function assurerCibles() {
  const total = un('SELECT COUNT(*) AS n FROM cible')?.n ?? 0;
  // Production sans interactions : aucune cible n'est générée.
  if (!config.interactionsActives) return total;
  if (total < 20) {
    genererReferences();
    genererCibles({ nombre: Math.max(0, 170 - total) });
    analyserToutesCibles();
    journaliser('Base de cibles initialisée (comptes de référence + audience potentielle).', {
      categorie: 'cibles',
    });
  }
  return total;
}

export function scoreCible(cible) {
  const parametres = obtenirParametres();
  // Correspondance avec les personas
  let meilleur = 0;
  for (const persona of PERSONAS) {
    const communs = cible.interets.filter((i) => persona.interets.includes(i)).length;
    const score = Math.min(1, communs / 2) * persona.poids * 2.4;
    meilleur = Math.max(meilleur, score);
  }
  // Taille de compte : sweet spot 8k – 120k
  const taille = Math.log10(Math.max(100, cible.nombreAbonnes));
  const tailleScore = borner(1 - Math.abs(taille - 4.6) / 2.2, 0, 1);
  // Croissance
  const croissance = cible.abonnesPrecedents
    ? (cible.nombreAbonnes - cible.abonnesPrecedents) / cible.abonnesPrecedents
    : 0;
  const croissanceScore = borner((croissance + 0.02) / 0.1, 0, 1);
  // Pays
  const paysScore = parametres.paysAutorises.includes(cible.pays) ? 1 : 0;
  // Affinité thématique avec l'avatar (fitness / nutrition / bien-être / IA)
  const affinites = ['fitness', 'nutrition', 'running', 'bien-être', 'bienetre', 'IA', 'musculation', 'recettes', 'meal prep', 'mindset', 'bien-être'];
  const affinite = cible.interets.some((i) => affinites.includes(i)) ? 1 : 0.3;

  const score =
    (meilleur * 22 +
      tailleScore * 18 +
      croissanceScore * 12 +
      paysScore * 26 +
      affinite * 22) *
    (cible.estReference ? 1.15 : 1);
  return arrondi(borner(score, 0, 100), 1);
}

export function analyserCible(id) {
  const ligne = un('SELECT * FROM cible WHERE id = ?', id);
  if (!ligne) return null;
  const cible = mapper(ligne);
  const { disponible, raisons } = verifierDisponibilite(cible);
  const score = scoreCible(cible);
  let statut = ligne.statut;
  let motif = ligne.motif_statut;
  if (!disponible) {
    statut = 'Rejete';
    motif = raisons.join(' · ');
  } else if (score >= 62) {
    statut = 'Qualifie';
    motif = `Score ${score}/100 · ${cible.trancheAge} ans · ${cible.pays}`;
  } else if (score >= 45) {
    statut = 'Analyse';
    motif = `Score ${score}/100 · à surveiller`;
  } else {
    statut = 'Rejete';
    motif = `Score trop faible (${score}/100)`;
  }
  if (cible.estReference && disponible) {
    statut = 'Qualifie';
    motif = 'Compte de référence prioritaire (R6)';
  }
  executer(
    'UPDATE cible SET score_attractivite = ?, statut = ?, motif_statut = ?, derniere_analyse = ? WHERE id = ?',
    score,
    statut,
    motif,
    new Date().toISOString(),
    id,
  );
  return { ...cible, scoreAttractivite: score, statut, motifStatut: motif };
}

export function analyserToutesCibles() {
  return tous('SELECT id FROM cible').map((l) => analyserCible(l.id)).filter(Boolean);
}

export function listerCibles({ statut, pays, reference, recherche, limite = 200, tri = 'score' } = {}) {
  const clauses = [];
  const params = [];
  if (statut) {
    clauses.push('statut = ?');
    params.push(statut);
  }
  if (pays) {
    clauses.push('pays = ?');
    params.push(pays);
  }
  if (reference === '1' || reference === true) clauses.push('est_compte_reference = 1');
  if (reference === '0' || reference === false) clauses.push('est_compte_reference = 0');
  if (recherche) {
    clauses.push('(username LIKE ? OR nom_affichage LIKE ? OR bio LIKE ?)');
    params.push(`%${recherche}%`, `%${recherche}%`, `%${recherche}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const ordre = tri === 'abonnes' ? 'nombre_abonnes DESC' : tri === 'recent' ? 'created_le DESC' : 'score_attractivite DESC';
  return tous(`SELECT * FROM cible ${where} ORDER BY ${ordre} LIMIT ?`, ...params, limite).map(mapper);
}

export function statistiquesCibles() {
  const lignes = tous('SELECT statut, COUNT(*) AS n FROM cible GROUP BY statut');
  const parPays = tous('SELECT pays, COUNT(*) AS n FROM cible GROUP BY pays ORDER BY n DESC');
  const total = lignes.reduce((somme, l) => somme + l.n, 0);
  return {
    total,
    parStatut: Object.fromEntries(lignes.map((l) => [l.statut, l.n])),
    parPays,
    references: un('SELECT COUNT(*) AS n FROM cible WHERE est_compte_reference = 1')?.n ?? 0,
    suivis: un('SELECT COUNT(*) AS n FROM compte_suivi')?.n ?? 0,
  };
}

/**
 * Sélection des cibles du jour : qualifiées, hors comptes déjà suivis,
 * avec priorité aux comptes de référence (R6) et aux scores élevés.
 */
export function choisirCiblesDuJour(nombre = 4, { dejaSuivis = new Set() } = {}) {
  const pool = tous(
    `SELECT * FROM cible WHERE statut = 'Qualifie' AND username NOT IN (SELECT username FROM compte_suivi)
     ORDER BY est_compte_reference DESC, score_attractivite DESC LIMIT 40`,
  ).map(mapper);
  const dispo = pool.filter((c) => !dejaSuivis.has(c.username));
  const references = dispo.filter((c) => c.estReference);
  const autres = dispo.filter((c) => !c.estReference);
  const choix = [];
  // 12 à 25 % de comptes de référence
  const quotaRef = Math.max(1, Math.round(nombre * 0.25));
  choix.push(...references.slice(0, quotaRef));
  for (const cible of autres) {
    if (choix.length >= nombre) break;
    choix.push(cible);
  }
  for (const cible of references.slice(quotaRef)) {
    if (choix.length >= nombre) break;
    choix.push(cible);
  }
  return choix.slice(0, nombre);
}

export function compterCiblesParStatut() {
  return Object.fromEntries(tous('SELECT statut, COUNT(*) AS n FROM cible GROUP BY statut').map((l) => [l.statut, l.n]));
}
