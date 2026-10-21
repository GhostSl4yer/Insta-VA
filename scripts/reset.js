#!/usr/bin/env node
/**
 * Réinitialise les données locales d'Insta-VA.
 *
 *   npm run reset                 → remet le cycle à zéro, conserve le profil et l'historique
 *   npm run reset -- --effacer    → supprime toutes les données (base + Drive + rapports)
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config, preparerDossiers } from '../src/config.js';
import { ouvrirBase, fermerBase, executer, tous } from '../src/db.js';

const effacer = process.argv.includes('--effacer') || process.argv.includes('--hard');
const oui = process.argv.includes('--oui') || process.argv.includes('-y');

async function confirmer(question) {
  if (oui) return true;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const reponse = await rl.question(`${question} [o/N] `);
  rl.close();
  return ['o', 'oui', 'y', 'yes'].includes(reponse.trim().toLowerCase());
}

async function principal() {
  if (effacer) {
    const ok = await confirmer(
      `Supprimer définitivement ${config.dossierDonnees} (base, Drive, rapports) ?`,
    );
    if (!ok) {
      console.log('Annulé.');
      return;
    }
    fs.rmSync(config.dossierDonnees, { recursive: true, force: true });
    preparerDossiers();
    console.log('✔ Données supprimées. Le prochain démarrage régénérera un profil, un Drive et un historique.');
    return;
  }

  preparerDossiers();
  ouvrirBase();
  for (const table of [
    'publication',
    'interaction',
    'abonnement',
    'compte_suivi',
    'session_quotidienne',
    'statistiques',
    'rapport',
    'execution',
    'anomalie',
    'notification',
    'veille',
    'cycle',
  ]) {
    executer(`DELETE FROM ${table}`);
  }
  executer(`UPDATE compte_instagram SET cycle_actuel = 0, date_fin_cycle = NULL, jours_cycle = '{}'`);
  executer(`UPDATE contenu_drive SET statut = 'Planifie', date_publication = NULL WHERE statut = 'Publie'`);
  executer(`DELETE FROM meta WHERE cle IN ('amorcageFait', 'moteur.actif')`);
  const restants = tous('SELECT COUNT(*) AS n FROM publication')[0]?.n ?? 0;
  fermerBase();
  console.log(`✔ Cycle réinitialisé (${restants} publication restante). Le profil, l’audience et le Drive sont conservés.`);
  console.log('  Astuce : `npm run reset -- --effacer` pour repartir de zéro.');
}

principal().catch((erreur) => {
  console.error('Échec de la réinitialisation :', erreur.message);
  process.exit(1);
});
