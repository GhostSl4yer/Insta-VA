import { executer, tous, un } from '../db.js';
import { identifiant, uuid } from '../utils/ids.js';
import { compteIdCourant } from './contexte.js';

/** Journal d'événements (canvas « journal / traçabilité »). */
export function journaliser(message, options = {}) {
  const {
    niveau = 'info',
    categorie = 'systeme',
    donnees = {},
    jour = null,
    cycleId = null,
  } = options;
  const id = uuid();
  const ts = new Date().toISOString();
  executer(
    `INSERT INTO journal_evenement (id, ts, niveau, categorie, message, donnees, jour, cycle_id, compte_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ts,
    niveau,
    categorie,
    String(message),
    JSON.stringify(donnees ?? {}),
    jour,
    cycleId,
    compteIdCourant() || '',
  );
  return { id, ts, niveau, categorie, message, donnees, jour, cycleId };
}

export function listerJournal({ limite = 80, niveau, categorie, jour, cycleId, recherche } = {}) {
  const clauses = ['compte_id = ?'];
  const params = [compteIdCourant() || ''];
  if (niveau) {
    clauses.push('niveau = ?');
    params.push(niveau);
  }
  if (categorie) {
    clauses.push('categorie = ?');
    params.push(categorie);
  }
  if (jour) {
    clauses.push('jour = ?');
    params.push(jour);
  }
  if (cycleId) {
    clauses.push('cycle_id = ?');
    params.push(cycleId);
  }
  if (recherche) {
    clauses.push('message LIKE ?');
    params.push(`%${recherche}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return tous(`SELECT * FROM journal_evenement ${where} ORDER BY ts DESC LIMIT ?`, ...params, Math.min(500, limite)).map(
    (ligne) => ({
      id: ligne.id,
      ts: ligne.ts,
      niveau: ligne.niveau,
      categorie: ligne.categorie,
      message: ligne.message,
      donnees: JSON.parse(ligne.donnees || '{}'),
      jour: ligne.jour,
    }),
  );
}

export function compterJournalDepuis(iso) {
  return un('SELECT COUNT(*) AS n FROM journal_evenement WHERE ts >= ? AND compte_id = ?', iso, compteIdCourant() || '')?.n ?? 0;
}

export function categoriesJournal() {
  return tous('SELECT DISTINCT categorie FROM journal_evenement WHERE compte_id = ? ORDER BY categorie', compteIdCourant() || '').map(
    (l) => l.categorie,
  );
}

/** Notification destinée au responsable (cloche de l'interface). */
export function notifier({ type = 'info', titre, message, niveau = 'Info', lien = '' }) {
  const id = uuid();
  executer(
    `INSERT INTO notification (id, type, titre, message, niveau, lu, date_notif, lien, compte_id)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    type,
    titre,
    message,
    niveau,
    new Date().toISOString(),
    lien,
    compteIdCourant() || '',
  );
  return id;
}

export function listerNotifications(limite = 30) {
  return tous(
    'SELECT * FROM notification WHERE compte_id = ? ORDER BY date_notif DESC LIMIT ?',
    compteIdCourant() || '',
    limite,
  );
}

export function compterNotificationsNonLues() {
  return un('SELECT COUNT(*) AS n FROM notification WHERE lu = 0 AND compte_id = ?', compteIdCourant() || '')?.n ?? 0;
}

export function marquerNotificationLue(id) {
  return executer('UPDATE notification SET lu = 1 WHERE id = ? AND compte_id = ?', id, compteIdCourant() || '').changes;
}

export function marquerToutesLues() {
  return executer('UPDATE notification SET lu = 1 WHERE lu = 0 AND compte_id = ?', compteIdCourant() || '').changes;
}

export function identifiantCourt() {
  return identifiant(8);
}
