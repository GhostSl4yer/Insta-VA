import fs from 'node:fs';
import path from 'node:path';
import { executer, tous, un, lireMeta, ecrireMeta } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { chiffrer, dechiffrer, masquer } from './chiffrement.js';
import { journaliser } from './journal.js';
import { compteIdCourant, exigerCompte } from './contexte.js';

/**
 * Comptes Instagram gérés par l'installation.
 *
 * Une seule base, un seul processus, plusieurs comptes : chaque ligne de données
 * porte un `compte_id` (voir `db.js`). Ce module porte le référentiel — profil,
 * identifiants Graph chiffrés, lien du dossier Drive partagé, fuseau et heure de
 * début — ainsi que l'import en masse (CSV / JSON) pour les ~50 comptes.
 */

const STATUTS = new Set(['Actif', 'EnAttente', 'Suspendu', 'Erreur']);

/* ─────────────────────────── mapping ─────────────────────────── */

export function mapperCompte(ligne) {
  if (!ligne) return null;
  const jeton = dechiffrer(ligne.jeton_chiffre);
  return {
    id: ligne.id,
    username: ligne.username,
    nomComplet: ligne.nom_complet,
    bio: ligne.bio,
    lienBio: ligne.lien_bio,
    localisation: ligne.localisation,
    ageMinimum: ligne.age_minimum,
    gender: ligne.gender,
    dateCreation: ligne.date_creation,
    derniereActivite: ligne.derniere_activite,
    cycleActuel: ligne.cycle_actuel,
    dateFinCycle: ligne.date_fin_cycle,
    configurationOk: Boolean(ligne.configuration_ok),
    avatar: JSON.parse(ligne.avatar || '{}'),
    liensASuivre: JSON.parse(ligne.liens_a_suivre || '[]'),
    joursCycle: JSON.parse(ligne.jours_cycle || '{}'),
    // Multi-comptes
    igUserId: ligne.ig_user_id || '',
    jetonConfigure: Boolean(jeton),
    jetonMasque: jeton ? masquer(jeton) : '',
    driveUrl: ligne.drive_url || '',
    driveFolderId: ligne.drive_folder_id || '',
    driveSousDossiers: JSON.parse(ligne.drive_sous_dossiers || '{}'),
    fuseau: ligne.fuseau || config.fuseau,
    heureDebut: ligne.heure_debut || config.heureDebut,
    statut: ligne.statut || 'EnAttente',
    actif: Boolean(ligne.actif),
    notes: ligne.notes || '',
    derniereSync: ligne.derniere_sync,
    derniereErreur: ligne.derniere_erreur,
  };
}

/** Vue publique : jamais de jeton, même chiffré. */
export function comptePublic(compte = null) {
  const courant = compte || compteCourant();
  if (!courant) return null;
  const { jetonMasque, ...reste } = courant;
  return {
    ...reste,
    jetonMasque,
    abonnes: abonnesEstimes(),
  };
}

/* ─────────────────────────── lecture ─────────────────────────── */

export function listerComptes() {
  return tous('SELECT * FROM compte_instagram ORDER BY actif DESC, username ASC').map(mapperCompte);
}

export function compterComptes() {
  return un('SELECT COUNT(*) AS n FROM compte_instagram')?.n ?? 0;
}

export function compterComptesActifs() {
  return un(`SELECT COUNT(*) AS n FROM compte_instagram WHERE actif = 1 AND statut = 'Actif'`)?.n ?? 0;
}

export function compteParId(id) {
  return mapperCompte(un('SELECT * FROM compte_instagram WHERE id = ?', id));
}

export function compteParUsername(username) {
  return mapperCompte(un('SELECT * FROM compte_instagram WHERE lower(username) = lower(?)', String(username || '').trim()));
}

/** Compte de la portée courante. */
export function compteCourant() {
  const id = compteIdCourant();
  if (!id) return null;
  return compteParId(id);
}

/** Premier compte actif : sélection par défaut à la connexion. */
export function premierCompte() {
  return mapperCompte(
    un(`SELECT * FROM compte_instagram WHERE actif = 1 ORDER BY date_creation ASC LIMIT 1`) ||
      un('SELECT * FROM compte_instagram ORDER BY date_creation ASC LIMIT 1'),
  );
}

/* ─────────────────────────── validation ─────────────────────────── */

export function normaliserPseudo(pseudo) {
  return String(pseudo || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}

/**
 * Extrait l'identifiant d'un dossier Drive depuis un lien partagé.
 * Accepte les formes usuelles et l'identifiant brut.
 */
export function parserLienDrive(valeur) {
  const texte = String(valeur || '').trim();
  if (!texte) return { folderId: '', url: '' };
  const motifs = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /^([a-zA-Z0-9_-]{10,})$/,
  ];
  for (const motif of motifs) {
    const trouve = texte.match(motif);
    if (trouve) {
      return {
        folderId: trouve[1],
        url: `https://drive.google.com/drive/folders/${trouve[1]}`,
      };
    }
  }
  const erreur = new Error('Lien Drive invalide : collez le lien du dossier partagé (…/folders/<id>).');
  erreur.statut = 400;
  throw erreur;
}

function fuseauValide(fuseau) {
  if (!fuseau) return false;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau });
    return true;
  } catch {
    return false;
  }
}

function heureValide(heure) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(heure || ''));
}

/** Un compte est « Actif » quand toutes ses variables sont réellement renseignées. */
export function etatCompte(compte) {
  const manquants = [];
  if (!compte.username) manquants.push('nom d’utilisateur');
  if (!compte.igUserId) manquants.push('identifiant Instagram (IG_USER_ID)');
  if (!compte.jetonConfigure) manquants.push('jeton d’accès');
  if (!compte.driveFolderId) manquants.push('dossier Drive partagé');
  if (!compte.bio || !compte.nomComplet) manquants.push('profil (nom et bio)');
  return { complete: manquants.length === 0, manquants };
}

/* ─────────────────────────── écriture ─────────────────────────── */

function champs(payload, base = {}) {
  const drive = payload.driveUrl !== undefined ? parserLienDrive(payload.driveUrl) : null;
  const fuseau = payload.fuseau ?? base.fuseau ?? config.fuseau;
  if (fuseauValide(fuseau) === false) {
    const erreur = new Error(`Fuseau horaire inconnu : ${fuseau}`);
    erreur.statut = 400;
    throw erreur;
  }
  const heureDebut = payload.heureDebut ?? base.heureDebut ?? config.heureDebut;
  if (!heureValide(heureDebut)) {
    const erreur = new Error('Heure de début invalide (format HH:MM).');
    erreur.statut = 400;
    throw erreur;
  }
  return {
    username: normaliserPseudo(payload.username ?? base.username),
    nomComplet: String(payload.nomComplet ?? base.nomComplet ?? '').slice(0, 60),
    bio: String(payload.bio ?? base.bio ?? '').slice(0, 220),
    lienBio: String(payload.lienBio ?? base.lienBio ?? '').slice(0, 300),
    localisation: String(payload.localisation ?? base.localisation ?? '').slice(0, 80),
    ageMinimum: Math.max(config.ageMinimum, Number(payload.ageMinimum ?? base.ageMinimum ?? config.ageMinimum)),
    gender: payload.gender ?? base.gender ?? 'NonPrecise',
    igUserId: String(payload.igUserId ?? base.igUserId ?? '').replace(/[^0-9]/g, ''),
    driveUrl: drive ? drive.url : base.driveUrl || '',
    driveFolderId: drive ? drive.folderId : base.driveFolderId || '',
    fuseau,
    heureDebut,
    notes: String(payload.notes ?? base.notes ?? '').slice(0, 500),
    actif: payload.actif === undefined ? (base.actif ?? true) : Boolean(payload.actif),
    statutManuel: payload.statut && STATUTS.has(payload.statut) ? payload.statut : null,
  };
}

export function creerCompte(payload = {}) {
  const valeurs = champs(payload);
  if (!valeurs.username) {
    const erreur = new Error('Le nom d’utilisateur Instagram est obligatoire.');
    erreur.statut = 400;
    throw erreur;
  }
  if (compteParUsername(valeurs.username)) {
    const erreur = new Error(`Le compte @${valeurs.username} existe déjà.`);
    erreur.statut = 409;
    throw erreur;
  }
  const id = uuid();
  const maintenant = new Date().toISOString();
  executer(
    `INSERT INTO compte_instagram
      (id, username, nom_complet, bio, lien_bio, localisation, age_minimum, gender,
       date_creation, cycle_actuel, configuration_ok, avatar, liens_a_suivre, jours_cycle,
       ig_user_id, jeton_chiffre, drive_url, drive_folder_id, fuseau, heure_debut, statut, actif, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '{}', '[]', '{}', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    valeurs.username,
    valeurs.nomComplet,
    valeurs.bio,
    valeurs.lienBio,
    valeurs.localisation,
    valeurs.ageMinimum,
    valeurs.gender,
    maintenant,
    valeurs.igUserId,
    payload.jeton ? chiffrer(String(payload.jeton).trim()) : '',
    valeurs.driveUrl,
    valeurs.driveFolderId,
    valeurs.fuseau,
    valeurs.heureDebut,
    valeurs.statutManuel || 'EnAttente',
    valeurs.actif ? 1 : 0,
    valeurs.notes,
  );
  rafraichirStatut(id);
  return compteParId(id);
}

export function majCompte(id, payload = {}) {
  const base = compteParId(id);
  if (!base) {
    const erreur = new Error('Compte introuvable.');
    erreur.statut = 404;
    throw erreur;
  }
  const valeurs = champs(payload, base);
  const doublon = compteParUsername(valeurs.username);
  if (doublon && doublon.id !== id) {
    const erreur = new Error(`Le compte @${valeurs.username} existe déjà.`);
    erreur.statut = 409;
    throw erreur;
  }
  executer(
    `UPDATE compte_instagram SET
      username = ?, nom_complet = ?, bio = ?, lien_bio = ?, localisation = ?,
      age_minimum = ?, gender = ?, ig_user_id = ?, drive_url = ?, drive_folder_id = ?,
      fuseau = ?, heure_debut = ?, notes = ?, actif = ?,
      jeton_chiffre = COALESCE(NULLIF(?, ''), jeton_chiffre),
      configuration_ok = CASE WHEN ? != '' AND ? != '' AND ? != '' AND ? != '' THEN 1 ELSE configuration_ok END,
      derniere_activite = ?
     WHERE id = ?`,
    valeurs.username,
    valeurs.nomComplet,
    valeurs.bio,
    valeurs.lienBio,
    valeurs.localisation,
    valeurs.ageMinimum,
    valeurs.gender,
    valeurs.igUserId,
    valeurs.driveUrl,
    valeurs.driveFolderId,
    valeurs.fuseau,
    valeurs.heureDebut,
    valeurs.notes,
    valeurs.actif ? 1 : 0,
    payload.jeton ? chiffrer(String(payload.jeton).trim()) : '',
    valeurs.nomComplet,
    valeurs.bio,
    valeurs.igUserId,
    payload.jeton ? 'nouveau' : base.jetonConfigure ? 'existant' : '',
    new Date().toISOString(),
    id,
  );
  rafraichirStatut(id);
  journaliser(`Compte @${valeurs.username} mis à jour.`, { categorie: 'compte' });
  return compteParId(id);
}

/** Recalcule le statut à partir des variables réellement présentes. */
export function rafraichirStatut(id) {
  const compte = compteParId(id);
  if (!compte) return null;
  const { complete } = etatCompte(compte);
  let statut = compte.statut;
  if (!compte.actif) statut = 'Suspendu';
  else if (complete) statut = 'Actif';
  else if (statut === 'Erreur') statut = 'EnAttente';
  else statut = 'EnAttente';
  executer('UPDATE compte_instagram SET statut = ?, configuration_ok = ? WHERE id = ?', statut, complete ? 1 : 0, id);
  return statut;
}

export function definirStatut(id, statut) {
  executer('UPDATE compte_instagram SET statut = ?, actif = ? WHERE id = ?', statut, statut === 'Suspendu' ? 0 : 1, id);
  return compteParId(id);
}

export function enregistrerErreurCompte(id, erreur) {
  executer('UPDATE compte_instagram SET derniere_erreur = ? WHERE id = ?', String(erreur || '').slice(0, 500), id);
}

export function marquerSync(id) {
  executer('UPDATE compte_instagram SET derniere_sync = ? WHERE id = ?', new Date().toISOString(), id);
}

/** Suppression définitive d'un compte : données cloisonnées + fichiers locaux. */
export function supprimerCompte(id) {
  const compte = compteParId(id);
  if (!compte) return null;
  executer('DELETE FROM publication WHERE compte_id = ?', id);
  executer('DELETE FROM cycle WHERE compte_id = ?', id);
  for (const table of [
    'session_quotidienne',
    'contenu_drive',
    'interaction',
    'abonnement',
    'cible',
    'veille',
    'journal_evenement',
    'anomalie',
    'execution',
    'notification',
    'lien_suivi',
    'reponse_commentaire',
    'statistiques',
    'rapport',
    'parametres_audience',
    'compte_suivi',
  ]) {
    executer(`DELETE FROM ${table} WHERE compte_id = ?`, id);
  }
  executer('DELETE FROM etat_moteur WHERE compte_id = ?', id);
  executer(`DELETE FROM compte_instagram WHERE id = ?`, id);
  try {
    fs.rmSync(config.dossierCompte(id), { recursive: true, force: true });
  } catch {
    /* fichiers déjà absents */
  }
  journaliser(`Compte @${compte.username} supprimé avec ses données.`, { categorie: 'compte', niveau: 'alerte' });
  return compte;
}

/* ─────────────────────────── import en masse ─────────────────────────── */

function decouperLigne(ligne, separateur) {
  const cellules = [];
  let courant = '';
  let guillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i];
    if (c === '"') {
      if (guillemets && ligne[i + 1] === '"') {
        courant += '"';
        i += 1;
      } else {
        guillemets = !guillemets;
      }
    } else if (c === separateur && !guillemets) {
      cellules.push(courant.trim());
      courant = '';
    } else {
      courant += c;
    }
  }
  cellules.push(courant.trim());
  return cellules;
}

/**
 * Importe des comptes depuis un JSON (tableau d'objets) ou un CSV avec en-tête.
 * Colonnes reconnues : username, nom, bio, ig_user_id, jeton, drive_url,
 * fuseau, heure_debut, notes, lien_bio.
 */
export function importerComptes(texte) {
  const contenu = String(texte || '').trim();
  if (!contenu) {
    const erreur = new Error('Import vide.');
    erreur.statut = 400;
    throw erreur;
  }
  let lignes = [];
  if (contenu.startsWith('[') || contenu.startsWith('{')) {
    const donnees = JSON.parse(contenu);
    lignes = Array.isArray(donnees) ? donnees : [donnees];
    lignes = lignes.map((l) => ({
      username: l.username,
      nomComplet: l.nomComplet ?? l.nom,
      bio: l.bio,
      lienBio: l.lienBio ?? l.lien_bio,
      igUserId: l.igUserId ?? l.ig_user_id,
      jeton: l.jeton ?? l.token ?? l.access_token,
      driveUrl: l.driveUrl ?? l.drive_url ?? l.drive,
      fuseau: l.fuseau ?? l.timezone,
      heureDebut: l.heureDebut ?? l.heure_debut,
      notes: l.notes,
    }));
  } else {
    const brut = contenu.split(/\r?\n/).filter((l) => l.trim());
    const separateur = (brut[0].match(/;/g) || []).length > (brut[0].match(/,/g) || []).length ? ';' : ',';
    const entetes = decouperLigne(brut[0], separateur).map((e) => e.toLowerCase().replace(/[^a-z_]/g, ''));
    const index = (noms) => entetes.findIndex((e) => noms.includes(e));
    const iUsername = index(['username', 'utilisateur', 'compte']);
    const iNom = index(['nom', 'nomcomplet', 'nom_complet']);
    const iBio = index(['bio']);
    const iLienBio = index(['lienbio', 'lien_bio']);
    const iUser = index(['iguserid', 'ig_user_id', 'userid', 'identifiant']);
    const iJeton = index(['jeton', 'token', 'access_token', 'jetonacces']);
    const iDrive = index(['driveurl', 'drive_url', 'drive', 'dossierdrive']);
    const iFuseau = index(['fuseau', 'timezone', 'fuseau_horaire']);
    const iHeure = index(['heuredebut', 'heure_debut', 'heure']);
    const iNotes = index(['notes', 'note']);
    if (iUsername < 0) {
      const erreur = new Error('En-tête CSV invalide : la colonne « username » est obligatoire.');
      erreur.statut = 400;
      throw erreur;
    }
    for (const ligne of brut.slice(1)) {
      const c = decouperLigne(ligne, separateur);
      const valeur = (i) => (i >= 0 ? c[i] || '' : '');
      lignes.push({
        username: valeur(iUsername),
        nomComplet: valeur(iNom),
        bio: valeur(iBio),
        lienBio: valeur(iLienBio),
        igUserId: valeur(iUser),
        jeton: valeur(iJeton),
        driveUrl: valeur(iDrive),
        fuseau: valeur(iFuseau),
        heureDebut: valeur(iHeure),
        notes: valeur(iNotes),
      });
    }
  }

  const resultat = { crees: [], maj: [], erreurs: [] };
  for (const [position, ligne] of lignes.entries()) {
    const username = normaliserPseudo(ligne.username);
    if (!username) {
      resultat.erreurs.push({ ligne: position + 1, message: 'username manquant' });
      continue;
    }
    try {
      const existant = compteParUsername(username);
      if (existant) {
        majCompte(existant.id, ligne);
        resultat.maj.push(username);
      } else {
        creerCompte(ligne);
        resultat.crees.push(username);
      }
    } catch (erreur) {
      resultat.erreurs.push({ ligne: position + 1, username, message: erreur.message });
    }
  }
  journaliser(`Import de comptes : ${resultat.crees.length} créé(s), ${resultat.maj.length} mis à jour, ${resultat.erreurs.length} erreur(s).`, {
    categorie: 'compte',
    niveau: resultat.erreurs.length ? 'alerte' : 'info',
  });
  return resultat;
}

/* ─────────────────────────── cycle & profil du compte ─────────────────────────── */

/** R1 — configuration manuelle du profil, réalisée une seule fois par compte. */
export function configurerManuellement(payload = {}) {
  const id = exigerCompte();
  const compte = compteParId(id);
  if (!compte) {
    const erreur = new Error('Compte introuvable.');
    erreur.statut = 404;
    throw erreur;
  }
  const avatar = { ...compte.avatar, ...(payload.avatar || {}) };
  const username = normaliserPseudo(payload.username ?? compte.username);
  const bio = String(payload.bio ?? compte.bio ?? '').slice(0, 220);
  const nomComplet = String(payload.nomComplet ?? compte.nomComplet ?? '').slice(0, 60);
  majCompte(id, {
    username,
    nomComplet,
    bio,
    lienBio: payload.lienBio ?? compte.lienBio,
    localisation: payload.localisation ?? compte.localisation,
    ageMinimum: payload.ageMinimum,
    gender: payload.gender,
    jeton: payload.motDePasse,
  });
  executer(
    `UPDATE compte_instagram SET avatar = ?, liens_a_suivre = ? WHERE id = ?`,
    JSON.stringify({ ...avatar, bio, nomInstagram: nomComplet }),
    JSON.stringify(payload.liensASuivre ?? compte.liensASuivre),
    id,
  );
  journaliser('Profil du compte mis à jour manuellement (R1).', {
    categorie: 'compte',
    donnees: { username },
  });
  return comptePublic(compteParId(id));
}

export function enregistrerLiensASuivre(liens) {
  const id = exigerCompte();
  executer('UPDATE compte_instagram SET liens_a_suivre = ? WHERE id = ?', JSON.stringify(liens), id);
  return liens;
}

export function definirCycleActuel(numero, dateFin) {
  const id = exigerCompte();
  executer('UPDATE compte_instagram SET cycle_actuel = ?, date_fin_cycle = ? WHERE id = ?', numero, dateFin, id);
}

export function marquerJourCycle(jour, donnees) {
  const id = exigerCompte();
  const compte = compteParId(id);
  const jours = { ...compte.joursCycle, [jour]: donnees };
  executer(
    'UPDATE compte_instagram SET jours_cycle = ?, derniere_activite = ? WHERE id = ?',
    JSON.stringify(jours),
    new Date().toISOString(),
    id,
  );
}

/** Relance du cycle : la configuration initiale est conservée. */
export function reinitialiserCycle({ conserverHistorique = true } = {}) {
  const id = exigerCompte();
  executer(
    'UPDATE compte_instagram SET cycle_actuel = 0, date_fin_cycle = NULL, jours_cycle = ? WHERE id = ?',
    JSON.stringify({}),
    id,
  );
  if (!conserverHistorique) {
    for (const table of [
      'publication',
      'interaction',
      'session_quotidienne',
      'statistiques',
      'rapport',
      'execution',
      'anomalie',
      'notification',
      'contenu_drive',
    ]) {
      executer(`DELETE FROM ${table} WHERE compte_id = ?`, id);
    }
  }
  journaliser(conserverHistorique ? 'Cycle réinitialisé (historique conservé).' : 'Toutes les données du cycle ont été effacées.', {
    categorie: 'cycle',
    niveau: 'alerte',
  });
  return comptePublic(compteParId(id));
}

export function archiverDonnees() {
  const id = exigerCompte();
  const archives = Number(lireMeta('archives', 0)) + 1;
  ecrireMeta('archives', archives);
  executer(`UPDATE contenu_drive SET visibilite = 'prive' WHERE statut = 'Archive' AND compte_id = ?`, id);
  journaliser(`Données archivées (archive n°${archives}).`, { categorie: 'compte' });
  return { archives, compte: compteParId(id)?.username };
}

export function recupererStatistiques() {
  const id = exigerCompte();
  return un(
    `SELECT COUNT(*) AS publications, COALESCE(SUM(likes), 0) AS likes, COALESCE(SUM(commentaires), 0) AS commentaires
     FROM publication WHERE statut = 'Publiee' AND compte_id = ?`,
    id,
  );
}

export function compterPublications() {
  const id = exigerCompte();
  return un(`SELECT COUNT(*) AS n FROM publication WHERE compte_id = ?`, id)?.n ?? 0;
}

function abonnesEstimes() {
  const id = compteIdCourant();
  if (!id) return 0;
  return un(
    `SELECT COALESCE(SUM(abonnes_gagnes), 0) AS n FROM statistiques WHERE compte_id = ?`,
    id,
  )?.n ?? 0;
}
