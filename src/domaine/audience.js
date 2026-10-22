import { executer, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { PAYS_AUTORISES, GENRES, OBJECTIF } from '../../public/shared/enums.js';
import { journaliser } from './journal.js';
import { compteIdCourant, exigerCompte } from './contexte.js';

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

const AUDIENCE_PAR_DEFAUT = Object.freeze({
  id: null,
  agentId: null,
  compteId: null,
  ageMinimum: 25,
  paysAutorises: ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'],
  paysExclus: [],
  genre: 'NonPrecise',
  createdLe: null,
  majLe: null,
  parDefaut: true,
});

/**
 * L'audience est fournie par le responsable : aucun enregistrement n'est créé
 * d'office. Sans paramètres, les valeurs affichées sont celles du plancher légal.
 */
export function assurerParametres() {
  const compteId = compteIdCourant();
  const existant = compteId
    ? un('SELECT * FROM parametres_audience WHERE compte_id = ?', compteId)
    : un('SELECT * FROM parametres_audience WHERE compte_id = ?', '');
  if (existant) return mapper(existant);
  return { ...AUDIENCE_PAR_DEFAUT, compteId };
}

export function obtenirParametres() {
  return assurerParametres();
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
  const maintenant = new Date().toISOString();
  if (actuel.id) {
    executer(
      `UPDATE parametres_audience SET age_minimum = ?, pays_autorises = ?, pays_exclus = ?, genre = ?, maj_le = ?
        WHERE id = ? AND compte_id = ?`,
      ageMinimum,
      JSON.stringify(pays),
      JSON.stringify(paysExclus),
      genre,
      maintenant,
      actuel.id,
      exigerCompte(),
    );
  } else {
    executer(
      `INSERT INTO parametres_audience
        (id, agent_id, compte_id, age_minimum, pays_autorises, pays_exclus, genre, created_le, maj_le)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      uuid(),
      exigerCompte(),
      ageMinimum,
      JSON.stringify(pays),
      JSON.stringify(paysExclus),
      genre,
      maintenant,
      maintenant,
    );
  }
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
