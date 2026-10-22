import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Environnement de production isolé : aucune donnée de démonstration ne doit apparaître.
process.env.DATA_DIR = path.join(os.tmpdir(), `instava-prod-${process.pid}-${Date.now()}`);
process.env.APP_ENV = 'production';
process.env.INSTAVA_MOT_DE_PASSE = 'mot-de-passe-de-test';
process.env.AMORCAGE_JOURS = '6';

const base = path.resolve(import.meta.dirname, '..');
const { config, preparerDossiers } = await import(path.join(base, 'src/config.js'));
const { ouvrirBase, fermerBase, un } = await import(path.join(base, 'src/db.js'));
const { assurerCompte } = await import(path.join(base, 'src/domaine/compte.js'));
const { assurerCibles } = await import(path.join(base, 'src/domaine/cibles.js'));
const { assurerParametres, configurerParametres } = await import(path.join(base, 'src/domaine/audience.js'));
const { assurerPhotoProfil, ajouterContenu, attribuerJourPrevu } = await import(path.join(base, 'src/domaine/drive.js'));
const {
  etatConfiguration,
  enregistrerCompte,
  enregistrerAgent,
  enregistrerIdentifiantsGraph,
  finaliserConfiguration,
  identifiantsGraph,
} = await import(path.join(base, 'src/domaine/configuration.js'));
const moteur = await import(path.join(base, 'src/domaine/moteur.js'));
const { verifierMotDePasse, creerJeton, jetonValide } = await import(path.join(base, 'src/http/auth.js'));
const { dateDansFuseau } = await import(path.join(base, 'src/utils/temps.js'));

const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

before(() => {
  preparerDossiers();
  ouvrirBase();
});

after(() => {
  moteur.arreterMoteur();
  fermerBase();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('production : le drapeau est actif et l’amorçage est neutralisé', () => {
  assert.equal(config.production, true);
  assert.equal(config.amorcageJours, 0, 'aucun historique fabriqué, même si AMORCAGE_JOURS=6');
  assert.equal(config.interactionsActives, false, 'interactions désactivées par défaut');
  assert.equal(config.modeInstagram, 'graph', 'le mode réel est le défaut en production');
});

test('production : aucun compte, agent, paramètre ni cible de démonstration', () => {
  assert.equal(assurerCompte(), null, 'aucun compte inventé');
  assert.equal(un('SELECT COUNT(*) AS n FROM compte_instagram').n, 0);
  assert.equal(un('SELECT COUNT(*) AS n FROM agent').n, 0);
  assert.equal(assurerCibles(), 0);
  assert.equal(un('SELECT COUNT(*) AS n FROM cible').n, 0);
  const audience = assurerParametres();
  assert.equal(audience.id, null, 'les paramètres par défaut ne sont pas persistés');
  assert.equal(un('SELECT COUNT(*) AS n FROM parametres_audience').n, 0);
});

test('production : le moteur refuse de démarrer sans données fournies', async () => {
  const etat = await moteur.demarrerMoteur({ silencieux: true });
  assert.equal(etat.horloge.etat, 'arrete');
  assert.equal(un('SELECT COUNT(*) AS n FROM cycle').n, 0, 'aucun cycle ouvert');
  assert.equal(un('SELECT COUNT(*) AS n FROM publication').n, 0, 'aucune publication inventée');
  const configuration = etatConfiguration();
  assert.equal(configuration.complete, false);
  assert.ok(configuration.manquants.includes('compte'));
  assert.ok(configuration.manquants.includes('identifiants'));
});

test('production : les données fournies complètent la configuration', () => {
  enregistrerAgent({ prenom: 'Awa', nom: 'Dossou', email: 'awa@exemple.test' });
  enregistrerCompte({
    username: 'awa.studio',
    nomComplet: 'Awa Studio',
    bio: 'Studio créatif.',
    localisation: 'Cotonou, Bénin',
    lienBio: 'https://exemple.test/awa',
  });
  assert.equal(un('SELECT COUNT(*) AS n FROM compte_instagram').n, 1);
  assert.equal(un('SELECT username FROM compte_instagram').username, 'awa.studio');

  assert.throws(() => finaliserConfiguration(), /Configuration incomplète/);

  enregistrerIdentifiantsGraph({ userId: '17841400000000000', token: 'jeton-de-test-1234567890' });
  assert.equal(identifiantsGraph().configure, true);
  assert.equal(identifiantsGraph().source, 'console');
  const brut = un(`SELECT valeur FROM meta WHERE cle = 'graph.token'`).valeur;
  assert.ok(!brut.includes('jeton-de-test'), 'le jeton est chiffré sur disque');

  configurerParametres({ ageMinimum: 25, paysAutorises: ['USA', 'France'], genre: 'NonPrecise' });
  assert.equal(un('SELECT COUNT(*) AS n FROM parametres_audience').n, 1);

  ajouterContenu({ nomFichier: 'story.png', mime: 'image/png', donneesBase64: PNG_1x1, type: 'Story' });
  assert.equal(un('SELECT COUNT(*) AS n FROM contenu_drive').n, 1);

  const configuration = finaliserConfiguration();
  assert.equal(configuration.complete, true);
  assert.equal(un('SELECT configuration_ok FROM compte_instagram').configuration_ok, 1);
});

test('production : la photo de profil n’est jamais générée', () => {
  const compte = un('SELECT * FROM compte_instagram');
  assert.equal(assurerPhotoProfil({ username: compte.username, avatar: {} }), null);
  assert.equal(un(`SELECT COUNT(*) AS n FROM contenu_drive WHERE type = 'PhotoProfil'`).n, 0);
});

test('production : contenus fournis planifiés, aucune interaction', async () => {
  const date = dateDansFuseau(config.fuseau);
  attribuerJourPrevu(date);
  const assigne = un(`SELECT jour_prevu FROM contenu_drive LIMIT 1`);
  assert.ok(assigne.jour_prevu, 'le contenu fourni reçoit une journée');

  const etat = await moteur.demarrerMoteur({ silencieux: true });
  assert.equal(etat.horloge.etat, 'en_cours');
  assert.equal(etat.plan.filter((t) => t.type === 'interactions').length, 0, 'aucun lot d’interactions');
  assert.equal(etat.journee.publications.length, 1, 'la story fournie est planifiée');
  assert.equal(etat.interactionsActives, false);
});

test('authentification : mot de passe et session signée', () => {
  assert.equal(verifierMotDePasse('mot-de-passe-de-test'), true);
  assert.equal(verifierMotDePasse('mauvais'), false);
  const jeton = creerJeton(60_000);
  assert.equal(jetonValide(jeton), true);
  const [version, expiration, signature] = jeton.split('.');
  assert.equal(jetonValide(`${version}.${Number(expiration) + 60_000}.${signature}`), false, 'signature invalide');
  assert.equal(jetonValide(creerJeton(-1000)), false, 'jeton expiré');
});
