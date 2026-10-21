import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { creerAlea, arrondi } from '../utils/alea.js';
import { ajouterJours } from '../utils/temps.js';
import { OBJECTIF, PAYS_AUTORISES } from '../../public/shared/enums.js';
import { OBJECTIF_AUDIENCE } from '../donnees/personas.js';
import { obtenirParametres } from './audience.js';

function mapperStat(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    date: ligne.date,
    cycleId: ligne.cycle_id,
    periode: ligne.periode,
    vues: ligne.vues,
    portee: ligne.portee,
    abonnesGagnes: ligne.abonnes_gagnes,
    likes: ligne.likes,
    commentaires: ligne.commentaires,
    interactions: ligne.interactions,
    publications: ligne.publications,
    details: JSON.parse(ligne.details || '{}'),
  };
}

export function statistiquesDuJour(date) {
  return mapperStat(un(`SELECT * FROM statistiques WHERE date = ? AND periode = 'jour'`, date));
}

export function serieJournaliere({ jours = 30 } = {}) {
  const lignes = tous(
    `SELECT * FROM statistiques WHERE periode = 'jour' ORDER BY date DESC LIMIT ?`,
    Math.max(1, jours),
  ).map(mapperStat);
  return lignes.reverse();
}

/**
 * Calcule et enregistre les statistiques de la journée à partir des
 * publications et interactions réellement produites par le moteur.
 */
export function calculerStatistiquesJour({ cycle, date, compte, visionnageSecondes = 0 }) {
  const pubs = tous(
    `SELECT * FROM publication WHERE jour = ? AND statut = 'Publiee'`,
    date,
  );
  const interactions = un(
    `SELECT
       SUM(CASE WHEN session_id IS NULL AND type = 'Like' THEN 1 ELSE 0 END) AS likes,
       SUM(CASE WHEN session_id IS NULL AND type = 'Commentaire' THEN 1 ELSE 0 END) AS commentaires,
       COUNT(*) AS total
     FROM interaction WHERE date = ?`,
    date,
  );
  const sortantes = un(`SELECT COUNT(*) AS n FROM interaction WHERE date = ? AND session_id IS NOT NULL`, date)?.n ?? 0;
  const suivis = un(
    `SELECT COUNT(*) AS n FROM interaction WHERE date = ? AND session_id IS NOT NULL AND type = 'Suivi'`,
    date,
  )?.n ?? 0;
  const references = un(
    `SELECT COUNT(*) AS n FROM interaction WHERE date = ? AND session_id IS NOT NULL AND reference = 1`,
    date,
  )?.n ?? 0;

  const vues = pubs.reduce((s, p) => s + p.vues, 0);
  const portee = pubs.reduce((s, p) => s + p.portee, 0);
  const likes = interactions?.likes ?? 0;
  const commentaires = interactions?.commentaires ?? 0;

  const alea = creerAlea(Date.parse(`${date}T20:00:00Z`) % 2147483647);
  const abonnesGagnes = Math.max(
    0,
    Math.round(pubs.length * alea.entre(1.2, 3.4) + likes * alea.entre(0.012, 0.03) + suivis * 0.8 + alea.entre(2, 9)),
  );

  const parPays = tous(
    `SELECT auteur_pays AS pays, COUNT(*) AS n FROM interaction WHERE date = ? AND auteur_pays != ''
     GROUP BY auteur_pays ORDER BY n DESC`,
    date,
  );
  const paysAutorises = obtenirParametres().paysAutorises;
  const details = {
    visionnageSecondes,
    visionnageMin: Math.round(visionnageSecondes / 60),
    objectifVisionnageMin: OBJECTIF.visionnageMinParJour,
    sortantes,
    suivis,
    references,
    parPays,
    paysAutorises,
    publications: pubs.map((p) => ({ id: p.id, type: p.type, likes: p.likes, commentaires: p.commentaires, vues: p.vues })),
    objectifAudience: OBJECTIF_AUDIENCE,
  };

  executer(`DELETE FROM statistiques WHERE date = ? AND periode = 'jour'`, date);
  const id = uuid();
  executer(
    `INSERT INTO statistiques
      (id, compte_id, cycle_id, periode, date, vues, portee, abonnes_gagnes, likes, commentaires, interactions, publications, details)
     VALUES (?, ?, ?, 'jour', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    compte.id,
    cycle?.id ?? null,
    date,
    vues,
    portee,
    abonnesGagnes,
    likes,
    commentaires,
    sortantes + likes + commentaires,
    pubs.length,
    JSON.stringify(details),
  );
  return statistiquesDuJour(date);
}

export function agregerPeriode({ periode = 'jour', date = null } = {}) {
  const aujourdHui = date || new Date().toISOString().slice(0, 10);
  let debut = aujourdHui;
  let jours = 1;
  if (periode === 'semaine') {
    debut = ajouterJours(aujourdHui, -6);
    jours = 7;
  } else if (periode === 'mois' || periode === 'cycle') {
    debut = ajouterJours(aujourdHui, -29);
    jours = 30;
  }
  const lignes = tous(
    `SELECT * FROM statistiques WHERE periode = 'jour' AND date BETWEEN ? AND ? ORDER BY date`,
    debut,
    aujourdHui,
  ).map(mapperStat);
  const cumul = lignes.reduce(
    (acc, l) => ({
      vues: acc.vues + l.vues,
      portee: acc.portee + l.portee,
      abonnesGagnes: acc.abonnesGagnes + l.abonnesGagnes,
      likes: acc.likes + l.likes,
      commentaires: acc.commentaires + l.commentaires,
      interactions: acc.interactions + l.interactions,
      publications: acc.publications + l.publications,
    }),
    { vues: 0, portee: 0, abonnesGagnes: 0, likes: 0, commentaires: 0, interactions: 0, publications: 0 },
  );
  const engagement = cumul.portee > 0 ? arrondi(((cumul.likes + cumul.commentaires) / cumul.portee) * 100, 2) : 0;
  return {
    periode,
    debut,
    fin: aujourdHui,
    jours,
    ...cumul,
    engagement,
    serie: lignes,
    moyennePortee: lignes.length ? Math.round(cumul.portee / lignes.length) : 0,
    moyenneVues: lignes.length ? Math.round(cumul.vues / lignes.length) : 0,
  };
}

export function repartitionPays({ periode = 'mois' } = {}) {
  const jours = periode === 'jour' ? 1 : periode === 'semaine' ? 7 : 30;
  const debut = ajouterJours(new Date().toISOString().slice(0, 10), -(jours - 1));
  const lignes = tous(
    `SELECT auteur_pays AS pays, COUNT(*) AS n FROM interaction
     WHERE date >= ? AND auteur_pays != '' GROUP BY auteur_pays ORDER BY n DESC`,
    debut,
  );
  const total = lignes.reduce((s, l) => s + l.n, 0) || 1;
  return lignes.map((l) => ({
    pays: l.pays,
    valeur: l.n,
    pourcentage: arrondi((l.n / total) * 100, 1),
    autorise: PAYS_AUTORISES.includes(l.pays),
  }));
}

export function kpisGlobaux() {
  const total = un(
    `SELECT
       COUNT(*) AS publications,
       COALESCE(SUM(likes), 0) AS likes,
       COALESCE(SUM(commentaires), 0) AS commentaires,
       COALESCE(SUM(vues), 0) AS vues,
       COALESCE(SUM(portee), 0) AS portee
     FROM publication WHERE statut = 'Publiee'`,
  );
  const stats = un(
    `SELECT COALESCE(SUM(abonnes_gagnes), 0) AS abonnes, COALESCE(SUM(interactions), 0) AS interactions
     FROM statistiques WHERE periode = 'jour'`,
  );
  const abonnes = 480 + (stats?.abonnes ?? 0);
  const engagement = total.portee > 0 ? arrondi(((total.likes + total.commentaires) / total.portee) * 100, 2) : 0;
  const semaine = agregerPeriode({ periode: 'semaine' });
  const suivis = un('SELECT COUNT(*) AS n FROM abonnement WHERE actif = 1')?.n ?? 0;
  return {
    abonnes,
    abonnesGagnesCycle: stats?.abonnes ?? 0,
    publications: total.publications,
    likes: total.likes,
    commentaires: total.commentaires,
    vues: total.vues,
    portee: total.portee,
    engagement,
    interactions: stats?.interactions ?? 0,
    suivis,
    semaine,
    cibleAbonnes: OBJECTIF_AUDIENCE.abonnesCible,
    cibleEngagement: OBJECTIF_AUDIENCE.tauxEngagementCible,
    progressionAbonnes: Math.min(100, arrondi((abonnes / OBJECTIF_AUDIENCE.abonnesCible) * 100, 1)),
  };
}

export function courbeAbonnes({ jours = 30 } = {}) {
  const serie = serieJournaliere({ jours });
  let cumul = 480;
  return serie.map((ligne) => {
    cumul += ligne.abonnesGagnes;
    return { date: ligne.date, abonnes: cumul, gagnes: ligne.abonnesGagnes };
  });
}

export function topPublications({ limite = 5, periode = 'mois' } = {}) {
  const jours = periode === 'jour' ? 1 : periode === 'semaine' ? 7 : 30;
  const debut = ajouterJours(new Date().toISOString().slice(0, 10), -(jours - 1));
  return tous(
    `SELECT p.*, c.chemin_public, c.theme FROM publication p
     LEFT JOIN contenu_drive c ON c.id = p.contenu_id
     WHERE p.statut = 'Publiee' AND p.jour >= ?
     ORDER BY (p.likes + p.commentaires * 3 + p.portee * 0.05) DESC LIMIT ?`,
    debut,
    limite,
  ).map((l) => ({
    id: l.id,
    type: l.type,
    theme: l.theme,
    jour: l.jour,
    likes: l.likes,
    commentaires: l.commentaires,
    vues: l.vues,
    portee: l.portee,
    extrait: String(l.contenu || '').split('\n')[0].slice(0, 90),
    image: l.chemin_public ? `/media/${l.chemin_public.split('/').map(encodeURIComponent).join('/')}` : null,
  }));
}

export { PAYS_AUTORISES };
