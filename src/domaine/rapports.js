import fs from 'node:fs';
import path from 'node:path';
import { executer, tous, un } from '../db.js';
import { config } from '../config.js';
import { uuid } from '../utils/ids.js';
import { formatDateFr } from '../utils/temps.js';
import { nombreFr, pourcentageFr } from '../utils/texte.js';
import { agregerPeriode, statistiquesDuJour } from './statistiques.js';
import { compteIdCourant, exigerCompte } from './contexte.js';
import { compteParId } from './compte.js';
import { statistiquesLiens } from './liens.js';
import { journaliser } from './journal.js';

/**
 * Rapports Markdown du compte, écrits à partir des seules données réellement
 * mesurées. Aucun chiffre n'est complété ni inventé : une journée sans données
 * produit un rapport à zéro, ce qui rend le problème visible.
 */

const mapper = (ligne) =>
  ligne
    ? {
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
      }
    : null;

export function listerRapports({ type, limite = 60 } = {}) {
  const params = [compteIdCourant() || ''];
  let filtre = '';
  if (type) {
    filtre = ' AND type = ?';
    params.push(type);
  }
  return tous(
    `SELECT * FROM rapport WHERE compte_id = ?${filtre} ORDER BY date DESC, genere_le DESC LIMIT ?`,
    ...params,
    Math.min(200, limite),
  ).map(mapper);
}

export function obtenirRapport(id) {
  return mapper(un('SELECT * FROM rapport WHERE id = ? AND compte_id = ?', id, compteIdCourant() || ''));
}

function blocPublications(publications) {
  if (!publications.length) return '_Aucune publication confirmée sur la période._';
  return publications
    .map(
      (p) =>
        `- **${p.type}** · ${p.jour} · ${p.statut}${p.lien ? ` · [voir sur Instagram](${p.lien})` : ''}${
          p.erreur ? ` · erreur : ${p.erreur}` : ''
        }`,
    )
    .join('\n');
}

function composer({ type, date, compte, agregat, publications, problemes, liens }) {
  const titre = {
    quotidien: 'Rapport quotidien',
    hebdomadaire: 'Rapport hebdomadaire',
    fin_cycle: 'Bilan de fin de cycle',
  }[type] || 'Rapport';

  return `# ${titre} — @${compte?.username || 'compte'} · ${formatDateFr(date)}

## 1. Synthèse

${nombreFr(agregat.publications)} publication(s) confirmée(s), ${nombreFr(agregat.interactions)} interaction(s) mesurée(s),
${nombreFr(agregat.portee)} de portée cumulée.

## 2. Indicateurs

| Indicateur | Valeur |
|---|---:|
| Portée | ${nombreFr(agregat.portee)} |
| Vues | ${nombreFr(agregat.vues)} |
| Likes | ${nombreFr(agregat.likes)} |
| Commentaires | ${nombreFr(agregat.commentaires)} |
| Interactions | ${nombreFr(agregat.interactions)} |
| Publications | ${nombreFr(agregat.publications)} |
| Clics sur le lien | ${nombreFr(liens.total)} |
| Taux d’engagement | ${pourcentageFr(agregat.engagement)} |

> Les valeurs proviennent des insights Instagram et des clics réellement
> enregistrés. Aucune estimation n’est ajoutée.

## 3. Publications

${blocPublications(publications)}

## 4. Problèmes détectés

${problemes.length ? problemes.map((p) => `- ${p}`).join('\n') : '_Aucun problème signalé sur la période._'}

## 5. Prochaines actions

- Vérifier que le dossier Drive contient assez de contenus pour les prochains jours.
- Répondre aux commentaires restés en attente (écran « Lien & commentaires »).
- Contrôler les éventuelles anomalies ouvertes (écran « Anomalies »).

---
_Rapport généré automatiquement par Insta-VA — ${new Date().toISOString()}._
`;
}

export function genererRapport({ type = 'quotidien', date, cycle = null, compte = null, silencieux = false }) {
  const compteId = exigerCompte();
  const compteCourant = compte || compteParId(compteId);
  const jour = date || new Date().toISOString().slice(0, 10);
  const agregat = agregerPeriode({ periode: type === 'quotidien' ? 'jour' : type === 'hebdomadaire' ? 'semaine' : 'mois' });
  const publications = tous(
    `SELECT * FROM publication WHERE compte_id = ? AND jour = ? ORDER BY date_heure`,
    compteId,
    jour,
  );
  const problemes = tous(
    `SELECT message FROM anomalie WHERE compte_id = ? AND statut != 'Resolue'`,
    compteId,
  ).map((a) => a.message);
  const liens = statistiquesLiens({ jours: type === 'quotidien' ? 1 : type === 'hebdomadaire' ? 7 : 30 });
  const id = uuid();
  const contenu = composer({ type, date: jour, compte: compteCourant, agregat, publications, problemes, liens });
  const genereLe = new Date().toISOString();
  executer(
    `INSERT INTO rapport (id, compte_id, cycle_id, type, date, contenu, statistiques, problemes, envoye, genere_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    compteId,
    cycle?.id ?? null,
    type,
    jour,
    contenu,
    JSON.stringify(agregat),
    JSON.stringify(problemes),
    genereLe,
  );
  const dossier = config.dossierRapportsCompte(compteId);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, `${type}-${jour}.md`), contenu);
  if (!silencieux) {
    journaliser(`Rapport ${type} généré pour le ${jour}.`, { categorie: 'rapport', jour });
  }
  return mapper(un('SELECT * FROM rapport WHERE id = ?', id));
}

export function genererRapportHebdomadaire({ date, compte, cycle }) {
  return genererRapport({ type: 'hebdomadaire', date, compte, cycle });
}

export function genererBilanFinCycle({ date, compte, cycle }) {
  return genererRapport({ type: 'fin_cycle', date, compte, cycle });
}

export async function envoyerRapport(id) {
  const rapport = obtenirRapport(id);
  if (!rapport) return null;
  if (!config.webhookRapport) {
    const erreur = new Error('Aucun webhook de transmission configuré (RAPPORT_WEBHOOK_URL).');
    erreur.statut = 400;
    throw erreur;
  }
  const reponse = await fetch(config.webhookRapport, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ titre: `Rapport ${rapport.type} · ${rapport.date}`, contenu: rapport.contenu }),
  });
  if (!reponse.ok) {
    const erreur = new Error(`Transmission refusée (${reponse.status}).`);
    erreur.statut = 502;
    throw erreur;
  }
  executer('UPDATE rapport SET envoye = 1 WHERE id = ?', id);
  journaliser(`Rapport ${rapport.type} transmis.`, { categorie: 'rapport' });
  return obtenirRapport(id);
}

export function exporterRapport(id) {
  const rapport = obtenirRapport(id);
  if (!rapport) return null;
  return { nom: `rapport-${rapport.type}-${rapport.date}.md`, contenu: rapport.contenu, type: 'text/markdown' };
}

export function statistiquesRapports() {
  const compteId = compteIdCourant() || '';
  const lignes = tous('SELECT type, COUNT(*) AS n FROM rapport WHERE compte_id = ? GROUP BY type', compteId);
  return {
    total: lignes.reduce((s, l) => s + l.n, 0),
    parType: Object.fromEntries(lignes.map((l) => [l.type, l.n])),
  };
}

export { statistiquesDuJour };
