import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let base = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS meta (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  maj_le     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent (
  id                 TEXT PRIMARY KEY,
  nom                TEXT NOT NULL,
  prenom             TEXT NOT NULL DEFAULT '',
  role               TEXT NOT NULL,
  email              TEXT NOT NULL,
  statut             TEXT NOT NULL,
  fuseau_horaire     TEXT NOT NULL,
  configuration      TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS compte_instagram (
  id                    TEXT PRIMARY KEY,
  username              TEXT NOT NULL,
  mot_de_passe_chiffre  TEXT,
  nom_complet           TEXT,
  bio                   TEXT,
  lien_bio              TEXT,
  localisation          TEXT,
  age_minimum           INTEGER NOT NULL DEFAULT 25,
  gender                TEXT,
  date_creation         TEXT NOT NULL,
  derniere_activite     TEXT,
  cycle_actuel          INTEGER NOT NULL DEFAULT 0,
  date_fin_cycle        TEXT,
  configuration_ok      INTEGER NOT NULL DEFAULT 0,
  avatar                TEXT NOT NULL DEFAULT '{}',
  liens_a_suivre        TEXT NOT NULL DEFAULT '[]',
  jours_cycle           TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS parametres_audience (
  id                 TEXT PRIMARY KEY,
  agent_id           TEXT,
  compte_id          TEXT,
  age_minimum        INTEGER NOT NULL,
  pays_autorises     TEXT NOT NULL,
  pays_exclus        TEXT NOT NULL DEFAULT '[]',
  genre              TEXT NOT NULL DEFAULT 'NonPrecise',
  created_le         TEXT NOT NULL,
  maj_le             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle (
  id                TEXT PRIMARY KEY,
  compte_id         TEXT NOT NULL,
  numero_jour       INTEGER NOT NULL,
  cycle_numero      INTEGER NOT NULL,
  date_debut        TEXT NOT NULL,
  date_fin          TEXT NOT NULL,
  statut            TEXT NOT NULL,
  heure_debut       TEXT NOT NULL,
  heure_fin         TEXT NOT NULL,
  relance_auto      INTEGER NOT NULL DEFAULT 1,
  termine_le        TEXT
);

CREATE TABLE IF NOT EXISTS session_quotidienne (
  id                  TEXT PRIMARY KEY,
  cycle_id            TEXT,
  date                TEXT NOT NULL,
  heure_debut         TEXT NOT NULL,
  heure_fin           TEXT NOT NULL,
  duree_visionnage    INTEGER NOT NULL DEFAULT 0,
  statut              TEXT NOT NULL,
  demarre_le          TEXT,
  termine_le          TEXT,
  details             TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS contenu_drive (
  id              TEXT PRIMARY KEY,
  cycle_id        TEXT,
  type            TEXT NOT NULL,
  chemin_fichier  TEXT NOT NULL,
  chemin_public   TEXT,
  visibilite      TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  date_ajout       TEXT NOT NULL,
  date_publication TEXT,
  statut          TEXT NOT NULL,
  jour_prevu      INTEGER,
  format          TEXT NOT NULL DEFAULT 'objectif',
  theme           TEXT NOT NULL DEFAULT '',
  miniature       TEXT,
  source          TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS publication (
  id             TEXT PRIMARY KEY,
  compte_id      TEXT,
  cycle_id       TEXT,
  type           TEXT NOT NULL,
  contenu        TEXT NOT NULL,
  contenu_id     TEXT,
  date_heure     TEXT NOT NULL,
  statut         TEXT NOT NULL,
  lien           TEXT,
  likes          INTEGER NOT NULL DEFAULT 0,
  commentaires   INTEGER NOT NULL DEFAULT 0,
  vues           INTEGER NOT NULL DEFAULT 0,
  portee         INTEGER NOT NULL DEFAULT 0,
  interaction_id TEXT,
  jour           TEXT,
  erreur         TEXT
);

CREATE TABLE IF NOT EXISTS interaction (
  id               TEXT PRIMARY KEY,
  date             TEXT NOT NULL,
  type             TEXT NOT NULL,
  cible            TEXT NOT NULL,
  auteur           TEXT NOT NULL,
  auteur_pays      TEXT NOT NULL DEFAULT '',
  auteur_age       INTEGER NOT NULL DEFAULT 0,
  reference        INTEGER NOT NULL DEFAULT 0,
  contenu          TEXT NOT NULL,
  date_heure       TEXT NOT NULL,
  statut           TEXT NOT NULL,
  publication_id   TEXT,
  session_id       TEXT
);

CREATE TABLE IF NOT EXISTS compte_suivi (
  id                 TEXT PRIMARY KEY,
  compte_id          TEXT,
  username           TEXT NOT NULL,
  bio                TEXT NOT NULL DEFAULT '',
  pays               TEXT NOT NULL,
  tranche_age        TEXT NOT NULL DEFAULT '',
  est_reference      INTEGER NOT NULL DEFAULT 0,
  nombre_abonnes     INTEGER NOT NULL DEFAULT 0,
  nombre_publications INTEGER NOT NULL DEFAULT 0,
  categorie          TEXT NOT NULL DEFAULT '',
  date_dernier_suivi  TEXT,
  est_actif          INTEGER NOT NULL DEFAULT 1,
  score_attractivite REAL NOT NULL DEFAULT 0,
  created_le         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS abonnement (
  id                TEXT PRIMARY KEY,
  compte_suivi_id   TEXT NOT NULL,
  abonnement        TEXT NOT NULL,
  date_abonnement   TEXT NOT NULL,
  date_suivi        TEXT,
  suivi             INTEGER NOT NULL DEFAULT 0,
  actif             INTEGER NOT NULL DEFAULT 1,
  UNIQUE (compte_suivi_id, abonnement)
);

CREATE TABLE IF NOT EXISTS statistiques (
  id               TEXT PRIMARY KEY,
  compte_id        TEXT,
  cycle_id         TEXT,
  periode          TEXT NOT NULL,
  date             TEXT NOT NULL,
  vues             INTEGER NOT NULL DEFAULT 0,
  portee           INTEGER NOT NULL DEFAULT 0,
  abonnes_gagnes   INTEGER NOT NULL DEFAULT 0,
  likes            INTEGER NOT NULL DEFAULT 0,
  commentaires     INTEGER NOT NULL DEFAULT 0,
  interactions     INTEGER NOT NULL DEFAULT 0,
  publications     INTEGER NOT NULL DEFAULT 0,
  details          TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rapport (
  id             TEXT PRIMARY KEY,
  compte_id      TEXT,
  cycle_id       TEXT,
  type           TEXT NOT NULL,
  date           TEXT NOT NULL,
  contenu        TEXT NOT NULL,
  statistiques   TEXT NOT NULL DEFAULT '{}',
  problemes      TEXT NOT NULL DEFAULT '[]',
  envoye         INTEGER NOT NULL DEFAULT 0,
  genere_le      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cible (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  nom_affichage    TEXT NOT NULL,
  bio              TEXT NOT NULL DEFAULT '',
  pays             TEXT NOT NULL,
  genre            TEXT NOT NULL DEFAULT 'NonPrecise',
  tranche_age      TEXT NOT NULL DEFAULT '',
  age              INTEGER NOT NULL DEFAULT 0,
  interets         TEXT NOT NULL DEFAULT '[]',
  nombre_abonnes   INTEGER NOT NULL DEFAULT 0,
  nombre_abonnes_precedent INTEGER NOT NULL DEFAULT 0,
  score_attractivite REAL NOT NULL DEFAULT 0,
  statut           TEXT NOT NULL,
  motif_statut     TEXT NOT NULL DEFAULT '',
  est_compte_reference INTEGER NOT NULL DEFAULT 0,
  reference_id     TEXT,
  derniere_analyse TEXT,
  created_le       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS veille (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  source          TEXT NOT NULL,
  titre           TEXT NOT NULL,
  url             TEXT NOT NULL DEFAULT '',
  contenu         TEXT NOT NULL DEFAULT '',
  tendances       TEXT NOT NULL DEFAULT '[]',
  pays_cible      TEXT NOT NULL DEFAULT '[]',
  statut          TEXT NOT NULL,
  date_collecte   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_evenement (
  id          TEXT PRIMARY KEY,
  ts          TEXT NOT NULL,
  niveau      TEXT NOT NULL,
  categorie   TEXT NOT NULL,
  message     TEXT NOT NULL,
  donnees     TEXT NOT NULL DEFAULT '{}',
  jour        TEXT,
  cycle_id    TEXT
);

CREATE TABLE IF NOT EXISTS anomalie (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  severite    TEXT NOT NULL,
  message     TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '{}',
  statut      TEXT NOT NULL,
  detectee_le TEXT NOT NULL,
  resolue_le  TEXT,
  cycle_id    TEXT
);

CREATE TABLE IF NOT EXISTS execution (
  id             TEXT PRIMARY KEY,
  jour           TEXT NOT NULL,
  numero_jour    INTEGER NOT NULL,
  etape          TEXT NOT NULL,
  heure_prevue   TEXT NOT NULL,
  heure_reelle   TEXT,
  statut         TEXT NOT NULL,
  detail         TEXT NOT NULL DEFAULT '',
  cycle_id       TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  titre       TEXT NOT NULL,
  message     TEXT NOT NULL,
  niveau      TEXT NOT NULL,
  lu          INTEGER NOT NULL DEFAULT 0,
  date_notif  TEXT NOT NULL,
  lien        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_publication_jour ON publication (jour);
CREATE INDEX IF NOT EXISTS idx_publication_cycle ON publication (cycle_id);
CREATE INDEX IF NOT EXISTS idx_interaction_date ON interaction (date);
CREATE INDEX IF NOT EXISTS idx_session_date ON session_quotidienne (date);
CREATE INDEX IF NOT EXISTS idx_cycle_date ON cycle (date_debut);
CREATE INDEX IF NOT EXISTS idx_stats_date ON statistiques (date);
CREATE INDEX IF NOT EXISTS idx_journal_ts ON journal_evenement (ts);
CREATE INDEX IF NOT EXISTS idx_execution_jour ON execution (jour);
CREATE INDEX IF NOT EXISTS idx_contenu_statut ON contenu_drive (statut);
`;

export function ouvrirBase() {
  if (base) return base;
  fs.mkdirSync(config.dossierDonnees, { recursive: true });
  base = new DatabaseSync(config.fichierBase);
  base.exec(SCHEMA);
  return base;
}

export function db() {
  return base || ouvrirBase();
}

const cachePrepare = new Map();

function prepare(sql) {
  let stmt = cachePrepare.get(sql);
  if (!stmt) {
    stmt = db().prepare(sql);
    cachePrepare.set(sql, stmt);
  }
  return stmt;
}

/** Exécute une lecture et renvoie tous les résultats. */
export function tous(sql, ...params) {
  return prepare(sql).all(...params);
}

/** Exécute une lecture et renvoie la première ligne (ou undefined). */
export function un(sql, ...params) {
  return prepare(sql).get(...params);
}

/** Exécute une écriture et renvoie { changes, lastInsertRowid }. */
export function executer(sql, ...params) {
  return prepare(sql).run(...params);
}

export function transaction(fn) {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try {
    const resultat = fn();
    d.exec('COMMIT');
    return resultat;
  } catch (erreur) {
    try {
      d.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw erreur;
  }
}

export function lireMeta(cle, defaut = null) {
  const ligne = un('SELECT valeur FROM meta WHERE cle = ?', cle);
  if (!ligne) return defaut;
  try {
    return JSON.parse(ligne.valeur);
  } catch {
    return defaut;
  }
}

export function ecrireMeta(cle, valeur) {
  executer(
    `INSERT INTO meta (cle, valeur, maj_le) VALUES (?, ?, datetime('now'))
     ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur, maj_le = datetime('now')`,
    cle,
    JSON.stringify(valeur),
  );
}

export function baseVide() {
  const tables = tous(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  return tables.every((t) => (un(`SELECT COUNT(*) AS n FROM ${t.name}`)?.n ?? 0) === 0);
}

export function fermerBase() {
  if (base) {
    try {
      base.close();
    } catch {
      /* ignore */
    }
    base = null;
    cachePrepare.clear();
  }
}
