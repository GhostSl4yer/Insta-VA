import crypto from 'node:crypto';
import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { dateDansFuseau, ajouterJours } from '../utils/temps.js';
import { config } from '../config.js';
import { journaliser } from './journal.js';
import { compteIdCourant, exigerCompte } from './contexte.js';

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
    `INSERT INTO lien_suivi (id, code, url, libelle, campagne, date_creation, actif, compte_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    id,
    code,
    destination,
    String(libelle || '').slice(0, 80),
    String(campagne || '').slice(0, 40),
    new Date().toISOString(),
    exigerCompte(),
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
  return tous('SELECT * FROM lien_suivi WHERE compte_id = ? ORDER BY date_creation DESC', exigerCompte()).map(mapper);
}

export function obtenirLien(code) {
  return mapper(un('SELECT * FROM lien_suivi WHERE code = ?', code));
}

export function obtenirLienParId(id) {
  return mapper(un('SELECT * FROM lien_suivi WHERE id = ? AND compte_id = ?', id, exigerCompte()));
}

export function desactiverLien(id) {
  executer('UPDATE lien_suivi SET actif = 0 WHERE id = ? AND compte_id = ?', id, exigerCompte());
  return obtenirLienParId(id);
}

/** Enregistre un clic (appelé par la route publique `/l/:code`). */
export function enregistrerClic({ code, pays = '', referent = '', date = null }) {
  const lien = un('SELECT * FROM lien_suivi WHERE code = ? AND actif = 1', code);
  if (!lien) return null;
  // Le clic est rattaché au compte propriétaire du lien (la route publique n'a
  // pas de session : le compte se déduit du lien, jamais d'une valeur externe).
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
  return un(
    `SELECT COUNT(*) AS n FROM clic_lien c JOIN lien_suivi l ON l.id = c.lien_id
      WHERE c.date = ? AND l.compte_id = ?`,
    date,
    compteIdCourant() || '',
  )?.n ?? 0;
}

export function statistiquesLiens({ jours = 30 } = {}) {
  const compteId = compteIdCourant() || '';
  const fin = dateDansFuseau(config.fuseau);
  const debut = ajouterJours(fin, -(Math.max(1, jours) - 1));
  const total = un(
    `SELECT COUNT(*) AS n FROM clic_lien c JOIN lien_suivi l ON l.id = c.lien_id
      WHERE c.date BETWEEN ? AND ? AND l.compte_id = ?`,
    debut,
    fin,
    compteId,
  )?.n ?? 0;
  const serie = tous(
    `SELECT c.date, COUNT(*) AS clics FROM clic_lien c JOIN lien_suivi l ON l.id = c.lien_id
      WHERE c.date BETWEEN ? AND ? AND l.compte_id = ?
      GROUP BY c.date ORDER BY c.date`,
    debut,
    fin,
    compteId,
  );
  const parLien = tous(
    `SELECT l.code, l.url, l.libelle, COUNT(c.id) AS clics
       FROM lien_suivi l LEFT JOIN clic_lien c ON c.lien_id = l.id AND c.date BETWEEN ? AND ?
      WHERE l.compte_id = ?
      GROUP BY l.id ORDER BY clics DESC`,
    debut,
    fin,
    compteId,
  );
  const parPays = tous(
    `SELECT CASE WHEN c.pays = '' THEN 'Inconnu' ELSE c.pays END AS pays, COUNT(*) AS clics
       FROM clic_lien c JOIN lien_suivi l ON l.id = c.lien_id
      WHERE c.date BETWEEN ? AND ? AND l.compte_id = ?
      GROUP BY c.pays ORDER BY clics DESC LIMIT 12`,
    debut,
    fin,
    compteId,
  );
  const septJours = un(
    `SELECT COUNT(*) AS n FROM clic_lien c JOIN lien_suivi l ON l.id = c.lien_id
      WHERE c.date BETWEEN ? AND ? AND l.compte_id = ?`,
    ajouterJours(fin, -6),
    fin,
    compteId,
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
  return mapper(
    un('SELECT * FROM lien_suivi WHERE actif = 1 AND compte_id = ? ORDER BY date_creation DESC LIMIT 1', compteIdCourant() || ''),
  );
}
