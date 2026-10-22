import { executer, tous, un, ecrireMeta, lireMeta } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { AVATAR, COMPTES_REFERENCE } from '../donnees/personas.js';
import { chiffrer, dechiffrer, masquer } from './chiffrement.js';
import { journaliser } from './journal.js';

export function mapperCompte(ligne) {
  if (!ligne) return null;
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
    motDePasseChiffre: ligne.mot_de_passe_chiffre,
  };
}

export function assurerCompte() {
  const existant = un('SELECT * FROM compte_instagram LIMIT 1');
  if (existant) return mapperCompte(existant);
  // En production, le compte est fourni par le responsable : rien n'est inventé.
  if (config.production) return null;
  const id = uuid();
  const date = new Date().toISOString();
  const avatar = {
    nom: AVATAR.nomComplet,
    username: AVATAR.username,
    nomInstagram: AVATAR.nomInstagram,
    bio: AVATAR.bio,
    lienBio: AVATAR.lienBio,
    localisation: AVATAR.localisation,
    palette: 'corail',
    genre: AVATAR.genre,
    ageAffiche: AVATAR.ageAffiche,
    signes: AVATAR.signesParticuliers,
  };
  executer(
    `INSERT INTO compte_instagram
      (id, username, nom_complet, bio, lien_bio, localisation, age_minimum, gender,
       date_creation, cycle_actuel, configuration_ok, avatar, liens_a_suivre, jours_cycle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, '{}')`,
    id,
    AVATAR.username,
    AVATAR.nomInstagram,
    AVATAR.bio,
    AVATAR.lienBio,
    AVATAR.localisation,
    config.ageMinimum,
    AVATAR.genre,
    date,
    JSON.stringify(avatar),
    JSON.stringify(COMPTES_REFERENCE.map((c) => c.username)),
  );
  journaliser('Compte Instagram créé et configuré (avatar IA Maya Rivera).', {
    categorie: 'compte',
    donnees: { username: AVATAR.username },
  });
  return mapperCompte(un('SELECT * FROM compte_instagram WHERE id = ?', id));
}

export function compteCourant() {
  return mapperCompte(un('SELECT * FROM compte_instagram LIMIT 1'));
}

export function comptePublic() {
  const compte = compteCourant();
  if (!compte) return null;
  const { motDePasseChiffre, ...reste } = compte;
  const abonnes = un(
    `SELECT
       (SELECT COUNT(*) FROM abonnement WHERE actif = 1) -
       (SELECT COALESCE(SUM(abonnes_gagnes), 0) FROM statistiques) AS brut`,
  );
  return {
    ...reste,
    motDePasseMasque: motDePasseChiffre ? masquer(dechiffrer(motDePasseChiffre) || 'motdepasse') : '',
    abonnes: Math.max(0, 480 + (abonnes?.brut ?? 0)),
    statut: compte.configurationOk ? 'Configuré' : 'Non configuré',
    fuseau: config.fuseau,
    mode: config.modeInstagram,
  };
}

/** R1 — configuration manuelle du profil, réalisée une seule fois. */
export function configurerManuellement(payload = {}) {
  const compte = assurerCompte();
  const avatar = { ...compte.avatar, ...(payload.avatar || {}) };
  const username = normaliser(payload.username ?? compte.username);
  const bio = String(payload.bio ?? avatar.bio ?? compte.bio ?? '').slice(0, 220);
  const nomComplet = String(payload.nomComplet ?? avatar.nomInstagram ?? compte.nomComplet ?? '').slice(0, 60);
  executer(
    `UPDATE compte_instagram SET
      username = ?, nom_complet = ?, bio = ?, lien_bio = ?, localisation = ?,
      age_minimum = ?, gender = ?, avatar = ?, liens_a_suivre = ?,
      configuration_ok = 1, derniere_activite = ?
     WHERE id = ?`,
    username,
    nomComplet,
    bio,
    payload.lienBio ?? avatar.lienBio ?? compte.lienBio,
    payload.localisation ?? avatar.localisation ?? compte.localisation,
    Math.max(config.ageMinimum, Number(payload.ageMinimum ?? compte.ageMinimum ?? config.ageMinimum)),
    payload.gender ?? compte.gender ?? AVATAR.genre,
    JSON.stringify({ ...avatar, bio, nomInstagram: nomComplet }),
    JSON.stringify(payload.liensASuivre ?? compte.liensASuivre),
    new Date().toISOString(),
    compte.id,
  );
  if (payload.motDePasse) {
    executer('UPDATE compte_instagram SET mot_de_passe_chiffre = ? WHERE id = ?', chiffrer(payload.motDePasse), compte.id);
  }
  journaliser('Profil du compte mis à jour manuellement (R1).', {
    categorie: 'compte',
    donnees: { username },
  });
  return comptePublic();
}

function normaliser(pseudo) {
  return String(pseudo || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}

export function enregistrerLiensASuivre(liens) {
  const compte = assurerCompte();
  executer('UPDATE compte_instagram SET liens_a_suivre = ? WHERE id = ?', JSON.stringify(liens), compte.id);
  return liens;
}

export function definirCycleActuel(numero, dateFin) {
  const compte = assurerCompte();
  executer('UPDATE compte_instagram SET cycle_actuel = ?, date_fin_cycle = ? WHERE id = ?', numero, dateFin, compte.id);
}

export function marquerJourCycle(jour, donnees) {
  const compte = assurerCompte();
  const jours = { ...compte.joursCycle, [jour]: donnees };
  executer('UPDATE compte_instagram SET jours_cycle = ?, derniere_activite = ? WHERE id = ?',
    JSON.stringify(jours), new Date().toISOString(), compte.id);
}

/** Rerattrapage / relance du cycle : la configuration initiale est conservée. */
export function reinitialiserCycle({ conserverHistorique = true } = {}) {
  const compte = assurerCompte();
  executer(
    'UPDATE compte_instagram SET cycle_actuel = 0, date_fin_cycle = NULL, jours_cycle = ? WHERE id = ?',
    JSON.stringify({}),
    compte.id,
  );
  if (!conserverHistorique) {
    for (const table of ['publication', 'interaction', 'session_quotidienne', 'statistiques', 'rapport', 'execution', 'anomalie', 'notification']) {
      executer(`DELETE FROM ${table}`);
    }
  }
  journaliser(conserverHistorique ? 'Cycle réinitialisé (historique conservé).' : 'Toutes les données du cycle ont été effacées.', {
    categorie: 'cycle',
    niveau: 'alerte',
  });
  return comptePublic();
}

export function archiverDonnees() {
  const compte = assurerCompte();
  const archives = Number(lireMeta('archives', 0)) + 1;
  ecrireMeta('archives', archives);
  executer(`UPDATE contenu_drive SET visibilite = 'prive' WHERE statut = 'Archive'`);
  journaliser(`Données archivées (archive n°${archives}).`, { categorie: 'compte' });
  return { archives, compte: compte.username };
}

export function recupererStatistiques() {
  return un(
    `SELECT COUNT(*) AS publications, COALESCE(SUM(likes), 0) AS likes, COALESCE(SUM(commentaires), 0) AS commentaires
     FROM publication WHERE statut = 'Publiee'`,
  );
}

export function compterPublications() {
  return un(`SELECT COUNT(*) AS n FROM publication`)?.n ?? 0;
}

export function listeComptesSuivis() {
  return tous('SELECT * FROM compte_suivi ORDER BY est_reference DESC, score_attractivite DESC');
}
