import { ErreurHttp, envoyerJson, lireJson, servirFichier } from '../utils/http.js';
import { config } from '../config.js';
import { tous } from '../db.js';
import { dateDansFuseau } from '../utils/temps.js';
import { CLASSES, RELATIONS, ENUMERATIONS, EXTENSIONS, FLUX } from '../donnees/diagramme.js';
import { REGLES, OBJECTIF, PAYS_AUTORISES, ETAPES_FLUX } from '../../public/shared/enums.js';
import * as moteur from '../domaine/moteur.js';
import { comptePublic, configurerManuellement, reinitialiserCycle, archiverDonnees, recupererStatistiques } from '../domaine/compte.js';
import { agentCourant, configurerProfil } from '../domaine/agent.js';
import { obtenirParametres, configurerParametres } from '../domaine/audience.js';
import {
  listerContenus,
  obtenirContenu,
  telecharger,
  archiver,
  supprimerContenu,
  synchroniser,
  ajouterContenu,
  statistiquesDrive,
} from '../domaine/drive.js';
import {
  listerPublications,
  publierPublication,
  supprimerPublication,
  verifierStatut,
  mapperPublication,
} from '../domaine/publications.js';
import { un } from '../db.js';
import {
  listerInteractions,
  listerAbonnements,
  verifierStatutAbonnement,
  statistiquesInteractions,
  suivreCible,
} from '../domaine/interactions.js';
import { listerCibles, analyserCible, analyserToutesCibles, statistiquesCibles, compterCiblesParStatut } from '../domaine/cibles.js';
import {
  agregerPeriode,
  serieJournaliere,
  repartitionPays,
  kpisGlobaux,
  courbeAbonnes,
  topPublications,
} from '../domaine/statistiques.js';
import {
  listerRapports,
  obtenirRapport,
  genererRapport,
  envoyerRapport,
  exporterRapport,
  statistiquesRapports,
} from '../domaine/rapports.js';
import { listerJournal, listerNotifications, marquerNotificationLue, marquerToutesLues, compterNotificationsNonLues } from '../domaine/journal.js';
import { listerAnomalies, resoudreAnomalie, prendreEnCharge } from '../domaine/anomalies.js';
import { listerVeille, collecterVeille, marquerVeilleTraitee } from '../domaine/veille.js';

const routes = [];
const route = (methode, motif, gestionnaire) => routes.push({ methode, motif, gestionnaire });
const q = (url, cle, defaut = null) => url.searchParams.get(cle) ?? defaut;
const nombre = (url, cle, defaut) => {
  const brut = url.searchParams.get(cle);
  if (brut === null || brut.trim() === '') return defaut;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : defaut;
};

/* ───────────── état & pilotage ───────────── */
route('GET', /^\/api\/sante$/, () => ({ statut: 'ok', version: config.version, mode: config.modeInstagram, heure: new Date().toISOString() }));
route('GET', /^\/api\/etat$/, () => moteur.etatPublic());
route('POST', /^\/api\/controle\/demarrer$/, () => moteur.demarrerMoteur());
route('POST', /^\/api\/controle\/pause$/, () => moteur.mettreEnPause());
route('POST', /^\/api\/controle\/reprendre$/, () => moteur.reprendreMoteur());
route('POST', /^\/api\/controle\/arreter$/, () => moteur.arreterMoteur());
route('POST', /^\/api\/controle\/vitesse$/, async (req) => {
  const corps = await lireJson(req);
  return { vitesse: moteur.changerVitesse(corps.vitesse) };
});
route('POST', /^\/api\/controle\/avancer$/, async (req) => {
  const corps = await lireJson(req);
  await moteur.avancer(corps.minutes ?? 30);
  return moteur.etatPublic();
});
route('POST', /^\/api\/controle\/fin-jour$/, async () => {
  await moteur.forcerFinJour();
  return moteur.etatPublic();
});

/* ───────────── compte / agent / audience ───────────── */
route('GET', /^\/api\/compte$/, () => ({ compte: comptePublic(), agent: agentCourant(), statistiques: recupererStatistiques() }));
route('PUT', /^\/api\/compte$/, async (req) => {
  const corps = await lireJson(req);
  return { compte: configurerManuellement(corps) };
});
route('GET', /^\/api\/compte\/photo$/, (req, res) => {
  const photo = un(
    `SELECT chemin_public FROM contenu_drive WHERE type = 'PhotoProfil' ORDER BY date_ajout DESC LIMIT 1`,
  );
  if (!photo?.chemin_public) throw new ErreurHttp(404, 'Photo de profil introuvable');
  res.writeHead(302, { location: `/media/${photo.chemin_public.split('/').map(encodeURIComponent).join('/')}` });
  res.end();
  return undefined;
});
route('POST', /^\/api\/compte\/reinitialiser-cycle$/, async (req) => {
  const corps = await lireJson(req).catch(() => ({}));
  return { compte: reinitialiserCycle({ conserverHistorique: corps.conserverHistorique !== false }) };
});
route('POST', /^\/api\/compte\/archiver$/, () => archiverDonnees());
route('GET', /^\/api\/agent$/, () => agentCourant());
route('PUT', /^\/api\/agent$/, async (req) => configurerProfil(await lireJson(req)));
route('GET', /^\/api\/audience$/, () => ({ parametres: obtenirParametres(), pays: PAYS_AUTORISES, objectif: OBJECTIF }));
route('PUT', /^\/api\/audience$/, async (req) => ({ parametres: configurerParametres(await lireJson(req)) }));

/* ───────────── cycle & sessions ───────────── */
route('GET', /^\/api\/cycles$/, (req, res, params, url) => ({ cycles: moteur.listerCycles({ limite: nombre(url, 'limite', 40) }), courant: moteur.etat.cycle }));
route('GET', /^\/api\/cycles\/([^/]+)$/, (req, res, [id]) => {
  const cycle = un('SELECT * FROM cycle WHERE id = ?', id);
  if (!cycle) throw new ErreurHttp(404, 'Cycle introuvable');
  return {
    cycle,
    sessions: tous('SELECT * FROM session_quotidienne WHERE cycle_id = ? ORDER BY heure_debut', id),
    publications: listerPublications({ cycleId: id, limite: 50 }),
    statistiques: tous(`SELECT * FROM statistiques WHERE cycle_id = ?`, id),
    execution: tous('SELECT * FROM execution WHERE cycle_id = ? ORDER BY heure_prevue', id),
  };
});
route('GET', /^\/api\/execution$/, () => ({ execution: moteur.executionDuJour(), etapes: ETAPES_FLUX }));

/* ───────────── publications ───────────── */
route('GET', /^\/api\/publications$/, (req, res, params, url) => ({
  publications: listerPublications({
    jour: q(url, 'jour'),
    statut: q(url, 'statut'),
    type: q(url, 'type'),
    cycleId: q(url, 'cycleId'),
    limite: nombre(url, 'limite', 100),
  }),
}));
route('GET', /^\/api\/publications\/([^/]+)\/statut$/, (req, res, [id]) => verifierStatut(id));
route('GET', /^\/api\/publications\/([^/]+)$/, (req, res, [id]) => {
  const ligne = un(
    `SELECT p.*, c.chemin_public, c.theme FROM publication p
     LEFT JOIN contenu_drive c ON c.id = p.contenu_id WHERE p.id = ?`,
    id,
  );
  if (!ligne) throw new ErreurHttp(404, 'Publication introuvable');
  return { publication: mapperPublication(ligne) };
});
route('POST', /^\/api\/publications\/([^/]+)\/publier$/, async (req, res, [id]) => {
  const publication = await publierPublication(id);
  if (!publication) throw new ErreurHttp(404, 'Publication introuvable');
  return { publication, etat: moteur.etatPublic() };
});
route('DELETE', /^\/api\/publications\/([^/]+)$/, (req, res, [id]) => {
  const publication = supprimerPublication(id);
  if (!publication) throw new ErreurHttp(404, 'Publication introuvable');
  return { publication };
});

/* ───────────── drive ───────────── */
route('GET', /^\/api\/contenus$/, (req, res, params, url) => ({
  contenus: listerContenus({
    statut: q(url, 'statut'),
    type: q(url, 'type'),
    theme: q(url, 'theme'),
    recherche: q(url, 'recherche'),
    limite: nombre(url, 'limite', 120),
  }),
  statistiques: statistiquesDrive(),
}));
route('GET', /^\/api\/contenus\/([^/]+)$/, (req, res, [id]) => {
  const contenu = obtenirContenu(id);
  if (!contenu) throw new ErreurHttp(404, 'Contenu introuvable');
  return { contenu };
});
route('POST', /^\/api\/contenus\/upload$/, async (req) => {
  const corps = await lireJson(req, 40_000_000);
  return { contenu: ajouterContenu(corps) };
});
route('POST', /^\/api\/contenus\/synchroniser$/, () => synchroniser());
route('POST', /^\/api\/contenus\/([^/]+)\/telecharger$/, (req, res, [id]) => {
  const contenu = telecharger(id);
  if (!contenu) throw new ErreurHttp(404, 'Contenu introuvable');
  return { contenu };
});
route('POST', /^\/api\/contenus\/([^/]+)\/archiver$/, (req, res, [id]) => {
  const contenu = archiver(id);
  if (!contenu) throw new ErreurHttp(404, 'Contenu introuvable');
  return { contenu };
});
route('DELETE', /^\/api\/contenus\/([^/]+)$/, (req, res, [id]) => {
  const contenu = supprimerContenu(id);
  if (!contenu) throw new ErreurHttp(404, 'Contenu introuvable');
  return { contenu };
});

/* ───────────── interactions & cibles ───────────── */
route('GET', /^\/api\/interactions$/, (req, res, params, url) => ({
  interactions: listerInteractions({
    type: q(url, 'type'),
    sens: q(url, 'sens'),
    pays: q(url, 'pays'),
    date: q(url, 'date'),
    limite: nombre(url, 'limite', 150),
  }),
  statistiques: statistiquesInteractions({ date: q(url, 'date') }),
}));
route('GET', /^\/api\/abonnements$/, () => ({ abonnements: listerAbonnements({ limite: 200 }) }));
route('GET', /^\/api\/abonnements\/([^/]+)\/statut$/, (req, res, [id]) => verifierStatutAbonnement(id));
route('GET', /^\/api\/cibles$/, (req, res, params, url) => ({
  cibles: listerCibles({
    statut: q(url, 'statut'),
    pays: q(url, 'pays'),
    reference: q(url, 'reference'),
    recherche: q(url, 'recherche'),
    tri: q(url, 'tri', 'score'),
    limite: nombre(url, 'limite', 120),
  }),
  statistiques: statistiquesCibles(),
  parStatut: compterCiblesParStatut(),
}));
route('POST', /^\/api\/cibles\/analyser-tout$/, () => {
  const resultats = analyserToutesCibles();
  return { analyses: resultats.length, statistiques: statistiquesCibles(), parStatut: compterCiblesParStatut() };
});
route('POST', /^\/api\/cibles\/([^/]+)\/analyser$/, (req, res, [id]) => {
  const cible = analyserCible(id);
  if (!cible) throw new ErreurHttp(404, 'Cible introuvable');
  return { cible };
});
route('POST', /^\/api\/cibles\/([^/]+)\/suivre$/, (req, res, [id]) => {
  const resultat = suivreCible(id);
  if (!resultat) throw new ErreurHttp(404, 'Cible introuvable');
  return resultat;
});

/* ───────────── statistiques ───────────── */
route('GET', /^\/api\/statistiques$/, (req, res, params, url) => {
  const periode = q(url, 'periode', 'mois');
  return {
    periode,
    agregat: agregerPeriode({ periode }),
    serie: serieJournaliere({ jours: periode === 'jour' ? 1 : periode === 'semaine' ? 7 : 30 }),
    pays: repartitionPays({ periode }),
    top: topPublications({ limite: 5, periode }),
    kpis: kpisGlobaux(),
    courbe: courbeAbonnes({ jours: 30 }),
    objectif: OBJECTIF,
  };
});
route('GET', /^\/api\/statistiques\/pays$/, (req, res, params, url) => ({
  pays: repartitionPays({ periode: q(url, 'periode', 'mois') }),
}));

/* ───────────── rapports ───────────── */
route('GET', /^\/api\/rapports$/, (req, res, params, url) => ({
  rapports: listerRapports({ type: q(url, 'type'), limite: nombre(url, 'limite', 60) }),
  statistiques: statistiquesRapports(),
}));
route('POST', /^\/api\/rapports\/generer$/, async (req) => {
  const corps = await lireJson(req);
  const date = corps.date || moteur.etat.dateJour || dateDansFuseau(config.fuseau);
  const rapport = genererRapport({
    type: corps.type || 'quotidien',
    date,
    cycle: moteur.etat.cycle,
    compte: comptePublic(),
  });
  return { rapport };
});
route('GET', /^\/api\/rapports\/([^/]+)\/export$/, (req, res, [id]) => {
  const rapport = obtenirRapport(id);
  if (!rapport) throw new ErreurHttp(404, 'Rapport introuvable');
  const { chemin, nom } = exporterRapport(id);
  if (!servirFichier(res, config.dossierRapports, nom, { download: true, nomFichier: nom })) {
    throw new ErreurHttp(404, `Export introuvable (${chemin})`);
  }
  return undefined;
});
route('POST', /^\/api\/rapports\/([^/]+)\/envoyer$/, async (req, res, [id]) => {
  const rapport = await envoyerRapport(id);
  if (!rapport) throw new ErreurHttp(404, 'Rapport introuvable');
  return { rapport };
});
route('GET', /^\/api\/rapports\/([^/]+)$/, (req, res, [id]) => {
  const rapport = obtenirRapport(id);
  if (!rapport) throw new ErreurHttp(404, 'Rapport introuvable');
  return { rapport };
});

/* ───────────── journal / anomalies / notifications / veille ───────────── */
route('GET', /^\/api\/journal$/, (req, res, params, url) => ({
  evenements: listerJournal({
    limite: nombre(url, 'limite', 120),
    niveau: q(url, 'niveau'),
    categorie: q(url, 'categorie'),
    jour: q(url, 'jour'),
    recherche: q(url, 'recherche'),
  }),
}));
route('GET', /^\/api\/anomalies$/, (req, res, params, url) => ({
  anomalies: listerAnomalies({ statut: q(url, 'statut'), severite: q(url, 'severite'), limite: nombre(url, 'limite', 100) }),
}));
route('POST', /^\/api\/anomalies\/([^/]+)\/resoudre$/, async (req, res, [id]) => {
  const corps = await lireJson(req).catch(() => ({}));
  const anomalie = resoudreAnomalie(id, corps.note || '');
  if (!anomalie) throw new ErreurHttp(404, 'Anomalie introuvable');
  return { anomalie };
});
route('POST', /^\/api\/anomalies\/([^/]+)\/prendre$/, (req, res, [id]) => ({ modifiees: prendreEnCharge(id) }));
route('GET', /^\/api\/notifications$/, () => ({ notifications: listerNotifications(40), nonLues: compterNotificationsNonLues() }));
route('POST', /^\/api\/notifications\/lues$/, () => ({ marquees: marquerToutesLues() }));
route('POST', /^\/api\/notifications\/([^/]+)\/lue$/, (req, res, [id]) => ({ marquees: marquerNotificationLue(id) }));
route('GET', /^\/api\/veille$/, (req, res, params, url) => ({ veille: listerVeille({ limite: nombre(url, 'limite', 20), type: q(url, 'type') }) }));
route('POST', /^\/api\/veille\/collecter$/, () => collecterVeille());
route('POST', /^\/api\/veille\/([^/]+)\/traiter$/, (req, res, [id]) => ({ modifiees: marquerVeilleTraitee(id) }));

/* ───────────── architecture & export ───────────── */
route('GET', /^\/api\/diagramme$/, () => ({
  classes: CLASSES,
  relations: RELATIONS,
  enumerations: ENUMERATIONS,
  extensions: EXTENSIONS,
  flux: FLUX,
  regles: REGLES,
  etapes: ETAPES_FLUX,
  objectif: OBJECTIF,
  mode: config.modeInstagram,
}));
route('GET', /^\/api\/export$/, (req, res) => {
  const donnees = {
    exporteLe: new Date().toISOString(),
    version: config.version,
    compte: comptePublic(),
    agent: agentCourant(),
    audience: obtenirParametres(),
    cycles: tous('SELECT * FROM cycle ORDER BY date_debut DESC LIMIT 60'),
    publications: tous('SELECT * FROM publication ORDER BY date_heure DESC LIMIT 300'),
    interactions: tous('SELECT * FROM interaction ORDER BY date_heure DESC LIMIT 500'),
    statistiques: tous('SELECT * FROM statistiques ORDER BY date DESC LIMIT 90'),
    cibles: tous('SELECT * FROM cible ORDER BY score_attractivite DESC LIMIT 300'),
    abonnements: tous('SELECT * FROM abonnement ORDER BY date_suivi DESC LIMIT 200'),
    rapports: listerRapports({ limite: 60 }),
    journal: listerJournal({ limite: 300 }),
    anomalies: listerAnomalies({ limite: 200 }),
  };
  const corps = JSON.stringify(donnees, null, 2);
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': `attachment; filename="insta-va-export-${new Date().toISOString().slice(0, 10)}.json"`,
  });
  res.end(corps);
  return undefined;
});

export async function routesApi(req, res, chemin, url) {
  const methode = req.method === 'HEAD' ? 'GET' : req.method;
  for (const { methode: m, motif, gestionnaire } of routes) {
    if (m !== methode) continue;
    const correspondance = motif.exec(chemin);
    if (!correspondance) continue;
    const params = correspondance.slice(1);
    const resultat = await gestionnaire(req, res, params, url);
    if (resultat !== undefined && !res.writableEnded) envoyerJson(res, 200, resultat);
    return true;
  }
  if (res.writableEnded) return true;
  throw new ErreurHttp(404, `Route inconnue : ${methode} ${chemin}`);
}

export function routesListe() {
  return routes.map((r) => `${r.methode} ${r.motif.source.replace(/\\\//g, '/').replace(/\^|\$/g, '')}`);
}
