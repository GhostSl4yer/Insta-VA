import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.DATA_DIR = path.join(os.tmpdir(), `instava-integration-${process.pid}-${Date.now()}`);
process.env.AMORCAGE_JOURS = '0';
process.env.VITESSE_DEFAUT = '600';
process.env.PAUSE_INTERJOUR_MS = '20';

const base = path.resolve(import.meta.dirname, '..');
const { preparerDossiers } = await import(path.join(base, 'src/config.js'));
const { ouvrirBase, fermerBase, tous, un } = await import(path.join(base, 'src/db.js'));
const moteur = await import(path.join(base, 'src/domaine/moteur.js'));
const { genererRapport } = await import(path.join(base, 'src/domaine/rapports.js'));
const { comptePublic } = await import(path.join(base, 'src/domaine/compte.js'));

before(() => {
  preparerDossiers();
  ouvrirBase();
});

after(async () => {
  moteur.arreterMoteur();
  fermerBase();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('moteur : démarrage autonome, journée complète et clôture', async () => {
  await moteur.demarrerMoteur({ silencieux: true });
  assert.equal(moteur.etat.horloge, 'en_cours');
  assert.equal(moteur.etat.minuteJour, 960, 'la journée démarre à 16 h');
  assert.ok(moteur.etat.plan.length > 20, 'le plan de la journée est construit');
  assert.equal(moteur.etat.plan.filter((t) => t.type === 'session_debut').length, 2, 'deux sessions quotidiennes');
  assert.equal(moteur.etat.plan.filter((t) => t.type === 'session_fin').length, 2);

  const date = moteur.etat.dateJour;

  // Avance dans la première session
  await moteur.avancer(150);
  assert.ok(moteur.etat.minuteJour >= 1110);
  const publiees = un(`SELECT COUNT(*) AS n FROM publication WHERE jour = ? AND statut = 'Publiee'`, date)?.n ?? 0;
  assert.ok(publiees > 0, 'des publications ont été envoyées pendant la session');

  // Fin de journée
  await moteur.forcerFinJour();
  const cycle = un('SELECT * FROM cycle WHERE date_debut = ?', date);
  assert.equal(cycle.statut, 'Termine');
  assert.ok((un('SELECT COUNT(*) AS n FROM rapport WHERE date = ?', date)?.n ?? 0) >= 1, 'rapport généré');
  assert.ok((un('SELECT COUNT(*) AS n FROM statistiques WHERE date = ?', date)?.n ?? 0) >= 1, 'statistiques générées');
  assert.ok((moteur.etat.journee?.visionnage?.secondes ?? 0) >= 0);

  // Les deux sessions sont clôturées
  const sessions = tous('SELECT * FROM session_quotidienne WHERE date = ?', date);
  assert.equal(sessions.length, 2);
  for (const session of sessions) assert.equal(session.statut, 'Termine');

  assert.equal(moteur.etat.prochaineJournee.numeroJour, moteur.etat.numeroJour + 1);
});

test('moteur : aucune publication hors de la fenêtre 16 h → 00 h', () => {
  for (const publication of tous(`SELECT date_heure FROM publication WHERE statut = 'Publiee'`)) {
    const heure = publication.date_heure.slice(11, 16);
    assert.ok(heure >= '16:00' && heure <= '23:59', `publication à ${heure} – R8`);
  }
});

test('moteur : la pause et la reprise fonctionnent', async () => {
  moteur.mettreEnPause();
  assert.equal(moteur.etat.horloge, 'en_pause');
  const minute = moteur.etat.minuteJour;
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(moteur.etat.minuteJour, minute, 'l’horloge est figée pendant la pause');
  await moteur.reprendreMoteur();
  assert.equal(moteur.etat.horloge, 'en_cours');
  assert.equal(moteur.etat.pauseManuelle, false);
});

test('moteur : relance automatique du cycle au 30e jour', async () => {
  // On force la clôture d'une journée au jour 30 pour vérifier la relance (R10)
  moteur.arreterMoteur();
  moteur.etat.numeroJour = 30;
  moteur.etat.cycleNumero = 1;
  await moteur.forcerFinJour();
  assert.equal(moteur.etat.prochaineJournee.numeroJour, 1);
  assert.equal(moteur.etat.prochaineJournee.cycleNumero, 2);
  const notification = un(`SELECT * FROM notification WHERE type = 'cycle' ORDER BY date_notif DESC`);
  assert.ok(notification, 'le responsable est notifié de la relance');
});

test('moteur : vue publique complète pour l’interface', async () => {
  await moteur.demarrerMoteur({ silencieux: true });
  const etat = moteur.etatPublic();
  assert.ok(etat.horloge.heure.match(/^\d{2}:\d{2}$/));
  assert.equal(etat.programme.joursTotal, 30);
  assert.ok(etat.kpis.abonnes >= 0);
  assert.ok(Array.isArray(etat.execution) && etat.execution.length >= 7);
  assert.ok(etat.flux.length > 0);
  assert.ok(etat.audience.paysAutorises.includes('USA'));
  assert.ok(etat.plan.every((t) => t.heure.match(/^\d{2}:\d{2}$/)));
});

test('rapport de synthèse : génération sans erreur pour chaque type', () => {
  for (const type of ['quotidien', 'hebdomadaire', 'mensuel', 'fin_cycle']) {
    const rapport = genererRapport({
      type,
      date: moteur.etat.dateJour || '2026-10-21',
      cycle: moteur.etat.cycle,
      compte: comptePublic(),
      silencieux: true,
    });
    assert.ok(rapport.contenu.length > 400, `rapport ${type} non vide`);
  }
});
