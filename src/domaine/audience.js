import { executer, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { PAYS_AUTORISES, GENRES, OBJECTIF } from '../../public/shared/enums.js';
import { journaliser } from './journal.js';

function mapper(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    agentId: ligne.agent_id,
    compteId: ligne.compte_id,
    ageMinimum: ligne.age_minimum,
    paysAutorises: JSON.parse(ligne.pays_autorises || '[]'),
    paysExclus: JSON.parse(ligne.pays_exclus || '[]'),
    genre: ligne.genre,
    createdLe: ligne.created_le,
    majLe: ligne.maj_le,
  };
}

export function assurerParametres({ agentId = null, compteId = null } = {}) {
  const existant = un('SELECT * FROM parametres_audience LIMIT 1');
  if (existant) return mapper(existant);
  const id = uuid();
  const date = new Date().toISOString();
  const pays = ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'];
  executer(
    `INSERT INTO parametres_audience
      (id, agent_id, compte_id, age_minimum, pays_autorises, pays_exclus, genre, created_le, maj_le)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
    id,
    agentId,
    compteId,
    Math.max(OBJECTIF.ageMinimum, config.ageMinimum),
    JSON.stringify(pays),
    'NonPrecise',
    date,
    date,
  );
  journaliser('Paramètres d’audience initialisés (pays autorisés, âge minimum 25 ans).', {
    categorie: 'audience',
  });
  return mapper(un('SELECT * FROM parametres_audience WHERE id = ?', id));
}

export function obtenirParametres() {
  return mapper(un('SELECT * FROM parametres_audience LIMIT 1')) || assurerParametres();
}

/** `appliquer()` du diagramme : valide et enregistre les paramètres. */
export function configurerParametres(payload = {}) {
  const actuel = obtenirParametres();
  const pays = Array.isArray(payload.paysAutorises)
    ? [...new Set(payload.paysAutorises.filter((p) => PAYS_AUTORISES.includes(p)))]
    : actuel.paysAutorises;
  if (!pays.length) {
    const erreur = new Error('Au moins un pays autorisé est requis.');
    erreur.statut = 400;
    throw erreur;
  }
  const ageMinimum = Math.max(OBJECTIF.ageMinimum, Number(payload.ageMinimum ?? actuel.ageMinimum) || OBJECTIF.ageMinimum);
  const genre = GENRES.includes(payload.genre) ? payload.genre : actuel.genre;
  const paysExclus = Array.isArray(payload.paysExclus) ? payload.paysExclus.map(String).slice(0, 20) : actuel.paysExclus;
  executer(
    `UPDATE parametres_audience SET age_minimum = ?, pays_autorises = ?, pays_exclus = ?, genre = ?, maj_le = ? WHERE id = ?`,
    ageMinimum,
    JSON.stringify(pays),
    JSON.stringify(paysExclus),
    genre,
    new Date().toISOString(),
    actuel.id,
  );
  journaliser('Paramètres d’audience mis à jour.', {
    categorie: 'audience',
    donnees: { ageMinimum, pays, genre },
  });
  return obtenirParametres();
}

/** `verifierDisponibilite()` : la cible est-elle dans le périmètre autorisé ? */
export function verifierDisponibilite(profil = {}, parametres = obtenirParametres()) {
  const raisons = [];
  const age = Number(profil.age ?? 0);
  const pays = profil.pays || 'HorsZone';
  if (age > 0 && age < parametres.ageMinimum) {
    raisons.push(`Âge ${age} ans < minimum ${parametres.ageMinimum} ans`);
  }
  if (!parametres.paysAutorises.includes(pays)) {
    raisons.push(`Pays « ${pays} » hors zone autorisée`);
  }
  if (parametres.paysExclus.includes(pays)) {
    raisons.push(`Pays « ${pays} » explicitement exclu`);
  }
  if (parametres.genre !== 'NonPrecise' && profil.genre && profil.genre !== parametres.genre) {
    raisons.push(`Genre hors ciblage (${profil.genre})`);
  }
  return { disponible: raisons.length === 0, raisons };
}

export function sauvegarderParametres(payload) {
  return configurerParametres(payload);
}
