import { executer, tous, un } from '../db.js';
import { identifiant, uuid } from '../utils/ids.js';

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
    `INSERT INTO journal_evenement (id, ts, niveau, categorie, message, donnees, jour, cycle_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ts,
    niveau,
    categorie,
    String(message),
    JSON.stringify(donnees ?? {}),
    jour,
    cycleId,
  );
  return { id, ts, niveau, categorie, message, donnees, jour, cycleId };
}

export function listerJournal({ limite = 80, niveau, categorie, jour, cycleId, recherche } = {}) {
  const clauses = [];
  const params = [];
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
  return un('SELECT COUNT(*) AS n FROM journal_evenement WHERE ts >= ?', iso)?.n ?? 0;
}

export function categoriesJournal() {
  return tous('SELECT DISTINCT categorie FROM journal_evenement ORDER BY categorie').map((l) => l.categorie);
}

/** Notification destinée au responsable (cloche de l'interface). */
export function notifier({ type = 'info', titre, message, niveau = 'Info', lien = '' }) {
  const id = uuid();
  executer(
    `INSERT INTO notification (id, type, titre, message, niveau, lu, date_notif, lien)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    type,
    titre,
    message,
    niveau,
    new Date().toISOString(),
    lien,
  );
  return id;
}

export function listerNotifications(limite = 30) {
  return tous('SELECT * FROM notification ORDER BY date_notif DESC LIMIT ?', limite);
}

export function compterNotificationsNonLues() {
  return un('SELECT COUNT(*) AS n FROM notification WHERE lu = 0')?.n ?? 0;
}

export function marquerNotificationLue(id) {
  return executer('UPDATE notification SET lu = 1 WHERE id = ?', id).changes;
}

export function marquerToutesLues() {
  return executer('UPDATE notification SET lu = 1 WHERE lu = 0').changes;
}

export function identifiantCourt() {
  return identifiant(8);
}
