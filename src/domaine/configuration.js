import { config } from '../config.js';
import { un, executer, ecrireMeta, lireMeta } from '../db.js';
import { uuid } from '../utils/ids.js';
import { chiffrer, dechiffrer, masquer } from './chiffrement.js';
import { journaliser } from './journal.js';

/**
 * Mise en service de la production : **aucune donnée n'est inventée**.
 *
 * L'application démarre « non configurée » et attend que le responsable
 * fournisse le compte, le profil, l'audience, les identifiants Graph et au
 * moins un contenu. Tant que ce n'est pas fait, le moteur ne tourne pas.
 */

const PAYS_VALIDES = ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'];
const GENRES = ['Homme', 'Femme', 'NonPrecise', 'Autre'];

const texte = (valeur, max = 500) => String(valeur ?? '').trim().slice(0, max);

class ErreurConfiguration extends Error {
  constructor(message, champ = null) {
    super(message);
    this.statut = 400;
    this.champ = champ;
  }
}

/* ───────────────────────── identifiants Graph ───────────────────────── */

export function identifiantsGraph() {
  const userId = lireMeta('graph.user_id', '') || config.graph.userId;
  const tokenChiffre = lireMeta('graph.token', '') || '';
  let token = config.graph.token;
  if (tokenChiffre) {
    try {
      token = dechiffrer(tokenChiffre) || token;
    } catch {
      /* token illisible : on garde la valeur d'environnement */
    }
  }
  return {
    userId: String(userId || ''),
    token: String(token || ''),
    version: config.graph.version,
    configure: Boolean(userId && token),
    source: tokenChiffre ? 'console' : config.graph.token ? 'environnement' : 'aucune',
  };
}

export function enregistrerIdentifiantsGraph({ userId, token } = {}) {
  const idCompte = texte(userId, 64);
  const jeton = texte(token, 2000);
  if (idCompte && !/^[A-Za-z0-9._-]{3,64}$/.test(idCompte)) {
    throw new ErreurConfiguration('Identifiant de compte Instagram invalide.', 'userId');
  }
  if (jeton && jeton.length < 20) {
    throw new ErreurConfiguration('Le jeton d’accès semble trop court.', 'token');
  }
  if (idCompte) ecrireMeta('graph.user_id', idCompte);
  if (jeton) ecrireMeta('graph.token', chiffrer(jeton));
  journaliser('Identifiants Instagram Graph enregistrés depuis la console.', {
    categorie: 'compte',
    donnees: { userId: idCompte || '(inchangé)', token: jeton ? 'renseigné' : '(inchangé)' },
  });
  const identifiants = identifiantsGraph();
  return {
    userId: identifiants.userId,
    tokenMasque: identifiants.token ? masquer(identifiants.token) : '',
    configure: identifiants.configure,
    source: identifiants.source,
  };
}

/* ───────────────────────── compte & profil ───────────────────────── */

export function compteExistant() {
  return un('SELECT * FROM compte_instagram LIMIT 1') || null;
}

function validerCompte(payload = {}) {
  const username = texte(payload.username, 30).replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{2,30}$/.test(username)) {
    throw new ErreurConfiguration('Nom d’utilisateur invalide (lettres, chiffres, points et tirets bas).', 'username');
  }
  const nomComplet = texte(payload.nomComplet, 80);
  if (!nomComplet) throw new ErreurConfiguration('Le nom affiché est requis.', 'nomComplet');

  const bio = texte(payload.bio, 500);
  const lienBio = texte(payload.lienBio, 300);
  if (lienBio && !/^https?:\/\/[^\s]+$/i.test(lienBio)) {
    throw new ErreurConfiguration('Le lien de la bio doit commencer par http:// ou https://.', 'lienBio');
  }
  const localisation = texte(payload.localisation, 80);
  const genre = GENRES.includes(payload.genre) ? payload.genre : 'NonPrecise';
  const ageMinimum = Math.max(25, Number(payload.ageMinimum) || 25);
  return { username, nomComplet, bio, lienBio, localisation, genre, ageMinimum };
}

/**
 * Crée (ou met à jour) le compte réel. Première étape obligatoire de la mise en service.
 */
export function enregistrerCompte(payload = {}) {
  const donnees = validerCompte(payload);
  const existant = compteExistant();
  const date = new Date().toISOString();
  const avatar = {
    nom: donnees.nomComplet,
    username: donnees.username,
    nomInstagram: donnees.nomComplet,
    bio: donnees.bio,
    lienBio: donnees.lienBio,
    localisation: donnees.localisation,
    genre: donnees.genre,
    palette: texte(payload.palette, 20) || 'corail',
    ageAffiche: null,
    signes: '',
    fourni: true,
  };

  if (existant) {
    executer(
      `UPDATE compte_instagram
          SET username = ?, nom_complet = ?, bio = ?, lien_bio = ?, localisation = ?,
              age_minimum = ?, gender = ?, avatar = ?
        WHERE id = ?`,
      donnees.username,
      donnees.nomComplet,
      donnees.bio,
      donnees.lienBio,
      donnees.localisation,
      donnees.ageMinimum,
      donnees.genre,
      JSON.stringify(avatar),
      existant.id,
    );
    journaliser('Profil du compte mis à jour depuis la console.', {
      categorie: 'compte',
      donnees: { username: donnees.username },
    });
  } else {
    executer(
      `INSERT INTO compte_instagram
        (id, username, nom_complet, bio, lien_bio, localisation, age_minimum, gender,
         date_creation, cycle_actuel, configuration_ok, avatar, liens_a_suivre, jours_cycle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, '[]', '{}')`,
      uuid(),
      donnees.username,
      donnees.nomComplet,
      donnees.bio,
      donnees.lienBio,
      donnees.localisation,
      donnees.ageMinimum,
      donnees.genre,
      date,
      JSON.stringify(avatar),
    );
    journaliser(`Compte @${donnees.username} déclaré comme compte de production.`, {
      categorie: 'compte',
      donnees: { username: donnees.username },
    });
  }

  ecrireMeta('compte.fourni', true);
  return un('SELECT * FROM compte_instagram LIMIT 1');
}

/* ───────────────────────── agent responsable ───────────────────────── */

export function enregistrerAgent(payload = {}) {
  const nom = texte(payload.nom, 60);
  const prenom = texte(payload.prenom, 60);
  const email = texte(payload.email, 120);
  if (!nom) throw new ErreurConfiguration('Le nom du responsable est requis.', 'nom');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErreurConfiguration('Adresse e-mail invalide.', 'email');
  }
  const existant = un('SELECT * FROM agent LIMIT 1');
  const configuration = JSON.stringify({
    notifications: { journal: true, anomalies: true, rapportQuotidien: true },
    apparence: { theme: 'clair' },
    objectif: { abonnes: 1200, engagement: 5.5, lienExterne: '' },
    restrictions: {
      messagesPrives: false,
      publicationHeures: { debut: config.heureDebut, fin: config.heureFin },
      ageMinimum: config.ageMinimum,
    },
  });
  if (existant) {
    executer(
      `UPDATE agent SET nom = ?, prenom = ?, email = ?, role = 'admin', fuseau_horaire = ? WHERE id = ?`,
      nom,
      prenom,
      email || existant.email,
      texte(payload.fuseau, 60) || config.fuseau,
      existant.id,
    );
  } else {
    executer(
      `INSERT INTO agent (id, nom, prenom, role, email, statut, fuseau_horaire, configuration)
       VALUES (?, ?, ?, 'admin', ?, 'Actif', ?, ?)`,
      uuid(),
      nom,
      prenom,
      email || `responsable@${config.fuseau.split('/').pop().toLowerCase()}.local`,
      texte(payload.fuseau, 60) || config.fuseau,
      configuration,
    );
  }
  ecrireMeta('agent.fourni', true);
  return un('SELECT * FROM agent LIMIT 1');
}

/* ───────────────────────── état de la configuration ───────────────────────── */

export function etatConfiguration() {
  const compte = compteExistant();
  const agent = un('SELECT * FROM agent LIMIT 1');
  const audience = un('SELECT * FROM parametres_audience LIMIT 1');
  const identifiants = identifiantsGraph();
  const contenus = un('SELECT COUNT(*) AS n FROM contenu_drive')?.n ?? 0;
  const cibles = un('SELECT COUNT(*) AS n FROM cible')?.n ?? 0;

  const etapes = [
    {
      cle: 'agent',
      libelle: 'Responsable',
      fait: Boolean(agent && lireMeta('agent.fourni', false)),
      detail: agent ? `${agent.prenom || ''} ${agent.nom || ''}`.trim() || agent.email : 'Non renseigné',
    },
    {
      cle: 'compte',
      libelle: 'Compte Instagram',
      fait: Boolean(compte),
      detail: compte ? `@${compte.username}` : 'Aucun compte déclaré',
    },
    {
      cle: 'profil',
      libelle: 'Profil complet',
      fait: Boolean(compte && compte.bio && compte.localisation),
      detail: compte && compte.bio ? 'Bio et localisation renseignées' : 'Bio ou localisation manquante',
    },
    {
      cle: 'audience',
      libelle: 'Paramètres d’audience',
      fait: Boolean(audience),
      detail: audience
        ? `${JSON.parse(audience.pays_autorises || '[]').length} pays · ${audience.age_minimum} ans minimum`
        : 'Non configurés',
    },
    {
      cle: 'identifiants',
      libelle: 'Identifiants Instagram Graph',
      fait: identifiants.configure,
      detail: identifiants.configure
        ? `Compte ${identifiants.userId} · jeton ${masquer(identifiants.token)} (${identifiants.source})`
        : 'Jeton et identifiant requis pour publier',
    },
    {
      cle: 'contenus',
      libelle: 'Contenus fournis',
      fait: contenus > 0,
      detail: contenus > 0 ? `${contenus} contenu(s) dans le Drive` : 'Drive vide : importez vos médias',
    },
  ];

  const manquants = etapes.filter((e) => !e.fait).map((e) => e.cle);
  const complete = manquants.length === 0;

  return {
    production: config.production,
    // La mise en service ne s'impose qu'en production : en développement, la démo reste utilisable.
    requise: config.production,
    environnement: config.environnement,
    interactionsActives: config.interactionsActives,
    authentification: Boolean(config.motDePasse || config.hashMotDePasse),
    mode: config.modeInstagram,
    etapes,
    manquants,
    complete,
    compteurs: { contenus, cibles, publications: un('SELECT COUNT(*) AS n FROM publication')?.n ?? 0 },
  };
}

/** Valide l'ensemble et autorise le démarrage du moteur. */
export function finaliserConfiguration() {
  const etat = etatConfiguration();
  if (!etat.complete) {
    const noms = etat.etapes.filter((e) => !e.fait).map((e) => e.libelle);
    throw new ErreurConfiguration(`Configuration incomplète : ${noms.join(', ')}.`);
  }
  const compte = compteExistant();
  executer('UPDATE compte_instagram SET configuration_ok = 1 WHERE id = ?', compte.id);
  ecrireMeta('configuration.faite', true);
  journaliser('Configuration de production validée : le moteur peut démarrer.', { categorie: 'systeme' });
  return etatConfiguration();
}

export function configurationFaite() {
  return lireMeta('configuration.faite', false) === true && etatConfiguration().complete;
}

export function moteurAutorise() {
  if (!config.production) return true;
  return configurationFaite();
}

/** Remise à zéro des identifiants (rotation de jeton). */
export function oublierIdentifiantsGraph() {
  ecrireMeta('graph.user_id', '');
  ecrireMeta('graph.token', '');
}

export { ErreurConfiguration, PAYS_VALIDES, GENRES };
