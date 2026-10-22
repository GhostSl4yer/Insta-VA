import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.DATA_DIR = path.join(os.tmpdir(), `instava-capacites-${process.pid}-${Date.now()}`);
process.env.AMORCAGE_JOURS = '0';

const base = path.resolve(import.meta.dirname, '..');
const { preparerDossiers } = await import(path.join(base, 'src/config.js'));
const { ouvrirBase, fermerBase, un, executer } = await import(path.join(base, 'src/db.js'));
const { config } = await import(path.join(base, 'src/config.js'));
const { dateDansFuseau, ajouterJours } = await import(path.join(base, 'src/utils/temps.js'));
const moteur = await import(path.join(base, 'src/domaine/moteur.js'));
const liens = await import(path.join(base, 'src/domaine/liens.js'));
const { choisirReponse, langueDe, intentionDe } = await import(path.join(base, 'src/donnees/reponses.js'));
const commentaires = await import(path.join(base, 'src/domaine/commentaires.js'));

before(() => {
  preparerDossiers();
  ouvrirBase();
});

after(() => {
  fermerBase();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

/* ───────────── lien externe : clics ───────────── */

test('lien : création, validation et code unique', () => {
  assert.throws(() => liens.creerLien({ url: 'javascript:alert(1)' }), /commencer par http/);
  const a = liens.creerLien({ url: 'https://tavia.app/avatar/awa', libelle: 'Bio' });
  const b = liens.creerLien({ url: 'https://tavia.app/promo', libelle: 'Story' });
  assert.match(a.code, /^[a-z2-9]{7}$/);
  assert.notEqual(a.code, b.code, 'deux liens ont deux codes distincts');
  assert.equal(a.urlPublique.startsWith('/l/'), true);
});

test('lien : les clics sont comptés par jour et par pays', () => {
  const lien = liens.creerLien({ url: 'https://tavia.app/avatar/awa' });
  assert.equal(liens.clicsDuJour('2026-10-20'), 0);
  liens.enregistrerClic({ code: lien.code, pays: 'USA', date: '2026-10-20' });
  liens.enregistrerClic({ code: lien.code, pays: 'USA', date: '2026-10-20' });
  liens.enregistrerClic({ code: lien.code, pays: 'France', date: '2026-10-21' });
  assert.equal(liens.clicsDuJour('2026-10-20'), 2);
  assert.equal(liens.clicsDuJour('2026-10-21'), 1);
  const stats = liens.statistiquesLiens({ jours: 30 });
  assert.ok(stats.total >= 3);
  assert.ok(stats.parPays.some((p) => p.pays === 'USA'));
});

test('lien : un clic sur un code inconnu ne crée rien', () => {
  const avant = liens.statistiquesLiens({ jours: 30 }).total;
  assert.equal(liens.enregistrerClic({ code: 'inexistant' }), null);
  assert.equal(liens.statistiquesLiens({ jours: 30 }).total, avant);
});

test('lien : désactivation — plus de clic compté', () => {
  const lien = liens.creerLien({ url: 'https://exemple.test/x' });
  liens.desactiverLien(lien.id);
  assert.equal(liens.enregistrerClic({ code: lien.code }), null);
});

/* ───────────── réponses aux commentaires ───────────── */

test('réponses : langue et intention détectées', () => {
  assert.equal(langueDe('Merci beaucoup, c’est génial !'), 'fr');
  assert.equal(langueDe('Amazing work, thanks!'), 'en');
  assert.equal(intentionDe('Quel est le prix ?'), 'question');
  assert.equal(intentionDe('Merci pour ce partage'), 'remerciement');
  assert.equal(intentionDe('Super contenu'), 'compliment');
  assert.equal(intentionDe('Bonjour'), 'neutre');
});

test('réponses : choix déterministe et dans la bonne langue', () => {
  const a = choisirReponse('Magnifique !', { graine: 42 });
  const b = choisirReponse('Magnifique !', { graine: 42 });
  assert.equal(a.texte, b.texte, 'même commentaire → même réponse');
  assert.equal(a.langue, 'fr');
  const c = choisirReponse('How do I start?', { graine: 7 });
  assert.equal(c.langue, 'en');
  assert.equal(c.intention, 'question');
});

test('réponses : un commentaire n’est enregistré qu’une fois', () => {
  const premier = commentaires.enregistrerCommentaire({
    mediaId: 'media-1',
    commentaireId: 'comment-1',
    auteur: 'awa',
    texte: 'Super !',
  });
  const second = commentaires.enregistrerCommentaire({
    mediaId: 'media-1',
    commentaireId: 'comment-1',
    auteur: 'awa',
    texte: 'Super !',
  });
  assert.equal(premier.id, second.id);
  assert.equal(un(`SELECT COUNT(*) AS n FROM reponse_commentaire WHERE commentaire_id = 'comment-1'`).n, 1);
  assert.equal(premier.statut, 'ARepondre');
});

test('réponses : statistiques cohérentes', () => {
  const stats = commentaires.statistiquesReponses();
  assert.ok(stats.total >= 1);
  assert.equal(stats.repondues, 0);
  assert.equal(stats.taux, 0);
});

/* ───────────── Drive non configuré ───────────── */

test('drive : sans configuration, la synchronisation est inerte', async () => {
  const { synchroniserDrive, archiverSurDrive } = await import(path.join(base, 'src/domaine/drive.js'));
  const resultat = await synchroniserDrive();
  assert.equal(resultat.actif, false);
  assert.equal(resultat.total, 0);
  assert.deepEqual(resultat.erreurs, []);
  assert.deepEqual(await archiverSurDrive('inconnu'), { deplace: false });
});

/* ───────────── reprise après arrêt ───────────── */

test('reprise : une journée manquée n’est pas rejouée', async () => {
  const hier = ajouterJours(dateDansFuseau(config.fuseau), -1);
  executer(
    `INSERT INTO cycle (id, compte_id, numero_jour, cycle_numero, date_debut, date_fin, statut, heure_debut, heure_fin)
     VALUES ('c-interrompu', 'compte-test', 5, 1, ?, '2026-12-31', 'EnCours', '16:00', '00:00')`,
    hier,
  );

  await moteur.demarrerMoteur({ silencieux: true });

  const ancien = un(`SELECT * FROM cycle WHERE id = 'c-interrompu'`);
  assert.equal(ancien.statut, 'Interrompu', 'la journée manquée est clôturée, pas rejouée');
  assert.ok(ancien.termine_le, 'la clôture est horodatée');
  assert.equal(moteur.etat.numeroJour, 6, 'le compteur avance au lieu de rejouer la journée');
  assert.notEqual(moteur.etat.dateJour, hier, 'on repart sur la journée du jour');
  assert.ok(
    un(`SELECT COUNT(*) AS n FROM notification WHERE titre LIKE '%interruption%'`).n >= 1,
    'le responsable est prévenu',
  );
});

test('reprise : le premier cycle démarre au jour 2 (jour 1 = configuration)', async () => {
  executer('DELETE FROM cycle');
  executer('DELETE FROM publication');
  moteur.arreterMoteur();
  await moteur.demarrerMoteur({ silencieux: true });
  assert.equal(config.jourConfiguration, 1);
  assert.equal(moteur.etat.numeroJour, 2, 'la configuration manuelle occupe le jour 1');
  moteur.arreterMoteur();
});
