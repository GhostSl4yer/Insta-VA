import { config, preparerDossiers } from './config.js';
import { ouvrirBase, fermerBase, lireMeta } from './db.js';
import { creerServeur } from './http/serveur.js';
import { demarrerMoteur } from './domaine/moteur.js';
import { journaliser } from './domaine/journal.js';

const BANNIERE = `
  ██╗███╗   ██╗███████╗████████╗ █████╗     ██╗   ██╗ █████╗
  ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗    ██║   ██║██╔══██╗
  ██║██╔██╗ ██║███████╗   ██║   ███████║    ██║   ██║███████║
  ██║██║╚██╗██║╚════██║   ██║   ██╔══██║    ╚██╗ ██╔╝██╔══██║
  ██║██║ ╚████║███████║   ██║   ██║  ██║     ╚████╔╝ ██║  ██║
  ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝      ╚═══╝  ╚═╝  ╚═╝
`;

async function principal() {
  preparerDossiers();
  ouvrirBase();

  console.log(BANNIERE);
  console.log(`  Avatar IA · compte @maya.rivera.fit · mode ${config.modeInstagram}`);
  console.log(`  Données : ${config.dossierDonnees}`);
  console.log(`  Cycle : ${config.heureDebut} → ${config.heureFin} · ${config.dureeCycleJours} jours · vitesse ${config.vitesseDefaut} min/s\n`);

  const doitDemarrer = lireMeta('moteur.actif', true) !== false;
  if (doitDemarrer) {
    try {
      await demarrerMoteur();
      console.log('  ✔ Moteur autonome démarré (cycle quotidien en cours).');
    } catch (erreur) {
      console.error('  ✖ Impossible de démarrer le moteur :', erreur.message);
      journaliser(`Échec du démarrage automatique : ${erreur.message}`, { niveau: 'erreur', categorie: 'systeme' });
    }
  } else {
    console.log('  ⏸ Moteur en pause (arrêté manuellement lors de la dernière session).');
  }

  const serveur = creerServeur();
  serveur.listen(config.port, config.hote, () => {
    console.log(`  ▶ Interface : http://${config.hote === '0.0.0.0' ? 'localhost' : config.hote}:${config.port}`);
    console.log('  ▶ SSE       : /api/stream\n');
  });

  const arreter = (signal) => {
    console.log(`\n[insta-va] Arrêt (${signal})…`);
    serveur.close(() => {
      fermerBase();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2500).unref();
  };
  process.on('SIGINT', () => arreter('SIGINT'));
  process.on('SIGTERM', () => arreter('SIGTERM'));
}

principal().catch((erreur) => {
  console.error('[insta-va] Démarrage impossible :', erreur);
  process.exit(1);
});
