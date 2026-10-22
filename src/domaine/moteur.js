import { executer, un, tous, lireMeta, ecrireMeta } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import {
  ajouterJours,
  minutesVersHHMM,
  dateDansFuseau,
  isoNaif,
} from '../utils/temps.js';
import { creerAlea, arrondi } from '../utils/alea.js';
import { OBJECTIF } from '../../public/shared/enums.js';
import { assurerAgent, agentCourant } from './agent.js';
import { assurerCompte, comptePublic, definirCycleActuel, marquerJourCycle } from './compte.js';
import { assurerParametres, obtenirParametres } from './audience.js';
import { assurerCibles } from './cibles.js';
import { plannifierJournee, assurerPhotoProfil, synchroniser, synchroniserDrive, archiverSurDrive } from './drive.js';
import {
  planifierPublicationsDuJour,
  publierPublication,
  listerPublications,
  compterPublicationsParStatut,
} from './publications.js';
import {
  executerLotInteractions,
  enregistrerVisionnage,
  simulerReactionsEntrantes,
  totalVisionnage,
  statistiquesInteractions,
  suivisDuJour,
} from './interactions.js';
import { calculerStatistiquesJour, kpisGlobaux, statistiquesDuJour } from './statistiques.js';
import { genererRapport, genererRapportHebdomadaire, genererBilanFinCycle } from './rapports.js';
import { collecterVeille } from './veille.js';
import { detecterAnomalie, compterAnomaliesOuvertes, listerAnomalies } from './anomalies.js';
import { journaliser, notifier, compterNotificationsNonLues, listerJournal } from './journal.js';
import { etatConfiguration, moteurAutorise } from './configuration.js';
import { collecterEtRepondre, verifierCommentairesEnAttente } from './commentaires.js';
import { clicsDuJour, statistiquesLiens } from './liens.js';

const PRIORITE = {
  session_debut: 0,
  session_fin: 0,
  publication: 2,
  commentaires: 2,
  interactions: 3,
  visionnage: 4,
  reactions: 5,
  statistiques: 6,
  suivi_commentaires: 7,
  rapport: 7,
  cloture: 8,
};

const ETAPES = [
  { etape: 'Initialisation du compte', heure: '16:00' },
  { etape: 'Préparation de la journée', heure: '16:05' },
  { etape: 'Publication (16h → 00h)', heure: '16:10' },
  { etape: 'Visionnage (≥ 30 min)', heure: '16:35' },
  { etape: 'Réponses aux commentaires', heure: '16:20' },
  { etape: 'Interactions (like / commentaire / suivi)', heure: '16:25' },
  { etape: 'Statistiques & rapport du jour', heure: '23:52' },
  { etape: 'Clôture de la journée', heure: '23:59' },
];

export const etat = {
  horloge: 'arrete',
  vitesse: config.vitesseDefaut,
  dateJour: null,
  minuteJour: 960,
  numeroJour: 0,
  cycleNumero: 1,
  cycle: null,
  session: null,
  sessions: [],
  plan: [],
  entreJours: false,
  pauseManuelle: false,
  repriseA: 0,
  suspenduJusqua: null,
  demarreLe: null,
  dernierTick: null,
  jourCloture: false,
  prochaineJournee: null,
  compteurInteractions: 0,
  compteurPublications: 0,
};

let minuteur = null;
let enExecution = false;
const demarre = new Set();

/* ─────────────────────────── helpers ─────────────────────────── */

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
    relanceAuto: Boolean(ligne.relance_auto),
    termineLe: ligne.termine_le,
  };
}

function mapperSession(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    cycleId: ligne.cycle_id,
    date: ligne.date,
    heureDebut: ligne.heure_debut,
    heureFin: ligne.heure_fin,
    dureeVisionnage: ligne.duree_visionnage,
    statut: ligne.statut,
    demarreLe: ligne.demarre_le,
    termineLe: ligne.termine_le,
    details: JSON.parse(ligne.details || '{}'),
  };
}

function creerCycle({ date, numeroJour, cycleNumero, compteId }) {
  const existant = un('SELECT * FROM cycle WHERE date_debut = ? AND numero_jour = ? ORDER BY date_debut DESC LIMIT 1', date, numeroJour);
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

function creerSessions(cycle, date) {
  const existantes = tous('SELECT * FROM session_quotidienne WHERE date = ? ORDER BY heure_debut', date);
  if (existantes.length >= 2) return existantes.map(mapperSession);
  const sessions = [
    { debut: config.heureDebut, fin: '20:00' },
    { debut: '20:00', fin: config.heureFin },
  ];
  for (const session of sessions) {
    const deja = un('SELECT * FROM session_quotidienne WHERE date = ? AND heure_debut = ?', date, session.debut);
    if (!deja) {
      executer(
        `INSERT INTO session_quotidienne (id, cycle_id, date, heure_debut, heure_fin, duree_visionnage, statut, details)
         VALUES (?, ?, ?, ?, ?, 0, 'Planifiee', '{}')`,
        uuid(),
        cycle.id,
        date,
        session.debut,
        session.fin,
      );
    }
  }
  return tous('SELECT * FROM session_quotidienne WHERE date = ? ORDER BY heure_debut', date).map(mapperSession);
}

function sessionPourMinute(minute) {
  return etat.sessions.find((s) => {
    const [hd, md] = s.heureDebut.split(':').map(Number);
    const [hf, mf] = s.heureFin.split(':').map(Number);
    const debut = hd * 60 + md;
    const fin = hf * 60 + mf === 0 ? 1440 : hf * 60 + mf;
    return minute >= debut && minute < fin;
  }) || null;
}

function majSession(id, donnees) {
  const champs = [];
  const params = [];
  for (const [cle, valeur] of Object.entries(donnees)) {
    champs.push(`${cle} = ?`);
    params.push(valeur);
  }
  if (!champs.length) return;
  executer(`UPDATE session_quotidienne SET ${champs.join(', ')} WHERE id = ?`, ...params, id);
}

function ajouterExecution({ cycle, date, etape, heure, statut = 'Planifie', detail = '' }) {
  const existant = un('SELECT * FROM execution WHERE jour = ? AND etape = ?', date, etape);
  if (existant) return;
  executer(
    `INSERT INTO execution (id, jour, numero_jour, etape, heure_prevue, heure_reelle, statut, detail, cycle_id)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    uuid(),
    date,
    etat.numeroJour,
    etape,
    heure,
    statut,
    detail,
    cycle?.id ?? null,
  );
}

function majExecution(etape, statut, detail = null, minute = null) {
  const date = etat.dateJour;
  const heureReelle = minute !== null ? minutesVersHHMM(minute) : minutesVersHHMM(etat.minuteJour);
  if (detail === null) {
    executer(
      `UPDATE execution SET statut = ?, heure_reelle = COALESCE(heure_reelle, ?) WHERE jour = ? AND etape = ? AND statut != 'Effectue'`,
      statut,
      heureReelle,
      date,
      etape,
    );
  } else {
    executer(
      `UPDATE execution SET statut = ?, detail = ?, heure_reelle = COALESCE(heure_reelle, ?) WHERE jour = ? AND etape = ?`,
      statut,
      detail,
      heureReelle,
      date,
      etape,
    );
  }
}

function construirePlan({ cycle, date, publications }) {
  const alea = creerAlea(Number(date.replace(/-/g, '')) % 2147483647);
  const taches = [];
  const pousser = (tache) => taches.push({ id: uuid(), statut: 'Planifie', ...tache });

  const session1 = etat.sessions[0];
  const session2 = etat.sessions[1];
  pousser({ minute: 960, type: 'session_debut', sessionId: session1?.id, libelle: 'Ouverture de la session 16 h – 20 h' });
  pousser({ minute: 1200, type: 'session_fin', sessionId: session1?.id, libelle: 'Clôture de la session 16 h – 20 h' });
  pousser({ minute: 1200, type: 'session_debut', sessionId: session2?.id, libelle: 'Ouverture de la session 20 h – 00 h' });
  pousser({ minute: 1439, type: 'session_fin', sessionId: session2?.id, libelle: 'Clôture de la session 20 h – 00 h' });

  for (const publication of publications) {
    pousser({
      minute: publication.minute,
      type: 'publication',
      publicationId: publication.id,
      libelle: `Publication ${publication.type} planifiée`,
    });
    const minuteReactions = Math.min(1436, publication.minute + alea.entier(24, 55));
    pousser({
      minute: minuteReactions,
      type: 'reactions',
      publicationId: publication.id,
      libelle: 'Réactions de l’audience',
    });
  }

  // Interactions désactivées en production : aucun lot n'est planifié.
  if (config.interactionsActives) {
    for (let minute = 16 * 60 + 25; minute <= 23 * 60 + 45; minute += 9) {
      pousser({
        minute,
        type: 'interactions',
        volume: alea.entier(1, 2),
        libelle: 'Lot d’interactions ciblées',
      });
    }
  }
  for (let minute = 16 * 60 + 36; minute <= 23 * 60 + 30; minute += 22) {
    pousser({
      minute,
      type: 'visionnage',
      secondes: alea.entier(95, 125),
      libelle: 'Visionnage de contenus de la niche',
    });
  }

  // Réponses aux commentaires : la seule interaction disponible via l'API.
  if (config.reponsesCommentaires) {
    const pas = Math.max(5, config.intervalleCommentairesMin);
    for (let minute = 16 * 60 + 40; minute <= 23 * 60 + 40; minute += pas) {
      pousser({ minute, type: 'commentaires', libelle: 'Réponses aux commentaires reçus' });
    }
  }

  pousser({ minute: 1432, type: 'statistiques', libelle: 'Calcul des statistiques du jour' });
  if (config.reponsesCommentaires) {
    pousser({ minute: 1434, type: 'suivi_commentaires', libelle: 'Contrôle des commentaires en attente' });
  }
  pousser({ minute: 1436, type: 'rapport', libelle: 'Génération du rapport quotidien' });
  pousser({ minute: 1439, type: 'cloture', libelle: 'Clôture de la journée' });

  return taches.sort((a, b) => a.minute - b.minute || (PRIORITE[a.type] ?? 9) - (PRIORITE[b.type] ?? 9));
}

/* ─────────────────────────── journée ─────────────────────────── */

function preparerJournee({ date, numeroJour, cycleNumero }) {
  etat.dateJour = date;
  etat.numeroJour = numeroJour;
  etat.cycleNumero = cycleNumero;
  etat.minuteJour = 960;
  etat.jourCloture = false;
  etat.plan = [];
  etat.compteurInteractions = 0;
  etat.compteurPublications = 0;
  etat.suspenduJusqua = null;
  etat.entreJours = false;

  const compte = comptePublic();
  etat.compte = compte;
  const cycle = creerCycle({ date, numeroJour, cycleNumero, compteId: compte.id });
  etat.cycle = cycle;
  etat.sessions = creerSessions(cycle, date);

  synchroniser();
  plannifierJournee({ cycleId: cycle.id, compte, date, numeroJour });
  if (!demarre.has('photo')) {
    assurerPhotoProfil(compte);
    demarre.add('photo');
  }

  const publications = planifierPublicationsDuJour({ cycle, date, compte });
  etat.plan = construirePlan({ cycle, date, publications });

  for (const etape of ETAPES) {
    ajouterExecution({ cycle, date, etape: etape.etape, heure: etape.heure });
  }
  majExecution('Initialisation du compte', 'Effectue', 'Profil vérifié, avatar cohérent');
  majExecution('Préparation de la journée', 'Effectue', `${publications.length} publication(s) planifiée(s)`);

  collecterVeille({ date });
  definirCycleActuel(cycleNumero, ajouterJours(date, Math.max(0, config.dureeCycleJours - numeroJour)));
  etat.horloge = 'en_cours';
  etat.pauseManuelle = false;
  etat.dernierTick = Date.now();
  if (!etat.demarreLe) etat.demarreLe = new Date().toISOString();
  journaliser(
    `Journée ${numeroJour}/${config.dureeCycleJours} ouverte · cycle ${cycleNumero} · ${publications.length} publication(s) planifiée(s).`,
    { categorie: 'cycle', jour: date, cycleId: cycle.id, donnees: { numeroJour, cycleNumero } },
  );
  majExecution('Publication (16h → 00h)', 'Planifie', `${publications.length} publication(s) à venir`);
}

async function traiterTaches() {
  if (enExecution) return;
  enExecution = true;
  try {
    let securite = 0;
    while (securite < 300) {
      securite += 1;
      const tache = etat.plan.find((t) => t.statut === 'Planifie' && t.minute <= etat.minuteJour);
      if (!tache) break;
      await executerTache(tache);
    }
  } finally {
    enExecution = false;
  }
}

async function executerTache(tache) {
  if (etat.suspenduJusqua && etat.minuteJour < etat.suspenduJusqua && tache.type !== 'session_fin') {
    return; // anomalie en cours : les actions attendent la reprise
  }
  tache.statut = 'EnCours';
  const minute = Math.round(etat.minuteJour);
  try {
    switch (tache.type) {
      case 'session_debut': {
        majSession(tache.sessionId, { statut: 'EnCours', demarre_le: new Date().toISOString() });
        etat.session = tache.sessionId;
        journaliser(tache.libelle, { categorie: 'session', jour: etat.dateJour, cycleId: etat.cycle?.id });
        break;
      }
      case 'session_fin': {
        majSession(tache.sessionId, { statut: 'Termine', termine_le: new Date().toISOString() });
        if (etat.session === tache.sessionId) etat.session = null;
        break;
      }
      case 'publication': {
        const publication = await publierPublication(tache.publicationId, {
          baseUrl: config.urlPublique || '',
        });
        if (publication?.statut === 'Publiee') {
          etat.compteurPublications += 1;
          tache.libelle = `Publication ${publication.type} publiée`;
          // Le fichier quitte la file « à publier » du Drive (déplacé, jamais supprimé).
          if (publication.contenuId) await archiverSurDrive(publication.contenuId);
          majExecution('Publication (16h → 00h)', 'EnCours', `${etat.compteurPublications} publiée(s) aujourd’hui`, minute);
        } else {
          tache.statut = 'Echec';
          tache.libelle = `Échec de publication (${publication?.erreur || 'inconnu'})`;
        }
        break;
      }
      case 'reactions': {
        const publication = un('SELECT * FROM publication WHERE id = ?', tache.publicationId);
        if (publication && publication.statut === 'Publiee') {
          simulerReactionsEntrantes({
            publication,
            date: etat.dateJour,
            compte: etat.compte,
            graine: Number(String(etat.dateJour).replace(/-/g, '')) % 100000,
            theme: publication.type === 'Story' ? 'generique' : 'fitness',
          });
        }
        break;
      }
      case 'interactions': {
        if (!config.interactionsActives) {
          tache.libelle = 'Interactions désactivées';
          break;
        }
        const session = sessionPourMinute(etat.minuteJour);
        const resultats = executerLotInteractions({
          date: etat.dateJour,
          minute,
          cycleId: etat.cycle?.id,
          sessionId: session?.id,
          compte: etat.compte,
          volume: tache.volume,
          graine: Number(String(etat.dateJour).replace(/-/g, '')) % 100000,
        });
        etat.compteurInteractions += resultats.length;
        tache.libelle = `${resultats.length} interaction(s) effectuée(s)`;
        majExecution('Interactions (like / commentaire / suivi)', 'EnCours', `${etat.compteurInteractions} interaction(s) aujourd’hui`, minute);
        break;
      }
      case 'commentaires': {
        const resultat = await collecterEtRepondre();
        tache.libelle = `${resultat.repondues || 0} réponse(s) publiée(s)`;
        majExecution('Réponses aux commentaires', 'Effectue', `${resultat.reponduees || 0} réponse(s)`, minute);
        break;
      }
      case 'visionnage': {
        const session = sessionPourMinute(etat.minuteJour);
        enregistrerVisionnage({
          date: etat.dateJour,
          minute,
          secondes: tache.secondes,
          sessionId: session?.id,
          compte: etat.compte,
          cible: null,
        });
        const total = totalVisionnage(etat.dateJour);
        tache.libelle = `Visionnage ${Math.round(total / 60)} min cumulées`;
        majExecution('Visionnage (≥ 30 min)', 'EnCours', `${Math.round(total / 60)} min / ${OBJECTIF.visionnageMinParJour / 60} min`, minute);
        break;
      }
      case 'statistiques': {
        const vision = totalVisionnage(etat.dateJour);
        calculerStatistiquesJour({
          cycle: etat.cycle,
          date: etat.dateJour,
          compte: etat.compte,
          visionnageSecondes: vision,
        });
        if (vision < OBJECTIF.visionnageMinParJour) {
          detecterAnomalie('VisionnageInsuffisant', `Visionnage inférieur à l’objectif : ${Math.round(vision / 60)} min / 30 min.`, {
            severite: 'Avertissement',
            details: { vision, objectif: OBJECTIF.visionnageMinParJour },
            cycleId: etat.cycle?.id,
          });
        }
        majExecution('Statistiques & rapport du jour', 'EnCours', 'Statistiques calculées', minute);
        break;
      }
      case 'suivi_commentaires': {
        const enAttente = verifierCommentairesEnAttente();
        tache.libelle = `${enAttente} commentaire(s) en attente`;
        break;
      }
      case 'rapport': {
        const rapport = genererRapport({
          type: 'quotidien',
          date: etat.dateJour,
          cycle: etat.cycle,
          compte: etat.compte,
        });
        if (etat.numeroJour % 7 === 0) {
          genererRapportHebdomadaire({ date: etat.dateJour, compte: etat.compte, cycle: etat.cycle });
        }
        if (etat.numeroJour === config.dureeCycleJours) {
          genererBilanFinCycle({ date: etat.dateJour, compte: etat.compte, cycle: etat.cycle });
        }
        majExecution('Statistiques & rapport du jour', 'Effectue', `Rapport ${rapport.type} prêt`, minute);
        break;
      }
      case 'cloture': {
        majExecution('Clôture de la journée', 'Effectue', 'Journée finalisée', minute);
        break;
      }
      default:
        break;
    }
    if (tache.statut !== 'Echec') tache.statut = 'Effectue';
  } catch (erreur) {
    tache.statut = 'Echec';
    tache.erreur = erreur.message;
    detecterAnomalie('CycleIncomplet', `Étape « ${tache.libelle} » en échec : ${erreur.message}`, {
      severite: 'Avertissement',
      details: { type: tache.type },
      cycleId: etat.cycle?.id,
    });
  }
}

async function cloturerJournee() {
  if (etat.jourCloture) return;
  etat.jourCloture = true;
  if (!statistiquesDuJour(etat.dateJour)) {
    calculerStatistiquesJour({
      cycle: etat.cycle,
      date: etat.dateJour,
      compte: etat.compte,
      visionnageSecondes: totalVisionnage(etat.dateJour),
    });
  }
  for (const session of tous('SELECT * FROM session_quotidienne WHERE date = ?', etat.dateJour)) {
    if (session.statut !== 'Termine') {
      majSession(session.id, {
        statut: 'Termine',
        termine_le: new Date().toISOString(),
        details: JSON.stringify({ cloturee_automatiquement: true }),
      });
    }
  }
  if (etat.cycle?.id) {
    executer(`UPDATE cycle SET statut = 'Termine', termine_le = ? WHERE id = ?`, new Date().toISOString(), etat.cycle.id);
  }
  const stats = statistiquesDuJour(etat.dateJour);
  marquerJourCycle(etat.dateJour, {
    numeroJour: etat.numeroJour,
    publications: stats?.publications ?? 0,
    interactions: stats?.interactions ?? 0,
    abonnes: stats?.abonnesGagnes ?? 0,
  });

  let numeroJour = etat.numeroJour + 1;
  let cycleNumero = etat.cycleNumero;
  if (numeroJour > config.dureeCycleJours) {
    numeroJour = 1;
    cycleNumero += 1;
    notifier({
      type: 'cycle',
      titre: 'Cycle de 30 jours relancé',
      message: `Le cycle ${etat.cycleNumero} est terminé. Le cycle ${cycleNumero} démarre automatiquement avec le même compte et le même historique (R10).`,
      niveau: 'Info',
      lien: '/#/cycle',
    });
    journaliser(`Cycle ${etat.cycleNumero} terminé — relance automatique du cycle ${cycleNumero}.`, {
      categorie: 'cycle',
      niveau: 'info',
      donnees: { cycleNumero },
    });
  }
  etat.prochaineJournee = {
    date: ajouterJours(etat.dateJour, 1),
    numeroJour,
    cycleNumero,
  };
  etat.horloge = 'en_pause';
  etat.entreJours = true;
  etat.repriseA = Date.now() + config.pauseInterJourMs;
  etat.session = null;
  journaliser(
    `Journée ${etat.numeroJour}/${config.dureeCycleJours} clôturée · ${stats?.publications ?? 0} publication(s) · ${stats?.interactions ?? 0} interaction(s).`,
    { categorie: 'cycle', jour: etat.dateJour, cycleId: etat.cycle?.id },
  );
}

async function demarrerJourneeSuivante() {
  if (!etat.prochaineJournee) {
    etat.horloge = 'arrete';
    return;
  }
  const { date, numeroJour, cycleNumero } = etat.prochaineJournee;
  etat.prochaineJournee = null;
  await synchroniserDriveSiConfigure();
  preparerJournee({ date, numeroJour, cycleNumero });
  etat.dernierTick = Date.now();
}

/* ─────────────────────────── boucle ─────────────────────────── */

function assurerBoucle() {
  if (!minuteur) {
    minuteur = setInterval(boucle, 400);
    if (minuteur.unref) minuteur.unref();
  }
}

function boucle() {
  tick().catch((erreur) => {
    journaliser(`Erreur moteur : ${erreur.message}`, { niveau: 'erreur', categorie: 'systeme' });
  });
}

async function tick() {
  const maintenant = Date.now();
  const dt = Math.min(1.5, Math.max(0, (maintenant - (etat.dernierTick || maintenant)) / 1000));
  etat.dernierTick = maintenant;

  if (etat.horloge === 'en_pause') {
    if (etat.entreJours && maintenant >= etat.repriseA) {
      await demarrerJourneeSuivante();
    }
    return;
  }
  if (etat.horloge !== 'en_cours') return;
  if (enExecution) return;

  etat.minuteJour = Math.min(1440, etat.minuteJour + etat.vitesse * dt);
  await traiterTaches();
  if (etat.minuteJour >= 1440) await cloturerJournee();
}

/* ─────────────────────────── API publique ─────────────────────────── */

export function estDemarre() {
  return etat.horloge === 'en_cours' || etat.horloge === 'en_pause';
}

export async function demarrerMoteur({ silencieux = false } = {}) {
  // Production : le moteur refuse de tourner tant que les données ne sont pas fournies.
  if (!moteurAutorise()) {
    etat.horloge = 'arrete';
    journaliser('Démarrage refusé : la configuration de production est incomplète.', {
      niveau: 'alerte',
      categorie: 'systeme',
    });
    return etatPublic();
  }
  assurerAgent();
  assurerCompte();
  assurerParametres();
  assurerCibles();
  etat.compte = comptePublic();
  etat.vitesse = etat.vitesse || config.vitesseDefaut;

  if (etat.horloge === 'en_cours') return etatPublic();
  if (etat.horloge === 'en_pause' && etat.pauseManuelle) {
    etat.horloge = 'en_cours';
    etat.pauseManuelle = false;
    etat.dernierTick = Date.now();
    return etatPublic();
  }
  if (etat.horloge === 'en_pause' && etat.entreJours) {
    await demarrerJourneeSuivante();
    return etatPublic();
  }

  await amorcerHistorique({ silencieux });
  ecrireMeta('moteur.actif', true);
  ecrireMeta('moteur.vitesse', etat.vitesse);

  const aujourdHui = dateDansFuseau(config.fuseau);
  const dernier = un('SELECT * FROM cycle ORDER BY date_debut DESC, numero_jour DESC LIMIT 1');
  let date = aujourdHui;
  // Jour 1 du premier cycle = configuration manuelle (cahier des charges §7).
  let numeroJour = Math.min(config.dureeCycleJours, config.jourConfiguration + 1);
  let cycleNumero = 1;

  if (dernier) {
    cycleNumero = dernier.cycle_numero;
    if (dernier.statut !== 'Termine') {
      const jourInterrompu = dernier.date_debut < aujourdHui;
      if (jourInterrompu) {
        // Arrêt survenu un jour précédent : on ne rejoue pas la journée manquée
        // (risque de rafale de publications). Elle est clôturée « Interrompu ».
        executer(`UPDATE cycle SET statut = 'Interrompu', termine_le = ? WHERE id = ?`, new Date().toISOString(), dernier.id);
        numeroJour = dernier.numero_jour + 1;
        journaliser(
          `Reprise après arrêt : la journée du ${dernier.date_debut} n’a pas été rejouée.`,
          { niveau: 'alerte', categorie: 'systeme', donnees: { jourManque: dernier.date_debut } },
        );
        notifier({
          type: 'systeme',
          titre: 'Reprise après interruption',
          message: `Le moteur s’est arrêté avant la fin du ${dernier.date_debut}. Cette journée a été clôturée sans rattrapage pour éviter une rafale de publications.`,
          niveau: 'Avertissement',
          lien: '/#/cycle',
        });
        detecterAnomalie('RepriseApresArret', `Journée du ${dernier.date_debut} interrompue (arrêt du serveur).`, {
          severite: 'Avertissement',
          details: { dateManquee: dernier.date_debut },
        });
      } else {
        // Arrêt le même jour : on reprend la journée là où elle s'était arrêtée.
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
  await synchroniserDriveSiConfigure();
  preparerJournee({ date, numeroJour, cycleNumero });
  assurerBoucle();
  return etatPublic();
}

/**
 * Synchronisation Google Drive au démarrage et à chaque changement de journée.
 * Silencieuse en cas d'échec : le moteur continue avec le stock local et
 * l'incident est journalisé.
 */
export async function synchroniserDriveSiConfigure() {
  const { driveConfigure } = await import('../services/drive-google.js');
  if (!config.googleDrive.active || !driveConfigure()) return { actif: false, importes: 0 };
  try {
    return await synchroniserDrive();
  } catch (erreur) {
    journaliser(`Synchronisation Google Drive impossible : ${erreur.message}`, {
      niveau: 'alerte',
      categorie: 'drive',
    });
    return { actif: true, importes: 0, erreurs: [{ message: erreur.message }] };
  }
}

export function mettreEnPause() {
  if (etat.horloge !== 'en_cours') return etatPublic();
  etat.horloge = 'en_pause';
  etat.pauseManuelle = true;
  etat.entreJours = false;
  journaliser('Moteur mis en pause par le responsable.', { categorie: 'systeme', niveau: 'alerte' });
  return etatPublic();
}

export async function reprendreMoteur() {
  if (etat.horloge === 'en_pause' && etat.entreJours) {
    await demarrerJourneeSuivante();
    return etatPublic();
  }
  if (etat.horloge !== 'en_cours') {
    etat.horloge = 'en_cours';
    etat.pauseManuelle = false;
    etat.dernierTick = Date.now();
    assurerBoucle();
    journaliser('Moteur relancé.', { categorie: 'systeme' });
  }
  return etatPublic();
}

export function arreterMoteur() {
  etat.horloge = 'arrete';
  etat.pauseManuelle = false;
  etat.entreJours = false;
  if (minuteur) {
    clearInterval(minuteur);
    minuteur = null;
  }
  ecrireMeta('moteur.actif', false);
  journaliser('Moteur arrêté par le responsable.', { categorie: 'systeme', niveau: 'alerte' });
  return etatPublic();
}

export function changerVitesse(vitesse) {
  const valeur = Math.max(1, Math.min(240, Number(vitesse) || config.vitesseDefaut));
  etat.vitesse = valeur;
  ecrireMeta('moteur.vitesse', valeur);
  return valeur;
}

export async function avancer(minutes = 30, { baseUrl = '' } = {}) {
  if (etat.horloge === 'arrete') await demarrerMoteur();
  if (etat.horloge === 'en_pause' && etat.entreJours) await demarrerJourneeSuivante();
  if (etat.horloge === 'en_pause' && etat.pauseManuelle) await reprendreMoteur();
  assurerBoucle();
  const pas = Math.max(1, Math.min(600, Number(minutes) || 30));
  const cible = Math.min(1440, etat.minuteJour + pas);
  const ancien = etat.minuteJour;
  etat.minuteJour = ancien;
  while (etat.minuteJour < cible) {
    etat.minuteJour = Math.min(cible, etat.minuteJour + 1);
    await traiterTaches();
  }
  if (etat.minuteJour >= 1440) await cloturerJournee();
  journaliser(`Avance manuelle de ${pas} minutes simulées.`, { categorie: 'systeme' });
  return etatPublic();
}

export async function forcerFinJour() {
  etat.minuteJour = Math.max(etat.minuteJour, 1432);
  await traiterTaches();
  etat.minuteJour = 1440;
  await traiterTaches();
  await cloturerJournee();
  return etatPublic();
}

/** Historique de démarrage : simule quelques journées complètes pour la démo. */
export async function amorcerHistorique({ silencieux = false } = {}) {
  if (lireMeta('amorcageFait', false)) return { amorce: false };
  const jours = config.amorcageJours;
  if (jours <= 0) {
    ecrireMeta('amorcageFait', true);
    return { amorce: false };
  }
  const compte = assurerCompte();
  const aujourdHui = dateDansFuseau(config.fuseau);
  let simulees = 0;
  for (let i = jours; i >= 1; i -= 1) {
    const date = ajouterJours(aujourdHui, -i);
    if (un('SELECT COUNT(*) AS n FROM cycle WHERE date_debut = ?', date)?.n) continue;
    await simulerJourComplet({ date, numeroJour: jours - i + 1, cycleNumero: 1, compte, silencieux: true });
    simulees += 1;
  }
  ecrireMeta('amorcageFait', true);
  if (simulees) {
    if (!silencieux) {
      notifier({
        type: 'systeme',
        titre: 'Historique de démarrage chargé',
        message: `${simulees} journée(s) complètes ont été simulées pour initialiser les statistiques, les rapports et le Drive.`,
        niveau: 'Info',
        lien: '/#/statistiques',
      });
    }
    journaliser(`Amorçage terminé : ${simulees} journée(s) historiques générées.`, {
      categorie: 'systeme',
      donnees: { jours: simulees },
    });
  }
  return { amorce: simulees > 0, jours: simulees };
}

async function simulerJourComplet({ date, numeroJour, cycleNumero, compte, silencieux = true }) {
  const cycle = creerCycle({ date, numeroJour, cycleNumero, compteId: compte.id });
  const sessions = creerSessions(cycle, date);
  plannifierJournee({ cycleId: cycle.id, compte, date, numeroJour });
  const publications = planifierPublicationsDuJour({ cycle, date, compte });

  for (const publication of publications) {
    await publierPublication(publication.id);
  }

  const alea = creerAlea(Number(date.replace(/-/g, '')) % 2147483647);
  for (let lot = 0; lot < 8; lot += 1) {
    const minute = alea.entier(970, 1430);
    const session = sessions.find((s) => {
      const [h, m] = s.heureDebut.split(':').map(Number);
      const [hf, mf] = s.heureFin.split(':').map(Number);
      return minute >= h * 60 + m && minute < (hf * 60 + mf === 0 ? 1440 : hf * 60 + mf);
    });
    executerLotInteractions({
      date,
      minute,
      cycleId: cycle.id,
      sessionId: session?.id,
      compte,
      volume: alea.entier(5, 9),
      graine: alea.entier(1, 99999),
    });
  }

  // Visionnage : ~32 min réparties sur les deux sessions
  const partages = [
    { session: sessions[0], secondes: alea.entier(880, 1000), minute: alea.entier(1000, 1180) },
    { session: sessions[0], secondes: alea.entier(380, 460), minute: alea.entier(1180, 1195) },
    { session: sessions[1], secondes: alea.entier(700, 820), minute: alea.entier(1230, 1380) },
    { session: sessions[1], secondes: alea.entier(240, 320), minute: alea.entier(1380, 1425) },
  ];
  for (const partage of partages) {
    enregistrerVisionnage({
      date,
      minute: partage.minute,
      secondes: partage.secondes,
      sessionId: partage.session?.id,
      compte,
      cible: null,
    });
  }

  for (const ligne of tous('SELECT * FROM publication WHERE jour = ? AND statut = ?', date, 'Publiee')) {
    simulerReactionsEntrantes({
      publication: ligne,
      date,
      compte,
      graine: alea.entier(1, 99999),
      theme: 'fitness',
    });
  }

  calculerStatistiquesJour({ cycle, date, compte, visionnageSecondes: partages.reduce((s, p) => s + p.secondes, 0) });

  for (const session of sessions) {
    majSession(session.id, {
      statut: 'Termine',
      demarre_le: new Date().toISOString(),
      termine_le: new Date().toISOString(),
    });
  }
  executer(`UPDATE cycle SET statut = 'Termine', termine_le = ? WHERE id = ?`, new Date().toISOString(), cycle.id);

  const rapport = genererRapport({
    type: 'quotidien',
    date,
    cycle,
    compte,
    silencieux,
  });
  if (silencieux) executer('UPDATE rapport SET envoye = 1 WHERE id = ?', rapport.id);
  if (numeroJour % 7 === 0) {
    genererRapportHebdomadaire({ date, compte, cycle });
  }
  journaliser(`Journée historique J${numeroJour} simulée (${publications.length} publications).`, {
    categorie: 'cycle',
    jour: date,
    cycleId: cycle.id,
  });
}

/* ─────────────────────────── vues ─────────────────────────── */

export function executionDuJour() {
  if (!etat.dateJour) return [];
  return tous('SELECT * FROM execution WHERE jour = ? ORDER BY heure_prevue', etat.dateJour).map((l) => ({
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
    `SELECT c.*, s.duree_visionnage, s.statut AS session_statut,
       (SELECT COUNT(*) FROM publication p WHERE p.cycle_id = c.id AND p.statut = 'Publiee') AS publications,
       (SELECT COUNT(*) FROM interaction i WHERE i.date = c.date_debut) AS interactions
     FROM cycle c
     LEFT JOIN session_quotidienne s ON s.cycle_id = c.id AND s.heure_debut = '16:00'
     ORDER BY c.date_debut DESC, c.numero_jour DESC LIMIT ?`,
    limite,
  ).map((l) => ({
    ...mapperCycle(l),
    publications: l.publications,
    interactions: l.interactions,
    visionnageMin: Math.round((l.duree_visionnage || 0) / 60),
    sessionStatut: l.session_statut,
  }));
}

export function etatPublic() {
  const kpis = kpisGlobaux();
  const jour = etat.dateJour;
  const publications = jour ? listerPublications({ jour, limite: 24 }) : [];
  const stats = jour ? statistiquesDuJour(jour) : null;
  const visionnageSecondes = jour ? totalVisionnage(jour) : 0;
  const interactions = jour ? statistiquesInteractions({ date: jour }) : { parType: {}, parPays: [], sortantes: 0, entrantes: 0, total: 0 };
  const sessionCourante = sessionPourMinute(etat.minuteJour);
  const plan = etat.plan
    .filter((t) => t.statut !== 'Effectue' || t.minute <= etat.minuteJour)
    .sort((a, b) => a.minute - b.minute || (PRIORITE[a.type] ?? 9) - (PRIORITE[b.type] ?? 9))
    .slice(0, 120);

  return {
    version: config.version,
    mode: config.modeInstagram,
    environnement: config.environnement,
    production: config.production,
    interactionsActives: config.interactionsActives,
    configuration: etatConfiguration(),
    fuseau: config.fuseau,
    horloge: {
      etat: etat.horloge,
      vitesse: etat.vitesse,
      heure: minutesVersHHMM(etat.minuteJour),
      minute: Math.round(etat.minuteJour),
      date: jour,
      entreJours: etat.entreJours,
      pauseManuelle: etat.pauseManuelle,
      suspenduJusqua: etat.suspenduJusqua ? minutesVersHHMM(etat.suspenduJusqua) : null,
      progression: arrondi(((etat.minuteJour - 960) / 480) * 100, 1),
      prochaineDans: etat.prochaineJournee,
      demarreLe: etat.demarreLe,
      sessionCourante: sessionCourante
        ? { numero: sessionCourante.heureDebut === '16:00' ? 1 : 2, ...sessionCourante }
        : null,
      sessions: etat.sessions,
    },
    programme: {
      cycleNumero: etat.cycleNumero,
      numeroJour: etat.numeroJour,
      joursTotal: config.dureeCycleJours,
      progression: arrondi(((etat.numeroJour - 1) / config.dureeCycleJours) * 100, 1),
      objectifFinal: {
        ageMinimum: OBJECTIF.ageMinimum,
        pays: obtenirParametres().paysAutorises,
        visionnageMin: OBJECTIF.visionnageMinParJour / 60,
        heures: '16 h → 00 h',
        lienExterne: 'https://tavia.app/avatar/maya',
      },
    },
    cycle: etat.cycle,
    compte: comptePublic(),
    agent: agentCourant(),
    audience: obtenirParametres(),
    kpis,
    journee: {
      publications,
      statistiques: stats,
      visionnage: {
        secondes: visionnageSecondes,
        minutes: Math.round(visionnageSecondes / 60),
        objectif: OBJECTIF.visionnageMinParJour,
        atteint: visionnageSecondes >= OBJECTIF.visionnageMinParJour,
      },
      interactions: {
        ...interactions,
        suivis: suivisDuJour(jour),
      },
      sessions: etat.sessions,
    },
    plan: plan.map((t) => ({
      id: t.id,
      type: t.type,
      heure: minutesVersHHMM(t.minute),
      minute: t.minute,
      libelle: t.libelle,
      statut: t.statut,
      erreur: t.erreur || null,
    })),
    execution: executionDuJour(),
    flux: listerJournal({ limite: 14 }),
    alertes: listerAnomalies({ limite: 5 }).filter((a) => a.statut !== 'Resolue'),
    liens: {
      clicsAujourdhui: clicsDuJour(jour),
      clics30Jours: statistiquesLiens({ jours: 30 }).total,
    },
    compteurs: {
      notifications: compterNotificationsNonLues(),
      anomalies: compterAnomaliesOuvertes(),
      publications: compterPublicationsParStatut(),
    },
    serveur: {
      heure: new Date().toISOString(),
      demarreLe: etat.demarreLe,
      version: process.version,
      memoire: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
}

export { ETAPES };
