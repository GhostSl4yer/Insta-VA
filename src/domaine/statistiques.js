import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { dateDansFuseau, ajouterJours } from '../utils/temps.js';
import { OBJECTIF_AUDIENCE } from '../donnees/personas.js';
import { compteIdCourant } from './contexte.js';

/**
 * Statistiques réelles du compte.
 *
 * Les valeurs proviennent des publications et des insights Instagram stockés
 * localement. Sans données Instagram, les compteurs sont à zéro : aucune valeur
 * n'est extrapolée.
 */

const periodeEnJours = (periode) => (periode === 'jour' ? 1 : periode === 'semaine' ? 7 : 30);

export function calculerStatistiquesJour(date = dateDansFuseau(config.fuseau), details = {}) {
  const compteId = compteIdCourant() || '';
  const publications = tous(
    `SELECT * FROM publication WHERE compte_id = ? AND jour = ? AND statut = 'Publiee'`,
    compteId,
    date,
  );
  const somme = (cle) => publications.reduce((total, p) => total + (Number(p[cle]) || 0), 0);
  const stats = {
    date,
    vues: somme('vues'),
    portee: somme('portee'),
    likes: somme('likes'),
    commentaires: somme('commentaires'),
    abonnnesGagnes: 0,
    abonnesGagnes: 0,
    interactions: somme('likes') + somme('commentaires'),
    publications: publications.length,
    details,
  };
  const id = uuid();
  executer(
    `INSERT INTO statistiques (id, compte_id, cycle_id, periode, date, vues, portee, abonnes_gagnes,
       likes, commentaires, interactions, publications, details)
     VALUES (?, ?, ?, 'jour', ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    id,
    compteId,
    publications[0]?.cycle_id ?? null,
    date,
    stats.vues,
    stats.portee,
    stats.likes,
    stats.commentaires,
    stats.interactions,
    stats.publications,
    JSON.stringify(details),
  );
  delete stats.abonnnesGagnes;
  return stats;
}

export function statistiquesDuJour(date) {
  return un(
    'SELECT * FROM statistiques WHERE compte_id = ? AND date = ? ORDER BY rowid DESC LIMIT 1',
    compteIdCourant() || '',
    date,
  );
}

function lignesPeriode(periode = 'mois') {
  const fin = dateDansFuseau(config.fuseau);
  const debut = ajouterJours(fin, -(periodeEnJours(periode) - 1));
  return {
    debut,
    fin,
    lignes: tous(
      'SELECT * FROM statistiques WHERE compte_id = ? AND date BETWEEN ? AND ? ORDER BY date',
      compteIdCourant() || '',
      debut,
      fin,
    ),
  };
}

export function agregerPeriode({ periode = 'mois' } = {}) {
  const { lignes, debut, fin } = lignesPeriode(periode);
  const somme = (cle) => lignes.reduce((total, l) => total + (Number(l[cle]) || 0), 0);
  const publications = somme('publications');
  const interactions = somme('interactions');
  const portee = somme('portee');
  return {
    periode,
    debut,
    fin,
    jours: lignes.length,
    portee,
    vues: somme('vues'),
    likes: somme('likes'),
    commentaires: somme('commentaires'),
    interactions,
    abonnesGagnes: somme('abonnes_gagnes'),
    publications,
    moyennePortee: lignes.length ? Math.round(portee / lignes.length) : 0,
    moyenneVues: lignes.length ? Math.round(somme('vues') / lignes.length) : 0,
    engagement: portee ? Math.round((interactions / portee) * 1000) / 10 : 0,
  };
}

export function serieJournaliere({ jours = 30 } = {}) {
  const fin = dateDansFuseau(config.fuseau);
  const debut = ajouterJours(fin, -(Math.max(1, jours) - 1));
  const lignes = tous(
    'SELECT * FROM statistiques WHERE compte_id = ? AND date BETWEEN ? AND ? ORDER BY date',
    compteIdCourant() || '',
    debut,
    fin,
  );
  return lignes.map((l) => ({
    date: l.date,
    portee: l.portee,
    vues: l.vues,
    likes: l.likes,
    commentaires: l.commentaires,
    interactions: l.interactions,
    abonnesGagnes: l.abonnes_gagnes,
    publications: l.publications,
  }));
}

export function repartitionPays({ periode = 'mois' } = {}) {
  const { lignes } = lignesPeriode(periode);
  const cumul = {};
  for (const ligne of lignes) {
    let details = {};
    try {
      details = JSON.parse(ligne.details || '{}');
    } catch {
      details = {};
    }
    for (const pays of details.parPays || []) {
      cumul[pays.pays] = (cumul[pays.pays] || 0) + Number(pays.n || 0);
    }
  }
  const total = Object.values(cumul).reduce((s, n) => s + n, 0) || 1;
  return Object.entries(cumul)
    .map(([pays, n]) => ({ pays, n, part: Math.round((n / total) * 1000) / 10, autorise: true }))
    .sort((a, b) => b.n - a.n);
}

export function topPublications({ limite = 5, periode = 'mois' } = {}) {
  const { debut, fin } = lignesPeriode(periode);
  return tous(
    `SELECT p.*, c.chemin_public FROM publication p
     LEFT JOIN contenu_drive c ON c.id = p.contenu_id
     WHERE p.compte_id = ? AND p.statut = 'Publiee' AND p.jour BETWEEN ? AND ?
     ORDER BY (p.likes + p.commentaires) DESC, p.portee DESC LIMIT ?`,
    compteIdCourant() || '',
    debut,
    fin,
    limite,
  ).map((p) => ({
    id: p.id,
    jour: p.jour,
    type: p.type,
    extrait: p.contenu,
    likes: p.likes,
    commentaires: p.commentaires,
    portee: p.portee,
    image: p.chemin_public || null,
  }));
}

export function courbeAbonnes({ jours = 30 } = {}) {
  return serieJournaliere({ jours }).map((l) => ({ date: l.date, valeur: l.abonnesGagnes }));
}

export function kpisGlobaux() {
  const compteId = compteIdCourant() || '';
  const total = un(
    `SELECT COALESCE(SUM(abonnes_gagnes), 0) AS abonnes, COALESCE(SUM(publications), 0) AS publications
     FROM statistiques WHERE compte_id = ?`,
    compteId,
  ) || { abonnes: 0, publications: 0 };
  return {
    abonnes: total.abonnes,
    publications: total.publications,
    cibleEngagement: OBJECTIF_AUDIENCE.tauxEngagementCible,
    progressionAbonnes: Math.min(
      100,
      Math.round((total.abonnes / Math.max(1, OBJECTIF_AUDIENCE.abonnesCible)) * 100),
    ),
  };
}
