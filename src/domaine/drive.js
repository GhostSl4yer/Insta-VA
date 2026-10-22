import fs from 'node:fs';
import path from 'node:path';
import { executer, tous, un } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { journaliser } from './journal.js';
import { exigerCompte, compteIdCourant } from './contexte.js';
import { compteParId, marquerSync, enregistrerErreurCompte } from './compte.js';
import {
  driveConfigure,
  listerFichiers,
  listerDossiers,
  telechargerFichier,
  deplacerFichier,
} from '../services/drive-google.js';

/**
 * Contenus d'un compte.
 *
 * Source : le dossier Drive partagé du compte (lien collé dans la fiche du
 * compte). Le dossier contient quatre sous-dossiers — Reels, Stories,
 * UnePleine, PhotoProfil — plus Archive. Après publication confirmée, le
 * fichier est déplacé vers Archive (jamais supprimé).
 *
 * Aucun média n'est fabriqué : si le dossier est vide, le planning est vide.
 */

const SOUS_DOSSIERS = {
  Reel: ['reels', 'reel'],
  Story: ['stories', 'story'],
  UnePleine: ['unepleine', 'une pleine', 'livre', 'unes'],
  PhotoProfil: ['photoprofil', 'photo de profil', 'profil', 'photos'],
  Archive: ['archive', 'archives'],
};

const PAR_TYPE = { Reel: 'reels', Story: 'stories', UnePleine: 'livre', PhotoProfil: 'photos' };
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.m4v']);
const TAILLE_MAX = 200 * 1024 * 1024;

const nettoyer = (nom) =>
  String(nom || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function mapper(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    compteId: ligne.compte_id,
    cycleId: ligne.cycle_id,
    type: ligne.type,
    chemin: ligne.chemin_fichier,
    cheminPublic: ligne.chemin_public,
    url: urlMedia(ligne.chemin_public),
    description: ligne.description,
    dateAjout: ligne.date_ajout,
    datePublication: ligne.date_publication,
    statut: ligne.statut,
    jourPrevu: ligne.jour_prevu,
    format: ligne.format,
    theme: ligne.theme,
    taille: ligne.taille ?? 0,
    source: ligne.source,
    driveFileId: ligne.drive_file_id,
    driveDossierId: ligne.drive_dossier_id,
  };
}

/* ─────────────────────────── dossiers Drive ─────────────────────────── */

/**
 * Retrouve les sous-dossiers du dossier partagé du compte. Le résultat est mis
 * en cache sur la fiche du compte : les noms ne changent pas en exploitation.
 */
export async function resoudreDossiersDrive(compteId = exigerCompte(), { forcer = false } = {}) {
  const compte = compteParId(compteId);
  if (!compte?.driveFolderId) return {};
  if (!forcer && compte.driveSousDossiers?.Reel) return compte.driveSousDossiers;
  const enfants = await listerDossiers(compte.driveFolderId);
  const trouves = {};
  for (const [type, alias] of Object.entries(SOUS_DOSSIERS)) {
    const dossier = enfants.find((d) => alias.includes(nettoyer(d.name)));
    if (dossier) trouves[type] = dossier.id;
  }
  if (!trouves.Archive) {
    // L'archive est créée si elle manque : le fichier publié ne doit jamais rester
    // dans la file « à publier ».
    const archive = await creerDossier('Archive', compte.driveFolderId);
    trouves.Archive = archive.id;
  }
  executer('UPDATE compte_instagram SET drive_sous_dossiers = ? WHERE id = ?', JSON.stringify(trouves), compteId);
  return trouves;
}

async function creerDossier(nom, parentId) {
  const { creerDossier: creer } = await import('../services/drive-google.js');
  return creer({ nom, parentId });
}

/* ─────────────────────────── inventaire local ─────────────────────────── */

export function listerContenus({ statut, type, cycleId, limite = 300, recherche } = {}) {
  const compteId = compteIdCourant() || '';
  const clauses = ['compte_id = ?'];
  const params = [compteId];
  if (statut) {
    clauses.push(`statut IN (${String(statut).split(',').map(() => '?').join(',')})`);
    params.push(...String(statut).split(','));
  }
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (cycleId) {
    clauses.push('cycle_id = ?');
    params.push(cycleId);
  }
  if (recherche) {
    clauses.push('description LIKE ?');
    params.push(`%${recherche}%`);
  }
  return tous(
    `SELECT * FROM contenu_drive WHERE ${clauses.join(' AND ')} ORDER BY date_ajout DESC LIMIT ?`,
    ...params,
    Math.min(500, limite),
  ).map(mapper);
}

export function obtenirContenu(id) {
  return mapper(un('SELECT * FROM contenu_drive WHERE id = ? AND compte_id = ?', id, compteIdCourant() || ''));
}

export function contenusDuJour(date, { type } = {}) {
  const params = [compteIdCourant() || '', date];
  let filtre = '';
  if (type) {
    filtre = ' AND type = ?';
    params.push(type);
  }
  return tous(
    `SELECT * FROM contenu_drive WHERE compte_id = ? AND jour_prevu = ?${filtre} ORDER BY date_ajout`,
    ...params,
  ).map(mapper);
}

export function prochainContenuDisponible(type = 'Reel') {
  return mapper(
    un(
      `SELECT * FROM contenu_drive WHERE compte_id = ? AND type = ? AND statut IN ('Telecharge','Planifie')
        AND (jour_prevu IS NULL OR jour_prevu <= date('now'))
        ORDER BY date_ajout LIMIT 1`,
      compteIdCourant() || '',
      type,
    ),
  );
}

/* ─────────────────────────── planification ─────────────────────────── */

const QUOTAS = { Story: 3, Reel: 2, UnePleine: 1, PhotoProfil: 1 };
const JOURS_UNE = new Set([1, 3, 5]); // lundi, mercredi, vendredi

/** Attribue un jour aux contenus qui n'en ont pas, en respectant les quotas. */
export function plannifierJournee({ date, numeroJour }) {
  const compteId = exigerCompte();
  const dejaPlaces = tous(
    `SELECT type, COUNT(*) AS n FROM contenu_drive WHERE compte_id = ? AND jour_prevu = ? GROUP BY type`,
    compteId,
    date,
  ).reduce((acc, l) => ({ ...acc, [l.type]: l.n }), {});
  const libres = tous(
    `SELECT * FROM contenu_drive WHERE compte_id = ? AND jour_prevu IS NULL AND statut = 'Telecharge' ORDER BY date_ajout`,
    compteId,
  );
  let places = 0;
  for (const contenu of libres) {
    const quota = contenu.type === 'UnePleine' ? (JOURS_UNE.has(numeroJour % 7) ? 1 : 0) : QUOTAS[contenu.type] ?? 0;
    if (quota <= 0 || (dejaPlaces[contenu.type] || 0) >= quota) continue;
    executer(`UPDATE contenu_drive SET jour_prevu = ?, statut = 'Planifie' WHERE id = ? AND compte_id = ?`, date, contenu.id, compteId);
    dejaPlaces[contenu.type] = (dejaPlaces[contenu.type] || 0) + 1;
    places += 1;
  }
  if (places) {
    journaliser(`${places} contenu(s) placé(s) au ${date}.`, { categorie: 'drive', jour: date });
  }
  return places;
}

/* ─────────────────────────── ajout & synchronisation ─────────────────────────── */

export function ajouterContenu({ type, chemin, description = '', source = 'local', driveFileId = null, taille = 0 }) {
  const compteId = exigerCompte();
  const id = uuid();
  const absolu = path.isAbsolute(chemin) ? chemin : path.join(config.dossierMediasCompte(compteId), chemin);
  const relatif = path.relative(config.dossierMediasCompte(compteId), absolu);
  const statut = 'Telecharge';
  executer(
    `INSERT INTO contenu_drive
      (id, compte_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
       statut, format, theme, source, drive_file_id, taille)
     VALUES (?, ?, ?, ?, ?, 'prive', ?, ?, ?, 'media', '', ?, ?, ?)`,
    id,
    compteId,
    type,
    relatif,
    `/media/${compteId}/${relatif.split(path.sep).join('/')}`,
    String(description || path.basename(absolu)).slice(0, 200),
    new Date().toISOString(),
    statut,
    source,
    driveFileId,
    taille,
  );
  return obtenirContenu(id);
}

/** Import d'un fichier envoyé par le navigateur (multipart déjà déposé sur disque). */
export function importerFichier({ type, nom, donnees, description = '' }) {
  const compteId = exigerCompte();
  const dossier = path.join(config.dossierMediasCompte(compteId), PAR_TYPE[type] || 'reels');
  fs.mkdirSync(dossier, { recursive: true });
  const nomSur = `${Date.now()}-${String(nom || 'media').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  fs.writeFileSync(path.join(dossier, nomSur), donnees);
  return ajouterContenu({
    type,
    chemin: path.join(PAR_TYPE[type] || 'reels', nomSur),
    description: description || nom,
    source: 'local',
    taille: donnees.length,
  });
}

/** Synchronise le dossier Drive partagé du compte. */
export async function synchroniserDrive({ forcer = false } = {}) {
  const compteId = exigerCompte();
  const compte = compteParId(compteId);
  if (!compte?.driveFolderId) {
    return { actif: false, total: 0, parType: {}, erreurs: [], raison: 'aucun dossier Drive' };
  }
  if (!driveConfigure()) {
    return { actif: false, total: 0, parType: {}, erreurs: [], raison: 'Google Drive non configuré' };
  }
  let dossiers;
  try {
    dossiers = await resoudreDossiersDrive(compteId, { forcer });
  } catch (erreur) {
    enregistrerErreurCompte(compteId, erreur.message);
    return { actif: true, total: 0, parType: {}, erreurs: [{ type: 'Drive', message: erreur.message }] };
  }
  const connus = new Set(
    tous('SELECT drive_file_id FROM contenu_drive WHERE compte_id = ? AND drive_file_id IS NOT NULL', compteId).map(
      (l) => l.drive_file_id,
    ),
  );
  const resultat = { actif: true, total: 0, parType: {}, erreurs: [], dossiers };
  for (const type of ['Story', 'Reel', 'UnePleine', 'PhotoProfil']) {
    const dossierId = dossiers[type];
    if (!dossierId) continue;
    let fichiers = [];
    try {
      fichiers = await listerFichiers(dossierId);
    } catch (erreur) {
      resultat.erreurs.push({ type, message: erreur.message });
      continue;
    }
    for (const fichier of fichiers) {
      if (connus.has(fichier.id)) continue;
      const extension = path.extname(fichier.name || '').toLowerCase();
      if (!EXTENSIONS.has(extension)) continue;
      if (Number(fichier.size || 0) > TAILLE_MAX) {
        resultat.erreurs.push({ type, fichier: fichier.name, message: 'fichier > 200 Mo' });
        continue;
      }
      try {
        const donnees = await telechargerFichier(fichier.id);
        const dossierLocal = path.join(config.dossierMediasCompte(compteId), PAR_TYPE[type]);
        fs.mkdirSync(dossierLocal, { recursive: true });
        const nomLocal = `${fichier.id.slice(0, 8)}-${String(fichier.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.writeFileSync(path.join(dossierLocal, nomLocal), donnees);
        const contenu = ajouterContenu({
          type,
          chemin: path.join(PAR_TYPE[type], nomLocal),
          description: path.basename(fichier.name, extension).replace(/[_-]+/g, ' '),
          source: 'drive',
          driveFileId: fichier.id,
          taille: donnees.length,
        });
        executer('UPDATE contenu_drive SET drive_dossier_id = ? WHERE id = ?', dossierId, contenu.id);
        connus.add(fichier.id);
        resultat.parType[type] = (resultat.parType[type] || 0) + 1;
        resultat.total += 1;
      } catch (erreur) {
        resultat.erreurs.push({ type, fichier: fichier.name, message: erreur.message });
      }
    }
  }
  if (resultat.total || resultat.erreurs.length) {
    journaliser(
      `Drive de @${compte.username} synchronisé : ${resultat.total} fichier(s) importé(s)${
        resultat.erreurs.length ? ` · ${resultat.erreurs.length} erreur(s)` : ''
      }.`,
      { categorie: 'drive', niveau: resultat.erreurs.length ? 'alerte' : 'info' },
    );
  }
  marquerSync(compteId);
  return resultat;
}

/** Archivage sur le Drive : le fichier quitte la file, il n'est jamais supprimé. */
export async function archiverSurDrive(id) {
  const contenu = obtenirContenu(id);
  if (!contenu?.driveFileId) return { deplace: false, raison: 'contenu local' };
  const compte = compteParId(contenu.compteId);
  const dossiers = compte?.driveSousDossiers || {};
  if (!dossiers.Archive || !driveConfigure()) return { deplace: false, raison: 'archive Drive non configurée' };
  try {
    const resultat = await deplacerFichier(contenu.driveFileId, {
      depuis: contenu.driveDossierId,
      vers: dossiers.Archive,
    });
    return resultat;
  } catch (erreur) {
    journaliser(`Archivage Drive impossible : ${erreur.message}`, { niveau: 'alerte', categorie: 'drive' });
    return { deplace: false, raison: erreur.message };
  }
}

/* ─────────────────────────── statuts ─────────────────────────── */

export function marquerPublie(id, datePublication = new Date().toISOString()) {
  executer(
    `UPDATE contenu_drive SET statut = 'Publie', date_publication = ? WHERE id = ? AND compte_id = ?`,
    datePublication,
    id,
    compteIdCourant() || '',
  );
}

export function marquerPlanifie(id, date) {
  executer('UPDATE contenu_drive SET statut = ? WHERE id = ? AND compte_id = ?', date ? 'Planifie' : 'Telecharge', id, compteIdCourant() || '');
}

export function archiver(id) {
  executer(`UPDATE contenu_drive SET statut = 'Archive', visibilite = 'prive' WHERE id = ? AND compte_id = ?`, id, compteIdCourant() || '');
  return obtenirContenu(id);
}

export function supprimerContenu(id) {
  const contenu = obtenirContenu(id);
  if (!contenu) return null;
  const absolu = path.join(config.dossierMediasCompte(contenu.compteId), contenu.chemin || '');
  if (absolu.startsWith(config.dossierMediasCompte(contenu.compteId))) {
    try {
      fs.rmSync(absolu, { force: true });
    } catch {
      /* fichier déjà absent */
    }
  }
  executer('DELETE FROM contenu_drive WHERE id = ? AND compte_id = ?', id, contenu.compteId);
  journaliser(`Contenu supprimé : ${contenu.description || contenu.id}.`, { categorie: 'drive', niveau: 'alerte' });
  return contenu;
}

/** Marque un contenu comme téléchargé (compatibilité interface). */
export function telecharger(id) {
  return obtenirContenu(id);
}

/** Synchronisation locale (aucun média fabriqué) : renvoie l'inventaire. */
export function synchroniser() {
  return statistiquesDrive();
}

export function statistiquesDrive() {
  const compteId = compteIdCourant() || '';
  const parStatut = tous(
    'SELECT statut, COUNT(*) AS n FROM contenu_drive WHERE compte_id = ? GROUP BY statut',
    compteId,
  );
  const parType = tous('SELECT type, COUNT(*) AS n FROM contenu_drive WHERE compte_id = ? GROUP BY type', compteId);
  return {
    total: parStatut.reduce((s, l) => s + l.n, 0),
    parStatut: Object.fromEntries(parStatut.map((l) => [l.statut, l.n])),
    parType: Object.fromEntries(parType.map((l) => [l.type, l.n])),
  };
}

export function urlMedia(cheminPublic) {
  if (!cheminPublic) return null;
  return String(cheminPublic).startsWith('/') ? cheminPublic : `/${cheminPublic}`;
}

export function urlPubliqueAbsolue(cheminPublic, base = config.urlPublique) {
  const chemin = urlMedia(cheminPublic);
  if (!chemin) return null;
  if (!base) return chemin;
  return `${String(base).replace(/\/$/, '')}${chemin}`;
}
