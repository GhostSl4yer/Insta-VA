import crypto from 'node:crypto';
import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { dateDansFuseau, ajouterJours } from '../utils/temps.js';
import { config } from '../config.js';
import { journaliser } from './journal.js';

/**
 * Suivi du lien externe — l'indicateur « clics sur le lien » du cahier des charges.
 *
 * Le lien de la bio reste celui du compte Instagram : Instagram ne transmet pas
 * les clics. On expose donc un lien de redirection propre (`/l/:code`), placé
 * dans la bio, qui compte le clic puis redirige vers la destination réelle.
 */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function genererCode(longueur = 7) {
  const octets = crypto.randomBytes(longueur);
  let code = '';
  for (let i = 0; i < longueur; i += 1) code += ALPHABET[octets[i] % ALPHABET.length];
  return code;
}

export function creerLien({ url, libelle = '', campagne = '' } = {}) {
  const destination = String(url || '').trim();
  if (!/^https?:\/\/[^\s]+$/i.test(destination)) {
    const erreur = new Error('L’URL de destination doit commencer par http:// ou https://.');
    erreur.statut = 400;
    throw erreur;
  }
  let code = genererCode();
  while (un('SELECT 1 AS n FROM lien_suivi WHERE code = ?', code)) code = genererCode();
  const id = uuid();
  executer(
    `INSERT INTO lien_suivi (id, code, url, libelle, campagne, date_creation, actif)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    id,
    code,
    destination,
    String(libelle || '').slice(0, 80),
    String(campagne || '').slice(0, 40),
    new Date().toISOString(),
  );
  journaliser(`Lien de suivi créé : /l/${code} → ${destination}`, { categorie: 'statistiques' });
  return mapper(un('SELECT * FROM lien_suivi WHERE id = ?', id));
}

function mapper(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    code: ligne.code,
    url: ligne.url,
    libelle: ligne.libelle,
    campagne: ligne.campagne,
    actif: Boolean(ligne.actif),
    dateCreation: ligne.date_creation,
    chemin: `/l/${ligne.code}`,
    urlPublique: config.urlPublique ? `${config.urlPublique}/l/${ligne.code}` : `/l/${ligne.code}`,
    clics: un('SELECT COUNT(*) AS n FROM clic_lien WHERE lien_id = ?', ligne.id)?.n ?? 0,
  };
}

export function listerLiens() {
  return tous('SELECT * FROM lien_suivi ORDER BY date_creation DESC').map(mapper);
}

export function obtenirLien(code) {
  return mapper(un('SELECT * FROM lien_suivi WHERE code = ?', code));
}

export function obtenirLienParId(id) {
  return mapper(un('SELECT * FROM lien_suivi WHERE id = ?', id));
}

export function desactiverLien(id) {
  executer('UPDATE lien_suivi SET actif = 0 WHERE id = ?', id);
  return obtenirLienParId(id);
}

/** Enregistre un clic (appelé par la route publique `/l/:code`). */
export function enregistrerClic({ code, pays = '', referent = '', date = null }) {
  const lien = un('SELECT * FROM lien_suivi WHERE code = ? AND actif = 1', code);
  if (!lien) return null;
  const jour = date || dateDansFuseau(config.fuseau);
  executer(
    `INSERT INTO clic_lien (id, lien_id, date, pays, referent, ts) VALUES (?, ?, ?, ?, ?, ?)`,
    uuid(),
    lien.id,
    jour,
    String(pays || '').slice(0, 40),
    String(referent || '').slice(0, 300),
    new Date().toISOString(),
  );
  return { url: lien.url, lien: mapper(lien) };
}

export function clicsDuJour(date = dateDansFuseau(config.fuseau)) {
  return un('SELECT COUNT(*) AS n FROM clic_lien WHERE date = ?', date)?.n ?? 0;
}

export function statistiquesLiens({ jours = 30 } = {}) {
  const fin = dateDansFuseau(config.fuseau);
  const debut = ajouterJours(fin, -(Math.max(1, jours) - 1));
  const total = un('SELECT COUNT(*) AS n FROM clic_lien WHERE date BETWEEN ? AND ?', debut, fin)?.n ?? 0;
  const serie = tous(
    `SELECT date, COUNT(*) AS clics FROM clic_lien WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    debut,
    fin,
  );
  const parLien = tous(
    `SELECT l.code, l.url, l.libelle, COUNT(c.id) AS clics
       FROM lien_suivi l LEFT JOIN clic_lien c ON c.lien_id = l.id AND c.date BETWEEN ? AND ?
      GROUP BY l.id ORDER BY clics DESC`,
    debut,
    fin,
  );
  const parPays = tous(
    `SELECT CASE WHEN pays = '' THEN 'Inconnu' ELSE pays END AS pays, COUNT(*) AS clics
       FROM clic_lien WHERE date BETWEEN ? AND ? GROUP BY pays ORDER BY clics DESC LIMIT 12`,
    debut,
    fin,
  );
  const septJours = un(
    'SELECT COUNT(*) AS n FROM clic_lien WHERE date BETWEEN ? AND ?',
    ajouterJours(fin, -6),
    fin,
  )?.n ?? 0;
  return {
    periode: { debut, fin },
    jours: Math.max(1, jours),
    total,
    septJours,
    moyenneJour: Math.round((total / Math.max(1, jours)) * 10) / 10,
    serie,
    parLien,
    parPays,
    aujourdhui: clicsDuJour(fin),
  };
}

/** Lien recommandé pour la bio : le premier lien actif, sinon null. */
export function lienActif() {
  return mapper(un('SELECT * FROM lien_suivi WHERE actif = 1 ORDER BY date_creation DESC LIMIT 1'));
}
