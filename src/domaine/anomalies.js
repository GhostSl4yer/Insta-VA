import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { journaliser, notifier } from './journal.js';
import { compteIdCourant } from './contexte.js';

const SEVERITES = ['Info', 'Avertissement', 'Critique'];

export function detecterAnomalie(type, message, options = {}) {
  const { severite = 'Avertissement', details = {}, cycleId = null } = options;
  const compteId = compteIdCourant() || '';
  const ouverteSimilaire = un(
    `SELECT * FROM anomalie WHERE type = ? AND statut != 'Resolue' AND message = ? AND compte_id = ?
      ORDER BY detectee_le DESC LIMIT 1`,
    type,
    message,
    compteId,
  );
  if (ouverteSimilaire) return { ...ouverteSimilaire, dejaOuverte: true };

  const id = uuid();
  const date = new Date().toISOString();
  executer(
    `INSERT INTO anomalie (id, type, severite, message, details, statut, detectee_le, cycle_id, compte_id)
     VALUES (?, ?, ?, ?, ?, 'Ouverte', ?, ?, ?)`,
    id,
    type,
    SEVERITES.includes(severite) ? severite : 'Avertissement',
    message,
    JSON.stringify(details),
    date,
    cycleId,
    compteId,
  );
  journaliser(`Anomalie détectée · ${type} : ${message}`, {
    niveau: severite === 'Critique' ? 'erreur' : 'alerte',
    categorie: 'anomalie',
    donnees: details,
    cycleId,
  });
  notifier({
    type: 'anomalie',
    titre: `Anomalie : ${type}`,
    message,
    niveau: severite,
    lien: '/#/anomalies',
  });
  return { id, type, severite, message, statut: 'Ouverte', detectee_le: date, details, dejaOuverte: false };
}

export function listerAnomalies({ statut, severite, limite = 100 } = {}) {
  const clauses = ['compte_id = ?'];
  const params = [compteIdCourant() || ''];
  if (statut) {
    clauses.push('statut = ?');
    params.push(statut);
  }
  if (severite) {
    clauses.push('severite = ?');
    params.push(severite);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return tous(`SELECT * FROM anomalie ${where} ORDER BY detectee_le DESC LIMIT ?`, ...params, limite).map((a) => ({
    ...a,
    details: JSON.parse(a.details || '{}'),
  }));
}

export function resoudreAnomalie(id, note = '') {
  const anomalie = un('SELECT * FROM anomalie WHERE id = ? AND compte_id = ?', id, compteIdCourant() || '');
  if (!anomalie) return null;
  const date = new Date().toISOString();
  executer(`UPDATE anomalie SET statut = 'Resolue', resolue_le = ? WHERE id = ? AND compte_id = ?`, date, id, compteIdCourant() || '');
  journaliser(`Anomalie résolue : ${anomalie.type}${note ? ` — ${note}` : ''}`, {
    categorie: 'anomalie',
    niveau: 'info',
  });
  return { ...anomalie, statut: 'Resolue', resolue_le: date };
}

export function prendreEnCharge(id) {
  return executer(
    `UPDATE anomalie SET statut = 'EnCours' WHERE id = ? AND statut = 'Ouverte' AND compte_id = ?`,
    id,
    compteIdCourant() || '',
  ).changes;
}

export function compterAnomaliesOuvertes() {
  return un(`SELECT COUNT(*) AS n FROM anomalie WHERE statut != 'Resolue' AND compte_id = ?`, compteIdCourant() || '')?.n ?? 0;
}
