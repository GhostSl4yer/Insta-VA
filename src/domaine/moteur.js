import { executer, un, tous } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { ajouterJours, minutesVersHHMM, dateDansFuseau } from '../utils/temps.js';
import { executerPour, compteIdCourant } from './contexte.js';
import { compteCourant, compteParId, listerComptes, definirCycleActuel, marquerJourCycle } from './compte.js';
import { plannifierJournee, synchroniserDrive, archiverSurDrive, statistiquesDrive } from './drive.js';
import { planifierPublicationsDuJour, publierPublication, listerPublications, compterPublicationsParStatut } from './publications.js';
import { collecterEtRepondre, verifierCommentairesEnAttente } from './commentaires.js';
import { statistiquesDuJour, calculerStatistiquesJour } from './statistiques.js';
import { genererRapport } from './rapports.js';
import { detecterAnomalie, compterAnomaliesOuvertes } from './anomalies.js';
import { journaliser, notifier, compterNotificationsNonLues, listerJournal } from './journal.js';
import { clicsDuJour, statistiquesLiens } from './liens.js';
import { ETAPES_FLUX } from '../../public/shared/enums.js';
import { obtenirParametres } from './audience.js';

/**
 * Moteur multi-comptes.
 *
 * Un seul processus, une seule boucle : à chaque tick, chaque compte actif est
 * exécuté dans sa propre portée (`executerPour`) avec un état persisté dans
 * `etat_moteur`. Les comptes n'interfèrent donc jamais entre eux, et un arrêt du
 * serveur n'interrompt pas définitivement un cycle : l'état est rechargé.
 *
 * Aucune action simulée : publication réelle, réponses réelles, zéro inventé.
 */

const QUOTAS = { Story: 3, Reel: 2, UnePleine: 1 };
const INTERVALLE_MS = 1000;

const etats = new Map(); // compteId -> état en mémoire
const verrous = new Map(); // compteId -> promesse d'exécution en cours
let minuteur = null;
let vitesse = config.vitesseDefaut;
let demarre = false;
let arretDemande = false;

/* ─────────────────────────── état ─────────────────────────── */

function etatVide() {
  return {
    horloge: 'arrete',
    dateJour: null,
    minuteJour: 960,
    numeroJour: 0,
    cycleNumero: 1,
    cycle: null,
    sessions: [],
    plan: [],
    pauseManuelle: false,
    demarreLe: null,
    dernierTick: null,
    jourCloture: false,
    compteurPublications: 0,
    derniereSync: 0,
    derniereErreur: null,
  };
}

function lireEtat(compteId) {
  if (etats.has(compteId)) return etats.get(compteId);
  const ligne = un('SELECT etat FROM etat_moteur WHERE compte_id = ?', compteId);
  let etat = etatVide();
  if (ligne) {
    try {
      etat = { ...etat, ...JSON.parse(ligne.etat) };
    } catch {
      etat = etatVide();
    }
  }
  etats.set(compteId, etat);
  return etat;
}

function sauverEtat(compteId, etat) {
  executer(
    `INSERT INTO etat_moteur (compte_id, etat, maj_le) VALUES (?, ?, ?)
     ON CONFLICT (compte_id) DO UPDATE SET etat = excluded.etat, maj_le = excluded.maj_le`,
    compteId,
    JSON.stringify(etat),
    new Date().toISOString(),
  );
  etats.set(compteId, etat);
}

export function etatCompte(compteId = compteIdCourant()) {
  if (!compteId) return etatVide();
  return { ...lireEtat(compteId) };
}

/* Compatibilité : l'API expose `etat` du compte courant. */
export const etat = new Proxy(
  {},
  {
    get(_cible, cle) {
      const courant = etatCompte();
      if (cle === 'vitesse') return vitesse;
      return courant[cle];
    },
  },
);

/* ─────────────────────────── cycle ─────────────────────────── */

function mapperCycle(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    compteId: ligne.compte_id,
    numeroJour: ligne.numero_jour,
    cycleNumero: ligne.cycle_numero,
    dateDebut: ligne.date_debut,
    dateFin: ligne.date_fin,
    statut: ligne.statut,
    heureDebut: ligne.heure_debut,
    heureFin: ligne.heure_fin,
    termineLe: ligne.termine_le,
  };
}

function creerCycle({ date, numeroJour, cycleNumero, compteId }) {
  const existant = un(
    'SELECT * FROM cycle WHERE compte_id = ? AND date_debut = ? AND numero_jour = ? LIMIT 1',
    compteId,
    date,
    numeroJour,
  );
  if (existant) return mapperCycle(existant);
  const id = uuid();
  executer(
    `INSERT INTO cycle (id, compte_id, numero_jour, cycle_numero, date_debut, date_fin, statut, heure_debut, heure_fin, relance_auto)
     VALUES (?, ?, ?, ?, ?, ?, 'EnCours', ?, '00:00', 1)`,
    id,
    compteId,
    numeroJour,
    cycleNumero,
    date,
    ajouterJours(date, 1),
    config.heureDebut,
  );
  return mapperCycle(un('SELECT * FROM cycle WHERE id = ?', id));
}

function ajouterExecution({ date, etape, heure, cycleId }) {
  const compteId = compteIdCourant();
  const existant = un(
    'SELECT 1 AS n FROM execution WHERE compte_id = ? AND jour = ? AND etape = ?',
    compteId,
    date,
    etape,
  );
  if (existant) return;
  executer(
    `INSERT INTO execution (id, compte_id, jour, numero_jour, etape, heure_prevue, heure_reelle, statut, detail, cycle_id)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 'Planifie', '', ?)`,
    uuid(),
    compteId,
    date,
    lireEtat(compteId).numeroJour,
    etape,
    heure,
    cycleId,
  );
}

function majExecution(etape, statut, detail = '') {
  const compteId = compteIdCourant();
  const etatCourant = lireEtat(compteId);
  executer(
    `UPDATE execution SET statut = ?, detail = ?, heure_reelle = COALESCE(heure_reelle, ?)
      WHERE compte_id = ? AND jour = ? AND etape = ?`,
    statut,
    detail,
    minutesVersHHMM(etatCourant.minuteJour),
    compteId,
    etatCourant.dateJour,
    etape,
  );
}

/* ─────────────────────────── plan de journée ─────────────────────────── */

function construirePlan({ publications }) {
  const taches = [];
  const pousser = (tache) => taches.push({ id: uuid(), statut: 'Planifie', ...tache });
  pousser({ minute: 16 * 60, type: 'ouverture', libelle: 'Ouverture de la journée' });
  for (const publication of publications) {
    pousser({
      minute: publication.minute,
      type: 'publication',
      publicationId: publication.id,
      libelle: `Publication ${publication.type}`,
    });
  }
  if (config.reponsesCommentaires) {
    const pas = Math.max(5, config.intervalleCommentairesMin);
    for (let minute = 16 * 60 + 20; minute <= 23 * 60 + 40; minute += pas) {
      pousser({ minute, type: 'commentaires', libelle: 'Réponses aux commentaires reçus' });
    }
    pousser({ minute: 23 * 60 + 34, type: 'suivi_commentaires', libelle: 'Contrôle des commentaires en attente' });
  }
  pousser({ minute: 23 * 60 + 50, type: 'statistiques', libelle: 'Calcul des statistiques du jour' });
  pousser({ minute: 23 * 60 + 56, type: 'rapport', libelle: 'Génération du rapport quotidien' });
  pousser({ minute: 23 * 60 + 59, type: 'cloture', libelle: 'Clôture de la journée' });
  return taches.sort((a, b) => a.minute - b.minute);
}

/* ─────────────────────────── préparation ─────────────────────────── */

function preparerJournee({ etatCourant, date, numeroJour, cycleNumero, compte }) {
  etatCourant.dateJour = date;
  etatCourant.numeroJour = numeroJour;
  etatCourant.cycleNumero = cycleNumero;
  etatCourant.minuteJour = 960;
  etatCourant.jourCloture = false;
  etatCourant.plan = [];
  etatCourant.compteurPublications = 0;
  etatCourant.entreJours = false;
  etatCourant.horloge = 'en_cours';
  etatCourant.pauseManuelle = false;
  etatCourant.dernierTick = Date.now();
  if (!etatCourant.demarreLe) etatCourant.demarreLe = new Date().toISOString();

  const cycle = creerCycle({ date, numeroJour, cycleNumero, compteId: compte.id });
  etatCourant.cycle = cycle;

  plannifierJournee({ date, numeroJour });
  const publications = planifierPublicationsDuJour({ cycle, date, compte });
  etatCourant.plan = construirePlan({ publications });

  for (const etape of ETAPES_FLUX) ajouterExecution({ date, etape, heure: '16:00', cycleId: cycle.id });
  majExecution('Initialisation du compte', 'Effectue', 'Identifiants et profil vérifiés');
  majExecution('Préparation de la journée', 'Effectue', `${publications.length} publication(s) planifiée(s)`);

  definirCycleActuel(cycleNumero, ajouterJours(date, Math.max(0, config.dureeCycleJours - numeroJour)));
  journaliser(
    `Journée ${numeroJour}/${config.dureeCycleJours} ouverte · ${publications.length} publication(s) planifiée(s).`,
    { categorie: 'cycle', jour: date, cycleId: cycle.id },
  );
  majExecution('Publication (16h → 00h)', 'Planifie', `${publications.length} publication(s) à venir`);
  sauverEtat(compte.id, etatCourant);
}

/* ─────────────────────────── reprise ─────────────────────────── */

async function ouvrirJournee(etatCourant, compte) {
  const aujourdHui = dateDansFuseau(compte.fuseau || config.fuseau);
  const dernier = un(
    'SELECT * FROM cycle WHERE compte_id = ? ORDER BY date_debut DESC, numero_jour DESC LIMIT 1',
    compte.id,
  );
  let date = aujourdHui;
  let numeroJour = Math.min(config.dureeCycleJours, config.jourConfiguration + 1);
  let cycleNumero = 1;

  if (dernier) {
    cycleNumero = dernier.cycle_numero;
    if (dernier.statut !== 'Termine') {
      if (dernier.date_debut < aujourdHui) {
        // Journée manquée : on ne la rejoue pas (rafale de publications).
        executer(
          `UPDATE cycle SET statut = 'Interrompu', termine_le = ? WHERE id = ?`,
          new Date().toISOString(),
          dernier.id,
        );
        journaliser(`Reprise : la journée du ${dernier.date_debut} n’a pas été rejouée.`, {
          niveau: 'alerte',
          categorie: 'systeme',
        });
        notifier({
          type: 'systeme',
          titre: 'Reprise après interruption',
          message: `Le moteur s’est arrêté avant la fin du ${dernier.date_debut}. Cette journée est clôturée sans rattrapage.`,
          niveau: 'Avertissement',
          lien: '/#/cycle',
        });
        numeroJour = dernier.numero_jour + 1;
      } else {
        date = dernier.date_debut;
        numeroJour = dernier.numero_jour;
        executer(`UPDATE cycle SET statut = 'EnCours', termine_le = NULL WHERE id = ?`, dernier.id);
      }
    } else {
      numeroJour = dernier.numero_jour + 1;
      if (dernier.date_debut >= aujourdHui) date = ajouterJours(dernier.date_debut, 1);
    }
    if (numeroJour > config.dureeCycleJours) {
      numeroJour = 1;
      cycleNumero += 1;
    }
  }
  preparerJournee({ etatCourant, date, numeroJour, cycleNumero, compte });
}

/* ─────────────────────────── exécution ─────────────────────────── */

async function executerTache(etatCourant, tache, compte) {
  switch (tache.type) {
    case 'ouverture': {
      majExecution('Initialisation du compte', 'Effectue', 'Journée ouverte');
      break;
    }
    case 'publication': {
      const publication = await publierPublication(tache.publicationId, { baseUrl: config.urlPublique || '' });
      if (publication?.statut === 'Publiee') {
        etatCourant.compteurPublications += 1;
        tache.libelle = `Publication ${publication.type} publiée`;
        if (publication.contenuId) await archiverSurDrive(publication.contenuId);
        majExecution('Publication (16h → 00h)', 'EnCours', `${etatCourant.compteurPublications} publiée(s)`);
      } else {
        tache.statut = 'Echec';
        tache.libelle = `Publication ${publication?.type || ''} en échec`;
        majExecution('Publication (16h → 00h)', 'Echec', publication?.erreur || 'échec');
      }
      break;
    }
    case 'commentaires': {
      const resultat = await collecterEtRepondre();
      tache.libelle = `${resultat.repondues || 0} réponse(s) publiée(s)`;
      majExecution('Réponses aux commentaires', 'Effectue', tache.libelle);
      break;
    }
    case 'suivi_commentaires': {
      const enAttente = verifierCommentairesEnAttente();
      tache.libelle = `${enAttente} commentaire(s) en attente`;
      break;
    }
    case 'statistiques': {
      calculerStatistiquesJour(etatCourant.dateJour);
      majExecution('Statistiques', 'Effectue', 'Indicateurs du jour calculés');
      break;
    }
    case 'rapport': {
      genererRapport({ type: 'quotidien', date: etatCourant.dateJour, cycle: etatCourant.cycle, compte });
      majExecution('Rapport quotidien', 'Effectue');
      break;
    }
    case 'cloture': {
      await cloturerJournee(etatCourant, compte);
      break;
    }
    default:
      break;
  }
  tache.statut = tache.type === 'cloture' ? tache.statut : tache.statut === 'Echec' ? 'Echec' : 'Effectue';
}

async function executerPlan(etatCourant, compte) {
  let securite = 0;
  while (securite < 200) {
    securite += 1;
    const tache = etatCourant.plan.find(
      (t) => t.statut === 'Planifie' && t.minute <= etatCourant.minuteJour,
    );
    if (!tache) break;
    try {
      await executerTache(etatCourant, tache, compte);
    } catch (erreur) {
      tache.statut = 'Echec';
      tache.libelle = erreur.message;
      etatCourant.derniereErreur = erreur.message;
      detecterAnomalie('EchecTache', `${tache.type} : ${erreur.message}`, {
        severite: 'Avertissement',
        details: { tache: tache.type },
      });
    }
  }
}

async function cloturerJournee(etatCourant, compte) {
  if (etatCourant.jourCloture) return;
  etatCourant.jourCloture = true;
  etatCourant.horloge = 'entre_jours';
  if (etatCourant.cycle) {
    executer(
      `UPDATE cycle SET statut = 'Termine', termine_le = ? WHERE id = ?`,
      new Date().toISOString(),
      etatCourant.cycle.id,
    );
  }
  marquerJourCycle(etatCourant.dateJour, {
    publications: etatCourant.compteurPublications,
    jour: etatCourant.numeroJour,
  });
  majExecution('Clôture de la journée', 'Effectue', 'Journée terminée');
  journaliser(`Journée ${etatCourant.numeroJour} clôturée pour @${compte.username}.`, {
    categorie: 'cycle',
    jour: etatCourant.dateJour,
  });
  sauverEtat(compte.id, etatCourant);
}

/* ─────────────────────────── tick ─────────────────────────── */

async function tickCompte(compte) {
  const etatCourant = lireEtat(compte.id);
  if (etatCourant.pauseManuelle) {
    etatCourant.dernierTick = Date.now();
    return;
  }
  const maintenant = Date.now();
  const ecoule = etatCourant.dernierTick ? (maintenant - etatCourant.dernierTick) / 1000 : 0;
  etatCourant.dernierTick = maintenant;
  if (etatCourant.horloge !== 'en_cours') {
    // Journée non ouverte : on l'ouvre à l'heure de début du compte.
    const [h, m] = String(compte.heureDebut || config.heureDebut).split(':').map(Number);
    const heureCourante = new Date().toLocaleTimeString('fr-FR', { timeZone: compte.fuseau || config.fuseau, hour12: false });
    const [hh, mm] = heureCourante.split(':').map(Number);
    const minuteReelle = hh * 60 + mm;
    if (minuteReelle >= h * 60 + m && !etatCourant.jourCloture) {
      await ouvrirJournee(etatCourant, compte);
    } else {
      etatCourant.dernierTick = maintenant;
      sauverEtat(compte.id, etatCourant);
      return;
    }
  }

  etatCourant.minuteJour += Math.round(ecoule * vitesse);
  if (etatCourant.minuteJour >= 24 * 60) etatCourant.minuteJour = 24 * 60 - 1;

  if (maintenant - etatCourant.derniereSync > config.googleDrive.intervalleSyncMin * 60_000) {
    etatCourant.derniereSync = maintenant;
    try {
      await synchroniserDrive();
    } catch (erreur) {
      etatCourant.derniereErreur = erreur.message;
    }
  }

  await executerPlan(etatCourant, compte);

  if (etatCourant.minuteJour >= 23 * 60 + 59 && !etatCourant.jourCloture) {
    await cloturerJournee(etatCourant, compte);
  }
  sauverEtat(compte.id, etatCourant);
}

async function tick() {
  if (!demarre || arretDemande) return;
  const comptes = listerComptes().filter((c) => c.actif && c.statut === 'Actif');
  for (const compte of comptes) {
    if (verrous.has(compte.id)) continue;
    const promesse = executerPour(compte.id, () => tickCompte(compte))
      .catch((erreur) => {
        const etatCourant = lireEtat(compte.id);
        etatCourant.derniereErreur = erreur.message;
        sauverEtat(compte.id, etatCourant);
      })
      .finally(() => verrous.delete(compte.id));
    verrous.set(compte.id, promesse);
  }
  await Promise.allSettled([...verrous.values()]);
}

/* ─────────────────────────── API du moteur ─────────────────────────── */

export function demarrerMoteur() {
  if (minuteur) return etatPublic();
  demarre = true;
  arretDemande = false;
  minuteur = setInterval(() => {
    tick().catch(() => {});
  }, INTERVALLE_MS);
  if (minuteur.unref) minuteur.unref();
  journaliser(`Moteur démarré (${listerComptes().filter((c) => c.actif).length} compte(s) actif(s)).`, {
    categorie: 'systeme',
  });
  return etatPublic();
}

export function arreterMoteur() {
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
  demarre = false;
  arretDemande = true;
  for (const [compteId, etatCourant] of etats.entries()) {
    etatCourant.horloge = 'arrete';
    etatCourant.dernierTick = null;
    sauverEtat(compteId, etatCourant);
  }
  return etatPublic();
}

export function estDemarre() {
  return demarre;
}

export function mettreEnPause() {
  const compteId = compteIdCourant();
  const etatCourant = lireEtat(compteId);
  etatCourant.pauseManuelle = true;
  etatCourant.horloge = 'pause';
  sauverEtat(compteId, etatCourant);
  return etatCompte(compteId);
}

export function reprendreMoteur() {
  const compteId = compteIdCourant();
  const etatCourant = lireEtat(compteId);
  etatCourant.pauseManuelle = false;
  etatCourant.horloge = 'en_cours';
  etatCourant.dernierTick = Date.now();
  sauverEtat(compteId, etatCourant);
  return etatCompte(compteId);
}

export function changerVitesse(valeur) {
  vitesse = Math.max(1, Math.min(120, Number(valeur) || 1));
  return { vitesse };
}

/** Avance l'horloge de N minutes pour le compte courant (diagnostic). */
export async function avancer(minutes = 30, { baseUrl = '' } = {}) {
  const compteId = compteIdCourant();
  return executerPour(compteId, async () => {
    const compte = compteParId(compteId);
    const etatCourant = lireEtat(compteId);
    if (etatCourant.horloge === 'arrete') await ouvrirJournee(etatCourant, compte);
    etatCourant.minuteJour = Math.min(24 * 60 - 1, etatCourant.minuteJour + Math.max(1, Number(minutes) || 1));
    etatCourant.horloge = 'en_cours';
    etatCourant.dernierTick = Date.now();
    await executerPlan(etatCourant, compte);
    if (etatCourant.minuteJour >= 23 * 60 + 59) await cloturerJournee(etatCourant, compte);
    sauverEtat(compteId, etatCourant);
    return etatCompte(compteId);
  });
}

export async function forcerFinJour() {
  const compteId = compteIdCourant();
  return executerPour(compteId, async () => {
    const compte = compteParId(compteId);
    const etatCourant = lireEtat(compteId);
    etatCourant.minuteJour = 24 * 60 - 1;
    await executerPlan(etatCourant, compte);
    await cloturerJournee(etatCourant, compte);
    return etatCompte(compteId);
  });
}

export async function synchroniserDriveSiConfigure() {
  try {
    return await synchroniserDrive();
  } catch (erreur) {
    return { actif: false, total: 0, erreurs: [{ type: 'Drive', message: erreur.message }] };
  }
}

export function executionDuJour() {
  const compteId = compteIdCourant() || '';
  const etatCourant = lireEtat(compteId);
  return tous(
    'SELECT * FROM execution WHERE compte_id = ? AND jour = ? ORDER BY heure_prevue, rowid',
    compteId,
    etatCourant.dateJour,
  ).map((l) => ({
    id: l.id,
    etape: l.etape,
    heurePrevue: l.heure_prevue,
    heureReelle: l.heure_reelle,
    statut: l.statut,
    detail: l.detail,
  }));
}

export function listerCycles({ limite = 30 } = {}) {
  return tous(
    'SELECT * FROM cycle WHERE compte_id = ? ORDER BY date_debut DESC, numero_jour DESC LIMIT ?',
    compteIdCourant() || '',
    Math.min(200, limite),
  ).map(mapperCycle);
}

export function etatPublic() {
  const compteId = compteIdCourant();
  if (!compteId) return { comptes: listerComptes().length, horloge: demarre ? 'en_cours' : 'arrete', compte: null };
  const compte = compteCourant();
  if (!compte) return { compte: null, horloge: 'arrete' };
  const etatCourant = lireEtat(compteId);
  const jour = etatCourant.dateJour || dateDansFuseau(compte.fuseau || config.fuseau);
  return {
    compte,
    comptes: listerComptes(),
    horloge: demarre ? (etatCourant.pauseManuelle ? 'pause' : etatCourant.horloge) : 'arrete',
    vitesse,
    dateJour: jour,
    minuteJour: etatCourant.minuteJour,
    heure: minutesVersHHMM(etatCourant.minuteJour),
    numeroJour: etatCourant.numeroJour,
    cycleNumero: etatCourant.cycleNumero,
    cycle: etatCourant.cycle,
    plan: etatCourant.plan,
    jourCloture: etatCourant.jourCloture,
    demarreLe: etatCourant.demarreLe,
    derniereErreur: etatCourant.derniereErreur,
    drive: statistiquesDrive(),
    publications: compterPublicationsParStatut(),
    statistiquesJour: statistiquesDuJour(jour) || null,
    liens: { clicsAujourdhui: clicsDuJour(jour), clics30Jours: statistiquesLiens({ jours: 30 }).total },
    compteurs: {
      notifications: compterNotificationsNonLues(),
      anomalies: compterAnomaliesOuvertes(),
    },
    // Formes attendues par le shell de l'interface (compatibilité).
    horloge: {
      heure: minutesVersHHMM(etatCourant.minuteJour),
      date: jour,
      etat: etatCourant.pauseManuelle ? 'en_pause' : etatCourant.horloge === 'arrete' ? 'arrete' : 'en_cours',
      pauseManuelle: etatCourant.pauseManuelle,
      sessionCourante: null,
      vitesse,
    },
    programme: {
      numeroJour: etatCourant.numeroJour,
      joursTotal: config.dureeCycleJours,
      cycleNumero: etatCourant.cycleNumero,
      joursRestants: Math.max(0, config.dureeCycleJours - etatCourant.numeroJour),
    },
    kpis: { abonnes: 0, publications: Object.values(compterPublicationsParStatut()).reduce((s, n) => s + n, 0) },
    journee: {
      interactions: { entrantes: 0, sortantes: 0 },
      publications: compterPublicationsParStatut(),
      objectifPublications: 4,
    },
    audience: { paysAutorises: obtenirParametres().paysAutorises || [] },
    configuration: { requise: false, complete: true, comptes: listerComptes().length },
    journal: listerJournal({ limite: 12 }),
    publicationsRecentes: listerPublications({ limite: 6 }),
  };
}

export { ETAPES_FLUX as ETAPES };
