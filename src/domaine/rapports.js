import fs from 'node:fs';
import path from 'node:path';
import { executer, tous, un } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { arrondi } from '../utils/alea.js';
import { formatDateFr, ajouterJours } from '../utils/temps.js';
import { nombreFr, pourcentageFr } from '../utils/texte.js';
import { OBJECTIF, PAYS_AUTORISES, LIBELLES_PAYS } from '../../public/shared/enums.js';
import { OBJECTIF_AUDIENCE } from '../donnees/personas.js';
import { journaliser, notifier } from './journal.js';
import { listerAnomalies } from './anomalies.js';
import { agregerPeriode, statistiquesDuJour, repartitionPays } from './statistiques.js';

function mapperRapport(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    compteId: ligne.compte_id,
    cycleId: ligne.cycle_id,
    type: ligne.type,
    date: ligne.date,
    contenu: ligne.contenu,
    statistiques: JSON.parse(ligne.statistiques || '{}'),
    problemes: JSON.parse(ligne.problemes || '[]'),
    envoye: Boolean(ligne.envoye),
    genereLe: ligne.genere_le,
  };
}

function blocPays(repartition) {
  if (!repartition.length) return '_Aucune interaction géolocalisée sur la période._';
  const lignes = repartition
    .map(
      (p) =>
        `| ${LIBELLES_PAYS[p.pays] || p.pays} | ${nombreFr(p.valeur)} | ${pourcentageFr(p.pourcentage)} | ${p.autorise ? '✅' : '⛔ hors zone'} |`,
    )
    .join('\n');
  return `| Pays | Interactions | Part | Autorisé |\n|---|---:|---:|:---:|\n${lignes}`;
}

function blocPublications(publications) {
  if (!publications.length) return '_Aucune publication ce jour._';
  return publications
    .map((p) => {
      const commentaires = `${nombreFr(p.commentaires)} commentaire${p.commentaires > 1 ? 's' : ''}`;
      return `- **${String(p.date_heure).slice(11, 16)}** · ${p.type} · ${nombreFr(p.likes)} likes · ${commentaires} · ${nombreFr(p.vues)} vues`;
    })
    .join('\n');
}

function recommandations(stats, { visionnageMin, anomalies }) {
  const liste = [];
  const engagement = stats.portee > 0 ? ((stats.likes + stats.commentaires) / stats.portee) * 100 : 0;
  if (engagement < OBJECTIF_AUDIENCE.tauxEngagementCible) {
    liste.push('Renforcer les accroches des 2 premières secondes (Reels) et poser une question dans chaque légende.');
  } else {
    liste.push('Capitaliser sur le format qui génère le plus de commentaires : le republier sous un autre angle.');
  }
  if (visionnageMin < 30) {
    liste.push(`Visionnage insuffisant (${visionnageMin} min / 30 min) : ajouter un bloc de visionnage en session 2.`);
  } else {
    liste.push('Visionnage conforme au minimum de 30 min par jour : conserver la répartition actuelle.');
  }
  if (anomalies.some((a) => a.severite === 'Critique')) {
    liste.push('Traiter en priorité les anomalies critiques avant d’augmenter le volume d’interactions.');
  }
  if (stats.interactions < 40) {
    liste.push('Volume d’interactions perfectible : cibler davantage de comptes qualifiés (score > 60).');
  }
  liste.push('Maintenir 12 à 25 % de comptes de référence parmi les suivis pour respecter la règle R6.');
  return liste;
}

function composerContenu({ type, date, compte, cycle, stats, problemes, recommandations: recos, publications, repartition, periodeLabel }) {
  const engagement = stats.portee > 0 ? arrondi(((stats.likes + stats.commentaires) / Math.max(1, stats.portee)) * 100, 2) : 0;
  const titre = {
    quotidien: 'Rapport quotidien',
    hebdomadaire: 'Rapport hebdomadaire',
    mensuel: 'Rapport mensuel',
    fin_cycle: 'Bilan de fin de cycle',
  }[type] || 'Rapport';
  const problemesTexte = problemes.length
    ? problemes
        .map((p) => `- ${p.severite === 'Critique' ? '🔴' : p.severite === 'Avertissement' ? '🟠' : '🔵'} **${p.type}** — ${p.message}`)
        .join('\n')
    : '_Aucun problème détecté sur la période._';

  const numeroCycle = cycle?.cycleNumero ?? cycle?.cycle_numero ?? 1;
  const numeroJour = cycle?.numeroJour ?? cycle?.numero_jour ?? '—';
  return `# ${titre} — ${formatDateFr(date, { weekday: 'long' })}

**Compte :** @${compte.username} · **Cycle ${numeroCycle} · Jour ${numeroJour}/${config.dureeCycleJours}**
**Période :** ${periodeLabel}
**Agent :** ${compte.avatar?.nom || 'Avatar IA'} · Mode : ${config.modeInstagram}

---

## 1. Résumé exécutif

${stats.publications} publication(s), ${nombreFr(stats.interactions)} interaction(s), +${nombreFr(stats.abonnesGagnes)} abonné(s).
Taux d’engagement : **${pourcentageFr(engagement)}** (objectif ${pourcentageFr(OBJECTIF_AUDIENCE.tauxEngagementCible)}).

## 2. Indicateurs clés

| Indicateur | Valeur | Cible |
|---|---:|---:|
| Portée | ${nombreFr(stats.portee)} | ${nombreFr(OBJECTIF_AUDIENCE.porteeCible / 30)} / jour |
| Vues | ${nombreFr(stats.vues)} | — |
| Likes | ${nombreFr(stats.likes)} | — |
| Commentaires | ${nombreFr(stats.commentaires)} | — |
| Interactions | ${nombreFr(stats.interactions)} | 48–92 / jour |
| Abonnés gagnés | ${nombreFr(stats.abonnesGagnes)} | ${OBJECTIF_AUDIENCE.abonnesCible} / 30 j |
| Publications | ${nombreFr(stats.publications)} | 4–5 / jour |

## 3. Publications

${blocPublications(publications)}

## 4. Audience et pays

${blocPays(repartition)}

> Les pays hors liste (USA, France, Royaume-Uni, Allemagne, Pologne + autres pays fournis) sont exclus du ciblage (R7).

## 5. Problèmes détectés

${problemesTexte}

## 6. Recommandations

${recos.map((r) => `- ${r}`).join('\n')}

## 7. Prochaines actions

- ${'Vérifier le Drive avant 16 h (contenus planifiés du jour).'}
- ${'Conserver la fenêtre 16 h → 00 h et les deux sessions (16–20 h / 20–00 h).'}
- ${'Relancer automatiquement le cycle à J+30 (même compte, même historique).'}

---

*Rapport généré automatiquement par Insta-VA — ${new Date().toLocaleString('fr-FR')}*
`;
}

/**
 * `genererRapport()` — produit le rapport, l'écrit sur disque et le stocke.
 */
export function genererRapport({ type = 'quotidien', date, cycle = null, compte, stats = null, problemes = null, silencieux = false }) {
  const statsJour = stats || statistiquesDuJour(date) || {
    vues: 0,
    portee: 0,
    abonnesGagnes: 0,
    likes: 0,
    commentaires: 0,
    interactions: 0,
    publications: 0,
    details: {},
  };
  const publications = tous(
    `SELECT * FROM publication WHERE jour = ? AND statut = 'Publiee' ORDER BY date_heure`,
    date,
  );
  const repartition =
    type === 'quotidien' && Array.isArray(statsJour.details?.parPays) && statsJour.details.parPays.length
      ? statsJour.details.parPays.map((p) => {
          const total = statsJour.details.parPays.reduce((s, x) => s + x.n, 0) || 1;
          return {
            pays: p.pays,
            valeur: p.n,
            pourcentage: arrondi((p.n / total) * 100, 1),
            autorise: PAYS_AUTORISES.includes(p.pays),
          };
        })
      : repartitionPays({ periode: type === 'hebdomadaire' ? 'semaine' : 'mois' });
  const anomalies = listerAnomalies({ limite: 30 }).filter((a) => (a.detectee_le || '').slice(0, 10) === date);
  const problemesFinaux = problemes || anomalies.map((a) => ({ type: a.type, severite: a.severite, message: a.message }));

  let contenuStats = statsJour;
  let periodeLabel = formatDateFr(date);
  if (type === 'hebdomadaire' || type === 'mensuel' || type === 'fin_cycle') {
    const periode = type === 'hebdomadaire' ? 'semaine' : 'mois';
    const agr = agregerPeriode({ periode, date });
    contenuStats = {
      ...statsJour,
      vues: agr.vues,
      portee: agr.portee,
      likes: agr.likes,
      commentaires: agr.commentaires,
      interactions: agr.interactions,
      publications: agr.publications,
      abonnesGagnes: agr.abonnesGagnes,
    };
    periodeLabel = `${formatDateFr(agr.debut)} → ${formatDateFr(agr.fin)}`;
  }

  const visionnageMin = Math.round((statsJour.details?.visionnageSecondes || 0) / 60);
  const recos = recommandations(contenuStats, { visionnageMin, anomalies });
  const contenu = composerContenu({
    type,
    date,
    compte,
    cycle,
    stats: contenuStats,
    problemes: problemesFinaux,
    recommandations: recos,
    publications,
    repartition,
    periodeLabel,
  });

  const id = uuid();
  const genereLe = new Date().toISOString();
  fs.mkdirSync(config.dossierRapports, { recursive: true });
  const nomFichier = `rapport-${type}-${date}.md`;
  fs.writeFileSync(path.join(config.dossierRapports, nomFichier), contenu, 'utf8');

  executer(`DELETE FROM rapport WHERE type = ? AND date = ?`, type, date);
  executer(
    `INSERT INTO rapport (id, compte_id, cycle_id, type, date, contenu, statistiques, problemes, envoye, genere_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    compte?.id ?? null,
    cycle?.id ?? null,
    type,
    date,
    contenu,
    JSON.stringify(contenuStats),
    JSON.stringify(problemesFinaux),
    genereLe,
  );
  journaliser(`Rapport ${type} généré (${date}).`, {
    categorie: 'rapport',
    jour: date,
    cycleId: cycle?.id,
    donnees: { fichier: nomFichier },
  });
  if (!silencieux) {
    notifier({
      type: 'rapport',
      titre: `Rapport ${type} disponible`,
      message: `Le rapport du ${formatDateFr(date)} est prêt (${contenuStats.publications} publications, ${nombreFr(contenuStats.interactions)} interactions).`,
      niveau: 'Info',
      lien: '/#/rapports',
    });
  }
  return mapperRapport(un('SELECT * FROM rapport WHERE id = ?', id));
}

export function genererRapportHebdomadaire({ date, compte, cycle }) {
  return genererRapport({ type: 'hebdomadaire', date, compte, cycle });
}

export function genererBilanFinCycle({ date, compte, cycle }) {
  return genererRapport({ type: 'fin_cycle', date, compte, cycle });
}

export function listerRapports({ type, limite = 60 } = {}) {
  const clause = type ? 'WHERE type = ?' : '';
  const params = type ? [type] : [];
  return tous(
    `SELECT id, compte_id, cycle_id, type, date, statistiques, problemes, envoye, genere_le
     FROM rapport ${clause} ORDER BY genere_le DESC LIMIT ?`,
    ...params,
    limite,
  ).map((l) => ({ ...mapperRapport({ ...l, contenu: '' }), extrait: '' }));
}

export function obtenirRapport(id) {
  return mapperRapport(un('SELECT * FROM rapport WHERE id = ?', id));
}

/** `envoyer()` — notification au responsable (webhook optionnel). */
export async function envoyerRapport(id) {
  const rapport = obtenirRapport(id);
  if (!rapport) return null;
  let statut = 'simule';
  let erreur = null;
  if (config.webhookRapport) {
    try {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), 6000);
      const reponse = await fetch(config.webhookRapport, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titre: `Rapport ${rapport.type} — ${rapport.date}`,
          contenu: rapport.contenu,
          statistiques: rapport.statistiques,
          problemes: rapport.problemes,
        }),
        signal: controleur.signal,
      });
      clearTimeout(minuteur);
      statut = reponse.ok ? 'envoye' : 'echec';
      if (!reponse.ok) erreur = `HTTP ${reponse.status}`;
    } catch (e) {
      statut = 'echec';
      erreur = e.message;
    }
  }
  executer('UPDATE rapport SET envoye = 1 WHERE id = ?', id);
  notifier({
    type: 'rapport',
    titre: 'Rapport transmis au responsable',
    message:
      statut === 'echec'
        ? `Le rapport du ${formatDateFr(rapport.date)} n’a pas pu être transmis (${erreur}). Il reste disponible dans l’application.`
        : `Le rapport du ${formatDateFr(rapport.date)} a été transmis au responsable.`,
    niveau: statut === 'echec' ? 'Avertissement' : 'Info',
    lien: '/#/rapports',
  });
  journaliser(`Rapport ${rapport.type} ${statut === 'echec' ? 'non transmis' : 'transmis'}${erreur ? ` : ${erreur}` : ''}.`, {
    categorie: 'rapport',
    niveau: statut === 'echec' ? 'alerte' : 'info',
  });
  return { ...obtenirRapport(id), transmission: { statut, erreur } };
}

export function cheminExport(rapport) {
  return path.join(config.dossierRapports, `rapport-${rapport.type}-${rapport.date}.md`);
}

export function exporterRapport(id) {
  const rapport = obtenirRapport(id);
  if (!rapport) return null;
  const chemin = cheminExport(rapport);
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, rapport.contenu || '', 'utf8');
  return { chemin, nom: path.basename(chemin) };
}

export function statistiquesRapports() {
  const total = un('SELECT COUNT(*) AS n FROM rapport')?.n ?? 0;
  const envoyes = un('SELECT COUNT(*) AS n FROM rapport WHERE envoye = 1')?.n ?? 0;
  return { total, envoyes, enAttente: total - envoyes };
}

export { PAYS_AUTORISES, OBJECTIF, formatDateFr };
