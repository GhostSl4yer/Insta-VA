import { $, $$, echapper, nf, dateFr, toast, modale, fermerModale, confirmer } from './lib/ui.js';
import vuePilotage from './views/pilotage.js';
import vueCycle from './views/cycle.js';
import vueProgramme from './views/programme.js';
import vueDrive from './views/drive.js';
import vuePublications from './views/publications.js';
import vueCibles from './views/cibles.js';
import vueInteractions from './views/interactions.js';
import vueLiens from './views/liens.js';
import vueAbonnements from './views/abonnements.js';
import vueStatistiques from './views/statistiques.js';
import vueRapports from './views/rapports.js';
import vueJournal from './views/journal.js';
import vueAnomalies from './views/anomalies.js';
import vueArchitecture from './views/architecture.js';
import vueParametres from './views/parametres.js';
import vueInstallation from './views/installation.js';

/* ─────────────────────────── icônes ─────────────────────────── */

const ICONES = {
  pilotage: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/>',
  cycle: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  programme: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01"/>',
  drive: '<path d="M22 12H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z"/>',
  publications: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  cibles: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  interactions: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 13h5"/>',
  abonnements: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  statistiques: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  rapports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  journal: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/>',
  anomalies: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  architecture: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/><path d="M6.5 10v4h11v-4M12 14v-4"/>',
  parametres: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
  cloche: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  suivant: '<path d="M5 4l10 8-10 8z" fill="currentColor" stroke="none"/><rect x="17" y="4" width="2.5" height="16" rx="1" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  synchro: '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3v6h-6M3 21v-6h6"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  coeur: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  utilisateur: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  corbeille: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  envoyer: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
};

const icone = (nom, taille = 17) =>
  `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nom] || ICONES.pilotage}</svg>`;

/* ─────────────────────────── navigation ─────────────────────────── */

const ROUTES = [
  { cle: 'installation', chemin: '/installation', titre: 'Mise en service', vue: vueInstallation, icone: 'parametres', horsNav: true },
  { section: 'Pilotage' },
  { cle: 'pilotage', chemin: '/', titre: 'Tableau de bord', vue: vuePilotage, icone: 'pilotage' },
  { cle: 'cycle', chemin: '/cycle', titre: 'Cycle & journées', vue: vueCycle, icone: 'cycle' },
  { cle: 'programme', chemin: '/programme', titre: 'Programme 30 jours', vue: vueProgramme, icone: 'programme' },
  { section: 'Contenus' },
  { cle: 'drive', chemin: '/drive', titre: 'Drive', vue: vueDrive, icone: 'drive' },
  { cle: 'publications', chemin: '/publications', titre: 'Publications', vue: vuePublications, icone: 'publications' },
  { cle: 'liens', chemin: '/liens', titre: 'Lien & commentaires', vue: vueLiens, icone: 'interactions' },
  { section: 'Audience', condition: 'interactions' },
  { cle: 'cibles', chemin: '/cibles', titre: 'Cibles scorées', vue: vueCibles, icone: 'cibles' },
  { cle: 'interactions', chemin: '/interactions', titre: 'Interactions', vue: vueInteractions, icone: 'interactions' },
  { cle: 'abonnements', chemin: '/abonnements', titre: 'Abonnements', vue: vueAbonnements, icone: 'abonnements' },
  { section: 'Analyse' },
  { cle: 'statistiques', chemin: '/statistiques', titre: 'Statistiques', vue: vueStatistiques, icone: 'statistiques' },
  { cle: 'rapports', chemin: '/rapports', titre: 'Rapports', vue: vueRapports, icone: 'rapports' },
  { cle: 'journal', chemin: '/journal', titre: 'Journal', vue: vueJournal, icone: 'journal' },
  { cle: 'anomalies', chemin: '/anomalies', titre: 'Anomalies', vue: vueAnomalies, icone: 'anomalies' },
  { section: 'Système' },
  { cle: 'architecture', chemin: '/architecture', titre: 'Architecture', vue: vueArchitecture, icone: 'architecture' },
  { cle: 'parametres', chemin: '/parametres', titre: 'Paramètres', vue: vueParametres, icone: 'parametres' },
];

export const ctx = {
  etat: null,
  vue: null,
  params: {},
  route: 'pilotage',
  rafraichir: null,
  naviguer: null,
  icone,
  api: null,
  action: null,
  toast,
  confirmer,
  modale,
  fermerModale,
  vues: Object.fromEntries(ROUTES.filter((r) => r.cle).map((r) => [r.cle, r.vue])),
};
ctx.api = api;
ctx.action = action;

export async function api(chemin, options = {}) {
  const optionsFetch = { headers: {}, ...options };
  if (options.corps !== undefined) {
    optionsFetch.body = JSON.stringify(options.corps);
    optionsFetch.headers['content-type'] = 'application/json';
    optionsFetch.method = options.method || 'POST';
    delete optionsFetch.corps;
  }
  const reponse = await fetch(chemin, optionsFetch);
  const type = reponse.headers.get('content-type') || '';
  const donnees = type.includes('json') ? await reponse.json().catch(() => ({})) : await reponse.text();
  if (!reponse.ok) {
    const message = donnees?.erreur || donnees?.detail || `Erreur ${reponse.status}`;
    throw Object.assign(new Error(message), { statut: reponse.status, donnees });
  }
  return donnees;
}

export function action(nom, charge = {}) {
  return api(`/api/${nom}`, { corps: charge });
}

async function actionSure(promesse, messageSucces, options = {}) {
  try {
    const resultat = await promesse;
    if (messageSucces) toast(messageSucces.titre || messageSucces, { type: 'succes', titre: options.titre });
    if (options.rafraichir !== false) await rafraichirEtat();
    if (ctx.vue?.maj) ctx.vue.maj(document.getElementById('vue'), ctx);
    return resultat;
  } catch (erreur) {
    toast(erreur.message, { type: 'erreur', titre: 'Action impossible' });
    return null;
  }
}

/* ─────────────────────────── rendu shell ─────────────────────────── */

function routesVisibles() {
  const configuration = ctx.etat?.configuration;
  const interactions = ctx.etat?.interactionsActives !== false;
  const sortie = [];
  let sectionEnAttente = null;
  for (const route of ROUTES) {
    if (route.section) {
      if (route.condition === 'interactions' && !interactions) continue;
      sectionEnAttente = route.section;
      continue;
    }
    if (route.cle === 'installation') {
      if (!configuration?.requise || configuration?.complete) continue;
      sortie.push(route);
      continue;
    }
    if (!interactions && ['cibles', 'interactions', 'abonnements'].includes(route.cle)) continue;
    if (sectionEnAttente) {
      sortie.push({ section: sectionEnAttente });
      sectionEnAttente = null;
    }
    sortie.push(route);
  }
  return sortie;
}

function rendreNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = routesVisibles().map((route) => {
    if (route.section) return `<div class="nav-titre">${route.section}</div>`;
    const alertes = route.cle === 'anomalies' ? ctx.etat?.compteurs?.anomalies : 0;
    const notifs = route.cle === 'journal' ? ctx.etat?.compteurs?.notifications : 0;
    const compte = alertes || notifs;
    return `<a class="nav-item ${ctx.route === route.cle ? 'actif' : ''}" href="#${route.chemin}" data-route="${route.cle}" ${ctx.route === route.cle ? 'aria-current="page"' : ''}>
      ${icone(route.icone)}
      <span>${route.titre}</span>
      ${compte ? `<span class="pastille">${compte}</span>` : ''}
    </a>`;
  }).join('');
}

function rendreTopbar() {
  const etat = ctx.etat;
  if (!etat) return;
  const horloge = etat.horloge;
  document.getElementById('horloge').textContent = horloge.heure;
  document.getElementById('horloge-date').textContent = `${dateFr(horloge.date, { compact: true, court: true })} · J${etat.programme.numeroJour}/${etat.programme.joursTotal}`;

  const live = document.getElementById('statut-live');
  const libelles = {
    en_cours: ['autonome', ''],
    en_pause: [horloge.pauseManuelle ? 'en pause' : 'entre deux jours', 'pause'],
    arrete: ['à l’arrêt', 'arrete'],
  };
  const [texte, classe] = libelles[horloge.etat] || ['—', 'arrete'];
  live.className = `statut-live ${classe}`;
  live.innerHTML = `<span class="point"></span> ${texte}`;

  document.getElementById('chips').innerHTML = `
    <span class="chip accent">Session <strong>${horloge.sessionCourante ? horloge.sessionCourante.numero : '—'}/2</strong></span>
    <span class="chip">Cycle <strong>${etat.programme.cycleNumero}</strong></span>
    <span class="chip">${icone('oeil', 13)} ${nf(etat.kpis.abonnes)} abonnés</span>
    <span class="chip">${icone('coeur', 13)} ${nf(etat.journee.interactions.entrantes)} aujourd’hui</span>
    <span class="chip" title="pays autorisés">${etat.audience.paysAutorises.slice(0, 5).map((p) => ({ USA: '🇺🇸', France: '🇫🇷', RoyaumeUni: '🇬🇧', Allemagne: '🇩🇪', Pologne: '🇵🇱', AutresPays: '🌍' })[p]).join(' ')}</span>`;

  const enMarche = horloge.etat === 'en_cours';
  document.getElementById('transport').innerHTML = `
    <button class="btn btn-petit ${enMarche ? 'btn-fantome' : 'btn-primaire'}" data-transport="${enMarche ? 'pause' : 'play'}" title="${enMarche ? 'Mettre en pause' : 'Reprendre'}">
      ${icone(enMarche ? 'pause' : 'play', 14)} ${enMarche ? 'Pause' : 'Reprendre'}
    </button>
    <button class="btn btn-petit btn-fantome" data-transport="avancer" title="Avancer de 30 minutes simulées (A)">
      ${icone('suivant', 14)} +30 min
    </button>
    <select class="select btn-petit" data-vitesse title="Vitesse de l’horloge (minutes simulées / seconde)">
      ${[1, 6, 12, 30, 60, 120]
        .map((v) => `<option value="${v}" ${Number(etat.horloge.vitesse) === v ? 'selected' : ''}>${v} min/s</option>`)
        .join('')}
    </select>
    <button class="btn btn-petit btn-fantome cloche" data-transport="notifications" title="Notifications">
      ${icone('cloche', 15)}
      ${etat.compteurs.notifications ? `<span class="bulle">${etat.compteurs.notifications}</span>` : ''}
    </button>`;

  document.getElementById('resume-moteur').innerHTML = `
    <div class="entete"><span class="point" style="color:${enMarche ? 'var(--ok)' : 'var(--alerte)'}"></span> Moteur ${enMarche ? 'autonome' : horloge.etat === 'en_pause' ? 'en pause' : 'arrêté'}</div>
    <div class="ligne"><span>Journée</span><strong>J${etat.programme.numeroJour} · ${etat.horloge.heure}</strong></div>
    <div class="ligne"><span>Session</span><strong>${horloge.sessionCourante ? `${horloge.sessionCourante.heureDebut}–${horloge.sessionCourante.heureFin}` : '—'}</strong></div>
    <div class="ligne"><span>Publication(s)</span><strong>${etat.journee.publications.filter((p) => p.statut === 'Publiee').length}</strong></div>
    <div class="ligne"><span>Interactions</span><strong>${nf(etat.journee.interactions.sortantes)}</strong></div>
    <div class="ligne"><span>Visionnage</span><strong>${etat.journee.visionnage.minutes}/${etat.journee.visionnage.objectif / 60} min</strong></div>
    <div class="ligne"><span>Mode</span><strong>${etat.mode === 'graph' ? 'Graph' : 'Simulation'}</strong></div>`;
}

/**
 * Remplace le nœud #vue par un clone vierge : les écouteurs attachés par la vue
 * précédente disparaissent (sinon ils s'accumuleraient à chaque rafraîchissement).
 */
function nouvelleRacine() {
  const ancienne = document.getElementById('vue');
  const nouvelle = ancienne.cloneNode(false);
  nouvelle.dataset.pret = '0';
  ancienne.replaceWith(nouvelle);
  return nouvelle;
}

function rendreChargement(racine = document.getElementById('vue')) {
  racine.innerHTML = `
    <div class="entete-page"><h1><span class="skeleton" style="width:220px;height:26px;display:inline-block"></span></h1></div>
    <div class="grille g4">${Array.from({ length: 4 }, () => `<div class="carte"><div class="skeleton" style="height:70px"></div></div>`).join('')}</div>
    <div class="grille g-sidebar mt-16"><div class="carte"><div class="skeleton" style="height:320px"></div></div><div class="carte"><div class="skeleton" style="height:320px"></div></div></div>`;
}

/* ─────────────────────────── router ─────────────────────────── */

function analyserRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [chemin, requete] = hash.split('?');
  const route = ROUTES.find((r) => r.chemin === (chemin === '' ? '/' : chemin)) || ROUTES.find((r) => r.cle === 'pilotage');
  const params = Object.fromEntries(new URLSearchParams(requete || ''));
  return { route, params };
}

let jetonRendu = 0;

async function rendre() {
  const { route, params } = analyserRoute();
  const configuration = ctx.etat?.configuration;
  if (configuration?.requise && !configuration.complete && route.cle !== 'installation') {
    window.location.hash = '#/installation';
    return;
  }
  ctx.route = route.cle;
  ctx.params = params;
  ctx.vue = route.vue;
  rendreNav();
  document.getElementById('sidebar').classList.remove('ouvert');
  document.querySelector('.voile-nav')?.remove();
  document.title = `${route.titre} · Insta-VA`;
  window.scrollTo({ top: 0 });
  const jeton = ++jetonRendu;
  const racine = nouvelleRacine();
  rendreChargement(racine);
  try {
    const html = await route.vue.rendre({ ...ctx, params });
    if (jeton !== jetonRendu) return;
    racine.innerHTML = html;
    if (route.vue.monter) await route.vue.monter(racine, { ...ctx, params });
    racine.dataset.pret = '1';
  } catch (erreur) {
    if (jeton !== jetonRendu) return;
    console.error(erreur);
    racine.innerHTML = `<div class="carte"><div class="vide"><b>Impossible de charger cette vue</b>${echapper(erreur.message)}
      <div class="mt-12"><button class="btn btn-fantome" onclick="location.reload()">Recharger</button></div></div></div>`;
  }
}

ctx.naviguer = (chemin) => {
  window.location.hash = chemin;
};

ctx.rafraichir = async () => {
  await rafraichirEtat();
  if (!ctx.vue) return;
  const racine = nouvelleRacine();
  racine.innerHTML = await ctx.vue.rendre({ ...ctx });
  if (ctx.vue.monter) await ctx.vue.monter(racine, { ...ctx });
  racine.dataset.pret = '1';
  rendreTopbar();
  rendreNav();
};

ctx.signaler = (message, options) => toast(message, options);

async function rafraichirEtat() {
  try {
    ctx.etat = await api('/api/etat');
    rendreTopbar();
    rendreNav();
  } catch (erreur) {
    console.warn('État indisponible', erreur.message);
  }
}

/* ─────────────────────────── événements globaux ─────────────────────────── */

function brancherGlobal() {
  window.addEventListener('hashchange', rendre);

  document.addEventListener('click', async (evenement) => {
    const cible = evenement.target.closest('[data-transport]');
    if (cible) {
      const actionNom = cible.dataset.transport;
      cible.disabled = true;
      try {
        if (actionNom === 'pause') {
          await api('/api/controle/pause', { method: 'POST' });
          toast('Moteur mis en pause. Les publications reprendront à la reprise.', { titre: 'Pause' });
        } else if (actionNom === 'play') {
          await api('/api/controle/reprendre', { method: 'POST' });
          toast('Moteur relancé : le cycle continue.', { titre: 'Reprise', type: 'succes' });
        } else if (actionNom === 'avancer') {
          await api('/api/controle/avancer', { corps: { minutes: 30 } });
        } else if (actionNom === 'notifications') {
          await ouvrirNotifications();
        }
        await rafraichirEtat();
        if (ctx.vue?.maj) ctx.vue.maj(document.getElementById('vue'), ctx);
      } catch (erreur) {
        toast(erreur.message, { type: 'erreur' });
      } finally {
        cible.disabled = false;
      }
    }
  });

  document.addEventListener('change', async (evenement) => {
    if (evenement.target.matches('[data-vitesse]')) {
      const vitesse = Number(evenement.target.value);
      try {
        await api('/api/controle/vitesse', { corps: { vitesse } });
        toast(`Horloge réglée sur ${vitesse} minutes simulées par seconde.`, { type: 'succes', titre: 'Vitesse' });
        await rafraichirEtat();
      } catch (erreur) {
        toast(erreur.message, { type: 'erreur' });
      }
    }
  });

  document.getElementById('bouton-nav').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('ouvert');
    if (sidebar.classList.contains('ouvert')) {
      const voile = document.createElement('div');
      voile.className = 'voile-nav';
      voile.addEventListener('click', () => {
        sidebar.classList.remove('ouvert');
        voile.remove();
      });
      document.body.appendChild(voile);
    } else {
      document.querySelector('.voile-nav')?.remove();
    }
  });

  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape') {
      fermerModale();
      document.querySelector('.voile-nav')?.remove();
      document.getElementById('sidebar').classList.remove('ouvert');
    }
    if (evenement.target.matches('input, textarea, select')) return;
    if (evenement.key.toLowerCase() === 'a' && !evenement.metaKey && !evenement.ctrlKey) {
      document.querySelector('[data-transport="avancer"]')?.click();
    }
  });

  const media = window.matchMedia('(max-width: 900px)');
  const ajusterNav = () => {
    document.getElementById('bouton-nav').style.display = media.matches ? 'inline-flex' : 'none';
  };
  media.addEventListener('change', ajusterNav);
  ajusterNav();
}

async function ouvrirNotifications() {
  const donnees = await api('/api/notifications');
  const corps = donnees.notifications.length
    ? `<div class="liste">${donnees.notifications
        .map(
          (n) => `<div class="ligne-liste">
            <div class="ligne-principal">
              <div class="ligne-titre">${n.lu ? '' : '<span style="color:var(--encre)">● </span>'}${echapper(n.titre)}</div>
              <div class="ligne-sous" style="white-space:normal">${echapper(n.message)}</div>
            </div>
            <div class="ligne-droite">${badgeNotification(n.niveau)}<span class="tiny muet">${heureCourt(n.date_notif)}</span></div>
          </div>`,
        )
        .join('')}</div>`
    : '<div class="vide"><b>Aucune notification</b>Le moteur vous prévient ici en cas de rapport ou d’anomalie.</div>';
  const voile = modale({
    titre: 'Notifications du responsable',
    corps,
    pied: `<button class="btn btn-fantome" data-tout-lu>Tout marquer comme lu</button><button class="btn btn-primaire" data-fermer>Fermer</button>`,
    largeur: 620,
  });
  voile.querySelector('[data-tout-lu]').addEventListener('click', async () => {
    await api('/api/notifications/lues', { method: 'POST' });
    toast('Notifications marquées comme lues.', { type: 'succes' });
    await rafraichirEtat();
    fermerModale();
  });
}

const badgeNotification = (niveau) =>
  `<span class="badge ${niveau === 'Critique' ? 'rouge' : niveau === 'Avertissement' ? 'ambre' : 'bleu'}">${echapper(niveau)}</span>`;
const heureCourt = (iso) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
};

/* ─────────────────────────── SSE ─────────────────────────── */

let source = null;
function connecterFlux() {
  if (source) source.close();
  source = new EventSource('/api/stream');
  source.addEventListener('etat', (evenement) => {
    try {
      const precedent = ctx.etat;
      ctx.etat = JSON.parse(evenement.data);
      rendreTopbar();
      rendreNav();
      const racine = document.getElementById('vue');
      if (ctx.vue?.maj && racine && racine.dataset.pret === '1') {
        ctx.vue.maj(racine, ctx, precedent);
      }
    } catch (erreur) {
      console.warn('Flux invalide', erreur);
    }
  });
  source.onerror = () => {
    source.close();
    setTimeout(connecterFlux, 3000);
  };
}

/* ─────────────────────────── démarrage ─────────────────────────── */

async function initialiser() {
  brancherGlobal();
  await rafraichirEtat();
  connecterFlux();
  await rendre();
  setInterval(rafraichirEtat, 20000);
}

export { icone, actionSure, rafraichirEtat };
window.instava = { api, action, ctx, toast, confirmer };

initialiser();
