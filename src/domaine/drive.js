import fs from 'node:fs';
import path from 'node:path';
import { executer, tous, un } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { ajouterJours, jourSemaine } from '../utils/temps.js';
import { slug } from '../utils/texte.js';
import { creerAlea } from '../utils/alea.js';
import { CONCEPTS, THEMES } from '../donnees/concepts.js';
import { composerLegende, texteStory } from '../donnees/legende.js';
import { journaliser } from './journal.js';
import { ecrireVisuel, choisirPalette } from './visuels.js';
import {
  driveConfigure,
  listerFichiers,
  telechargerFichier,
  deplacerFichier,
} from '../services/drive-google.js';

const DOSSIERS = { Reel: 'reels', Story: 'stories', UnePleine: 'livre', PhotoProfil: 'photos' };
const TAGS_THEME = { fitness: '#fitness', nutrition: '#nutrition', running: '#running', bienetre: '#bienetre', ia: '#IA' };

function mapper(ligne) {
  if (!ligne) return null;
  const theme = ligne.theme || 'fitness';
  return {
    id: ligne.id,
    cycleId: ligne.cycle_id,
    type: ligne.type,
    cheminFichier: ligne.chemin_fichier,
    cheminPublic: ligne.chemin_public,
    visibilite: ligne.visibilite,
    description: ligne.description,
    dateAjout: ligne.date_ajout,
    datePublication: ligne.date_publication,
    statut: ligne.statut,
    jourPrevu: ligne.jour_prevu,
    format: ligne.format,
    theme,
    themeLibelle: THEMES[theme]?.libelle || theme,
    emoji: THEMES[theme]?.emoji || '✨',
    miniature: ligne.miniature,
    source: ligne.source,
    driveFileId: ligne.drive_file_id || null,
    driveDossierId: ligne.drive_dossier_id || null,
    image: urlMedia(ligne.chemin_public),
  };
}

const conceptsParType = (type) => CONCEPTS.filter((c) => c.format === type);

function ecrireContenu({ concept, numeroJour, cycleId, compte, date, type }) {
  const graine = Math.abs(
    (date.split('-').reduce((a, b) => a * 31 + Number(b), 7) * 97 + numeroJour * 13 + type.length * 7) % 100000,
  );
  const palette = choisirPalette(`${concept.id}-${date}-${numeroJour}-${type}`);
  const couleur = palette.fond[0].replace('#', '');
  const dossier = DOSSIERS[type];
  const nom = `${date}-j${String(numeroJour).padStart(2, '0')}-${type.toLowerCase()}-${slug(concept.id)}-${couleur}.svg`;
  const cheminRelatif = path.posix.join(dossier, nom);
  const absolu = path.join(config.dossierDrive, cheminRelatif);
  ecrireVisuel({
    dossier: path.dirname(absolu),
    nomFichier: path.basename(absolu),
    format: type,
    concept: {
      ...concept,
      themeLabel: TAGS_THEME[concept.theme] || '#maya',
      punchline: `Jour ${numeroJour} · ${THEMES[concept.theme]?.libelle || ''}`,
    },
    avatar: compte.avatar,
    username: compte.username,
  });
  const legende = composerLegende(concept, { graine, jour: numeroJour, type });
  const description =
    type === 'Story'
      ? `${legende.split('\n')[0]}\n\n${concept.accroche.replace(/\n/g, ' ')} · ${THEMES[concept.theme]?.emoji || ''}\n\n${
          texteStory(concept, graine).libelle || ''
        }`
      : legende;
  executer(
    `INSERT INTO contenu_drive
      (id, cycle_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
       date_publication, statut, jour_prevu, format, theme, miniature, source)
     VALUES (?, ?, ?, ?, ?, 'prive', ?, ?, NULL, 'Planifie', ?, ?, ?, ?, 'genere')`,
    uuid(),
    cycleId,
    type,
    absolu,
    cheminRelatif,
    description,
    new Date().toISOString(),
    date,
    type,
    concept.theme,
    cheminRelatif,
  );
}

/**
 * Production : affecte la journée aux contenus fournis par le responsable.
 * Aucun média n'est fabriqué — on ne fait que répartir le stock disponible.
 */
export function attribuerJourPrevu(date) {
  const quotas = { Story: 3, Reel: 2, UnePleine: [1, 3, 5].includes(jourSemaine(date)) ? 1 : 0 };
  let attribues = 0;
  for (const [type, quota] of Object.entries(quotas)) {
    if (!quota) continue;
    const dejaPrevus = un(
      `SELECT COUNT(*) AS n FROM contenu_drive WHERE jour_prevu = ? AND type = ?`,
      date,
      type,
    )?.n ?? 0;
    const besoin = Math.max(0, quota - dejaPrevus);
    if (!besoin) continue;
    const disponibles = tous(
      `SELECT id FROM contenu_drive
        WHERE jour_prevu IS NULL AND type = ? AND statut IN ('Planifie','Telecharge')
        ORDER BY date_ajout LIMIT ?`,
      type,
      besoin,
    );
    for (const ligne of disponibles) {
      executer('UPDATE contenu_drive SET jour_prevu = ? WHERE id = ?', date, ligne.id);
      attribues += 1;
    }
  }
  if (attribues) {
    journaliser(`${attribues} contenu(s) fourni(s) affecté(s) à la journée du ${date}.`, {
      categorie: 'drive',
      jour: date,
    });
  }
  return { crees: 0, attribues, existants: 0 };
}

/**
 * Génère les contenus d'une journée : 3 stories, 1 Reel, une publication « une »
 * le lundi/mercredi/vendredi et un second Reel court le mercredi/samedi.
 * En production, aucun contenu n'est généré : on répartit le stock fourni.
 */
export function plannifierJournee({ cycleId, compte, date, numeroJour = 1 }) {
  if (config.production) return attribuerJourPrevu(date);
  const existants = un('SELECT COUNT(*) AS n FROM contenu_drive WHERE jour_prevu = ?', date)?.n ?? 0;
  if (existants > 0) return { crees: 0, existants };

  const reels = conceptsParType('Reel');
  const stories = conceptsParType('Story');
  const unes = conceptsParType('UnePleine');
  const jourSem = jourSemaine(date);
  const base = Math.max(0, numeroJour - 1);
  let crees = 0;

  const prendre = (liste, index) => liste[index % liste.length];

  // Le Reel du jour (forcé sur l'IA 1 jour / 7 pour servir l'objectif final)
  const conceptReel =
    numeroJour % 7 === 0 ? reels.find((c) => c.theme === 'ia') || reels[base % reels.length] : prendre(reels, base * 2);
  ecrireContenu({ concept: conceptReel, numeroJour, cycleId, compte, date, type: 'Reel' });
  crees += 1;

  for (let i = 0; i < 3; i += 1) {
    ecrireContenu({ concept: prendre(stories, base * 3 + i), numeroJour, cycleId, compte, date, type: 'Story' });
    crees += 1;
  }

  if ([1, 3, 5].includes(jourSem)) {
    ecrireContenu({ concept: prendre(unes, base), numeroJour, cycleId, compte, date, type: 'UnePleine' });
    crees += 1;
  }

  if ([3, 6].includes(jourSem)) {
    ecrireContenu({ concept: prendre(reels, base * 2 + 1), numeroJour, cycleId, compte, date, type: 'Reel' });
    crees += 1;
  }

  journaliser(`${crees} contenu(s) préparé(s) dans le Drive pour le ${date}.`, {
    categorie: 'drive',
    jour: date,
    cycleId,
  });
  return { crees, existants: 0 };
}

/** Pré-planification d'un cycle complet (utilisé pour l'amorçage ou la relance). */
export function plannifierCycle({ cycleId, compte, dateDebut, jours = config.dureeCycleJours }) {
  let crees = 0;
  for (let j = 1; j <= jours; j += 1) {
    crees += plannifierJournee({
      cycleId,
      compte,
      date: ajouterJours(dateDebut, j - 1),
      numeroJour: j,
    }).crees;
  }
  return { crees };
}

/** Photo de profil : générée une seule fois, indépendamment du cycle. */
export function assurerPhotoProfil(compte) {
  const existe = un(`SELECT * FROM contenu_drive WHERE type = 'PhotoProfil' LIMIT 1`);
  if (existe) return mapper(existe);
  // Production : la photo de profil est fournie, jamais générée.
  if (config.production) return null;
  const nom = `profil-${compte.username}.svg`;
  const relatif = path.posix.join('photos', nom);
  const absolu = path.join(config.dossierDrive, relatif);
  ecrireVisuel({
    dossier: path.dirname(absolu),
    nomFichier: nom,
    format: 'PhotoProfil',
    concept: { id: 'profil', titre: 'Portrait avatar', accroche: 'Maya Rivera' },
    avatar: compte.avatar,
    username: compte.username,
  });
  const id = uuid();
  executer(
    `INSERT INTO contenu_drive
      (id, cycle_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
       date_publication, statut, jour_prevu, format, theme, miniature, source)
     VALUES (?, NULL, 'PhotoProfil', ?, ?, 'public', ?, ?, ?, 'Publie', NULL, 'PhotoProfil', 'fitness', ?, 'genere')`,
    id,
    absolu,
    relatif,
    'Photo de profil générée pour l’avatar IA.',
    new Date().toISOString(),
    new Date().toISOString(),
    relatif,
  );
  return mapper(un('SELECT * FROM contenu_drive WHERE id = ?', id));
}

export function listerContenus({ statut, type, theme, cycleId, limite = 300, recherche } = {}) {
  const clauses = [];
  const params = [];
  if (statut) {
    const liste = String(statut).split(',');
    clauses.push(`statut IN (${liste.map(() => '?').join(',')})`);
    params.push(...liste);
  }
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (theme) {
    clauses.push('theme = ?');
    params.push(theme);
  }
  if (cycleId) {
    clauses.push('cycle_id = ?');
    params.push(cycleId);
  }
  if (recherche) {
    clauses.push('(description LIKE ? OR chemin_public LIKE ?)');
    params.push(`%${recherche}%`, `%${recherche}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return tous(
    `SELECT * FROM contenu_drive ${where} ORDER BY COALESCE(jour_prevu, '9999') DESC, date_ajout DESC LIMIT ?`,
    ...params,
    limite,
  ).map(mapper);
}

export function obtenirContenu(id) {
  return mapper(un('SELECT * FROM contenu_drive WHERE id = ?', id));
}

export function contenusDuJour(date, { type } = {}) {
  const params = [date];
  let extra = '';
  if (type) {
    extra = ' AND type = ?';
    params.push(type);
  }
  return tous(
    `SELECT * FROM contenu_drive
     WHERE jour_prevu = ? AND statut IN ('Planifie','Telecharge')${extra}
     ORDER BY type, date_ajout LIMIT 12`,
    ...params,
  ).map(mapper);
}

export function prochainContenuDisponible(type = 'Reel') {
  return mapper(
    un(
      `SELECT * FROM contenu_drive
       WHERE type = ? AND statut IN ('Planifie','Telecharge')
       ORDER BY COALESCE(jour_prevu, '9999'), date_ajout LIMIT 1`,
      type,
    ),
  );
}

/** `telecharger()` du diagramme : rend le contenu disponible pour publication. */
export function telecharger(id) {
  const contenu = obtenirContenu(id);
  if (!contenu) return null;
  executer(`UPDATE contenu_drive SET statut = 'Telecharge', date_ajout = ? WHERE id = ?`, new Date().toISOString(), id);
  journaliser(`Contenu téléchargé depuis le Drive : ${contenu.type} · ${contenu.themeLibelle}.`, {
    categorie: 'drive',
    donnees: { id },
  });
  return obtenirContenu(id);
}

export function marquerPublie(id, datePublication) {
  executer(`UPDATE contenu_drive SET statut = 'Publie', date_publication = ? WHERE id = ?`, datePublication, id);
  return obtenirContenu(id);
}

export function marquerPlanifie(id, datePublication) {
  executer(`UPDATE contenu_drive SET statut = 'Planifie', date_publication = ? WHERE id = ?`, datePublication, id);
  return obtenirContenu(id);
}

export function archiver(id) {
  const contenu = obtenirContenu(id);
  if (!contenu) return null;
  executer(`UPDATE contenu_drive SET statut = 'Archive', visibilite = 'prive' WHERE id = ?`, id);
  journaliser(`Contenu archivé : ${contenu.type} · ${contenu.themeLibelle}.`, { categorie: 'drive' });
  return obtenirContenu(id);
}

function supprimerFichier(cheminRelatif) {
  if (!cheminRelatif) return;
  const absolu = path.join(config.dossierDrive, cheminRelatif);
  if (!absolu.startsWith(config.dossierDrive)) return;
  try {
    fs.unlinkSync(absolu);
  } catch {
    /* fichier déjà absent */
  }
}

/** `supprimer()` du diagramme. */
export function supprimerContenu(id) {
  const contenu = obtenirContenu(id);
  if (!contenu) return null;
  if (contenu.statut === 'Publie') {
    const erreur = new Error('Impossible de supprimer un contenu déjà publié : archivez-le.');
    erreur.statut = 409;
    throw erreur;
  }
  supprimerFichier(contenu.cheminPublic);
  executer('DELETE FROM contenu_drive WHERE id = ?', id);
  journaliser(`Contenu supprimé du Drive : ${contenu.type}.`, { categorie: 'drive', niveau: 'alerte' });
  return contenu;
}

/**
 * `synchroniser()` : importe dans la base les fichiers déposés dans le Drive
 * (équivalent local du dossier Google Drive).
 */
export function synchroniser() {
  let importes = 0;
  const connu = new Set(tous('SELECT chemin_public FROM contenu_drive').map((l) => l.chemin_public));
  const dossierTelecharges = path.join(config.dossierDrive, 'telecharges');
  fs.mkdirSync(dossierTelecharges, { recursive: true });
  for (const fichier of fs.readdirSync(dossierTelecharges)) {
    const relatif = path.posix.join('telecharges', fichier);
    if (connu.has(relatif)) continue;
    const absolu = path.join(config.dossierDrive, relatif);
    const stats = fs.statSync(absolu);
    if (!stats.isFile()) continue;
    const type = /\.(mp4|mov|webm)$/i.test(fichier) ? 'Reel' : /story/i.test(fichier) ? 'Story' : 'UnePleine';
    executer(
      `INSERT INTO contenu_drive
        (id, cycle_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
         statut, format, theme, miniature, source)
       VALUES (?, NULL, ?, ?, ?, 'prive', ?, ?, 'Telecharge', ?, 'fitness', ?, 'local')`,
      uuid(),
      type,
      absolu,
      relatif,
      `Contenu importé depuis le Drive : ${fichier}`,
      new Date().toISOString(),
      type,
      relatif,
    );
    importes += 1;
  }
  journaliser(`Drive synchronisé : ${importes} nouveau(x) contenu(s) importé(s).`, {
    categorie: 'drive',
    donnees: { importes },
  });
  return { importes, total: tous('SELECT COUNT(*) AS n FROM contenu_drive')[0]?.n ?? 0 };
}

/**
 * Importe les fichiers présents sur Google Drive (source centrale du cahier des
 * charges). Idempotent : un fichier déjà importé n'est pas retéléchargé.
 * Les fichiers restent dans le Drive ; ils seront déplacés vers le dossier
 * d'archive après publication confirmée.
 */
export async function synchroniserDrive({ types = ['Story', 'Reel', 'UnePleine', 'PhotoProfil'] } = {}) {
  if (!config.googleDrive.active || !driveConfigure()) {
    return { actif: false, total: 0, parType: {}, erreurs: [] };
  }
  const importes = { parType: {}, total: 0 };
  const erreurs = [];
  const connus = new Set(
    tous('SELECT drive_file_id FROM contenu_drive WHERE drive_file_id IS NOT NULL').map((l) => l.drive_file_id),
  );

  for (const type of types) {
    const dossierId = config.googleDrive.dossiers[type];
    if (!dossierId) continue;
    let fichiers = [];
    try {
      fichiers = await listerFichiers(dossierId);
    } catch (erreur) {
      erreurs.push({ type, message: erreur.message });
      journaliser(`Drive Google illisible (${type}) : ${erreur.message}`, {
        niveau: 'alerte',
        categorie: 'drive',
      });
      continue;
    }
    for (const fichier of fichiers) {
      if (connus.has(fichier.id)) continue;
      const extension = path.extname(fichier.name || '').toLowerCase();
      if (!['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp'].includes(extension)) continue;
      try {
        const octets = await telechargerFichier(fichier.id);
        if (octets.length > 200 * 1024 * 1024) {
          throw new Error('fichier supérieur à 200 Mo');
        }
        const relatif = path.posix.join('telecharges', `${type.toLowerCase()}-${slug(path.basename(fichier.name, extension))}${extension}`);
        const absolu = path.join(config.dossierDrive, relatif);
        fs.mkdirSync(path.dirname(absolu), { recursive: true });
        fs.writeFileSync(absolu, octets);
        executer(
          `INSERT INTO contenu_drive
            (id, cycle_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
             statut, format, theme, miniature, source, drive_file_id, drive_dossier_id)
           VALUES (?, NULL, ?, ?, ?, 'prive', ?, ?, 'Telecharge', ?, 'fitness', ?, 'google-drive', ?, ?)`,
          uuid(),
          type,
          absolu,
          relatif,
          path.basename(fichier.name, extension).replace(/[_-]+/g, ' '),
          new Date().toISOString(),
          type,
          relatif,
          fichier.id,
          dossierId,
        );
        connus.add(fichier.id);
        importes.parType[type] = (importes.parType[type] || 0) + 1;
        importes.total += 1;
      } catch (erreur) {
        erreurs.push({ type, fichier: fichier.name, message: erreur.message });
      }
    }
  }

  if (importes.total || erreurs.length) {
    journaliser(
      `Google Drive synchronisé : ${importes.total} fichier(s) importé(s)${
        erreurs.length ? ` · ${erreurs.length} erreur(s)` : ''
      }.`,
      { categorie: 'drive', niveau: erreurs.length ? 'alerte' : 'info', donnees: importes },
    );
  }
  return { actif: true, ...importes, erreurs };
}

/**
 * Archivage sur le Drive après publication confirmée : le fichier quitte le
 * dossier « à publier » sans être supprimé (restauration possible).
 */
export async function archiverSurDrive(id) {
  const contenu = obtenirContenu(id);
  if (!contenu?.driveFileId || !config.googleDrive.dossierArchive) return { deplace: false };
  try {
    const resultat = await deplacerFichier(contenu.driveFileId, {
      depuis: contenu.driveDossierId || undefined,
      vers: config.googleDrive.dossierArchive,
    });
    executer(`UPDATE contenu_drive SET drive_dossier_id = ? WHERE id = ?`, config.googleDrive.dossierArchive, id);
    journaliser(`Contenu ${contenu.type} déplacé vers le dossier d’archive du Drive.`, { categorie: 'drive' });
    return resultat;
  } catch (erreur) {
    journaliser(`Archivage Drive impossible : ${erreur.message}`, { niveau: 'alerte', categorie: 'drive' });
    return { deplace: false, erreur: erreur.message };
  }
}

/** Ajout d'un média par le responsable (glisser-déposer dans l'interface). */
export function ajouterContenu({
  nomFichier,
  mime = '',
  donneesBase64,
  type = 'Reel',
  description = '',
  jourPrevu = null,
  theme = 'fitness',
}) {
  if (!donneesBase64) {
    const erreur = new Error('Fichier manquant.');
    erreur.statut = 400;
    throw erreur;
  }
  const buffer = Buffer.from(String(donneesBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 25 * 1024 * 1024) {
    const erreur = new Error('Fichier trop volumineux (25 Mo max).');
    erreur.statut = 413;
    throw erreur;
  }
  const extension = path.extname(nomFichier || '').toLowerCase() || (mime.startsWith('video') ? '.mp4' : '.jpg');
  const autorisees = ['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp', '.svg'];
  if (!autorisees.includes(extension)) {
    const erreur = new Error(`Format non supporté (${extension}).`);
    erreur.statut = 415;
    throw erreur;
  }
  const nom = `${Date.now()}-${slug(path.basename(nomFichier || 'media', extension))}${extension}`;
  const relatif = path.posix.join('telecharges', nom);
  const absolu = path.join(config.dossierDrive, relatif);
  fs.mkdirSync(path.dirname(absolu), { recursive: true });
  fs.writeFileSync(absolu, buffer);
  const id = uuid();
  const typeFinal = extension.match(/mp4|mov|webm/) ? 'Reel' : type;
  executer(
    `INSERT INTO contenu_drive
      (id, cycle_id, type, chemin_fichier, chemin_public, visibilite, description, date_ajout,
       statut, jour_prevu, format, theme, miniature, source)
     VALUES (?, NULL, ?, ?, ?, 'prive', ?, ?, 'Telecharge', ?, ?, ?, ?, 'upload')`,
    id,
    typeFinal,
    absolu,
    relatif,
    description || path.basename(nomFichier || 'média importé'),
    new Date().toISOString(),
    jourPrevu,
    typeFinal,
    theme,
    relatif,
  );
  journaliser(`Nouveau média ajouté au Drive : ${nomFichier} (${Math.round(buffer.length / 1024)} Ko).`, {
    categorie: 'drive',
  });
  return obtenirContenu(id);
}

export function statistiquesDrive() {
  const parStatut = Object.fromEntries(
    tous('SELECT statut, COUNT(*) AS n FROM contenu_drive GROUP BY statut').map((l) => [l.statut, l.n]),
  );
  const parType = Object.fromEntries(
    tous('SELECT type, COUNT(*) AS n FROM contenu_drive GROUP BY type').map((l) => [l.type, l.n]),
  );
  const parTheme = Object.fromEntries(
    tous('SELECT theme, COUNT(*) AS n FROM contenu_drive GROUP BY theme').map((l) => [l.theme, l.n]),
  );
  let octets = 0;
  let fichiers = 0;
  for (const dossier of ['reels', 'stories', 'livre', 'photos', 'telecharges']) {
    const chemin = path.join(config.dossierDrive, dossier);
    if (!fs.existsSync(chemin)) continue;
    for (const fichier of fs.readdirSync(chemin)) {
      const stats = fs.statSync(path.join(chemin, fichier));
      if (stats.isFile()) {
        octets += stats.size;
        fichiers += 1;
      }
    }
  }
  return {
    parStatut,
    parType,
    parTheme,
    total: Object.values(parStatut).reduce((a, b) => a + b, 0),
    fichiers,
    octets,
    dossier: config.dossierDrive,
    googleDriveActif: config.googleDrive.active,
  };
}

/** URL publique d'un média à partir de son chemin relatif. */
export function urlMedia(cheminPublic) {
  if (!cheminPublic) return null;
  return `/media/${cheminPublic.split('/').map(encodeURIComponent).join('/')}`;
}

export function urlPubliqueAbsolue(cheminPublic, base) {
  const chemin = urlMedia(cheminPublic);
  return chemin ? `${base}${chemin}` : null;
}
