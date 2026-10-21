import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.DATA_DIR = path.join(os.tmpdir(), `instava-test-${process.pid}-${Date.now()}`);
process.env.AMORCAGE_JOURS = '0';
process.env.VITESSE_DEFAUT = '240';

const base = path.resolve(import.meta.dirname, '..');
const { config, preparerDossiers } = await import(path.join(base, 'src/config.js'));
const { ouvrirBase, fermerBase, un } = await import(path.join(base, 'src/db.js'));
const temps = await import(path.join(base, 'src/utils/temps.js'));
const { assurerCompte, comptePublic, configurerManuellement, compteCourant } = await import(path.join(base, 'src/domaine/compte.js'));
const { assurerAgent } = await import(path.join(base, 'src/domaine/agent.js'));
const { assurerParametres, obtenirParametres, configurerParametres, verifierDisponibilite } = await import(path.join(base, 'src/domaine/audience.js'));
const { assurerCibles, genererCibles, analyserToutesCibles, choisirCiblesDuJour, listerCibles } = await import(path.join(base, 'src/domaine/cibles.js'));
const { plannifierJournee, contenusDuJour, listerContenus, synchroniser } = await import(path.join(base, 'src/domaine/drive.js'));
const { planifierPublicationsDuJour, publierPublication, verifierStatut, listerPublications } = await import(path.join(base, 'src/domaine/publications.js'));
const { executerLotInteractions, verifierLimites, listerInteractions, statistiquesInteractions } = await import(path.join(base, 'src/domaine/interactions.js'));
const { calculerStatistiquesJour, statistiquesDuJour } = await import(path.join(base, 'src/domaine/statistiques.js'));
const { genererRapport, obtenirRapport, exporterRapport } = await import(path.join(base, 'src/domaine/rapports.js'));
const { chiffrer, dechiffrer } = await import(path.join(base, 'src/domaine/chiffrement.js'));

let compte;
let cycle;

before(async () => {
  preparerDossiers();
  ouvrirBase();
  assurerAgent();
  compte = assurerCompte();
  assurerParametres({ compteId: compte.id });
  await assurerCibles();
  plannifierJournee({ cycleId: 'cycle-test', compte, date: '2026-10-21', numeroJour: 1 });
  const publications = planifierPublicationsDuJour({ cycle: { id: 'cycle-test' }, date: '2026-10-21', compte });
  cycle = { id: 'cycle-test', publications };
});

after(() => {
  fermerBase();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('temps : conversions et arithmétique de dates', () => {
  assert.equal(temps.minutesVersHHMM(1005), '16:45');
  assert.equal(temps.minutesVersHHMM(1440), '00:00');
  assert.equal(temps.hhmmVersMinutes('16:00'), 960);
  assert.equal(temps.ajouterJours('2026-10-31', 1), '2026-11-01');
  assert.equal(temps.ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.equal(temps.isoNaif('2026-10-21', 1020), '2026-10-21T17:00:00');
});

test('chiffrement : aller-retour AES-256-GCM', () => {
  const chiffre = chiffrer('mot-de-passe-test');
  assert.match(chiffre, /^v1:/);
  assert.equal(dechiffrer(chiffre), 'mot-de-passe-test');
  assert.notEqual(chiffre, 'mot-de-passe-test');
});

test('compte : configuration conforme au diagramme', () => {
  assert.equal(compte.ageMinimum, 25);
  assert.equal(compte.configurationOk, true);
  const maj = configurerManuellement({ username: 'Maya.Test', bio: 'Bio de test', ageMinimum: 12 });
  assert.equal(maj.username, 'maya.test', "le pseudo est normalisé");
  assert.equal(maj.ageMinimum, 25, "l'âge minimum ne peut pas passer sous 25 ans (R9)");
  assert.equal(compteCourant().bio, 'Bio de test');
});

test('audience : filtrage pays et âge', () => {
  const parametres = obtenirParametres();
  assert.deepEqual(parametres.paysAutorises.sort(), ['Allemagne', 'AutresPays', 'France', 'Pologne', 'RoyaumeUni', 'USA'].sort());

  const mineur = verifierDisponibilite({ age: 19, pays: 'USA' }, parametres);
  assert.equal(mineur.disponible, false);
  assert.match(mineur.raisons.join(' '), /Âge/);

  const horsZone = verifierDisponibilite({ age: 30, pays: 'Brésil' }, parametres);
  assert.equal(horsZone.disponible, false);
  assert.match(horsZone.raisons.join(' '), /hors zone/);

  const ok = verifierDisponibilite({ age: 31, pays: 'France' }, parametres);
  assert.equal(ok.disponible, true);

  const misAJour = configurerParametres({ paysAutorises: ['USA', 'France'], ageMinimum: 30 });
  assert.deepEqual(misAJour.paysAutorises.sort(), ['France', 'USA']);
  assert.equal(misAJour.ageMinimum, 30);
  // On rétablit le périmètre complet pour la suite
  configurerParametres({ paysAutorises: ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'], ageMinimum: 25 });
});

test('cibles : génération, scoring et sélection', () => {
  const nouvelles = genererCibles({ nombre: 30, graine: 42 });
  assert.ok(nouvelles.length > 0, 'des cibles sont générées');
  analyserToutesCibles();
  const qualifies = listerCibles({ statut: 'Qualifie', limite: 100 });
  assert.ok(qualifies.length > 0, 'des cibles sont qualifiées');
  for (const cible of qualifies) {
    assert.ok(cible.age >= 25, 'aucune cible qualifiée de moins de 25 ans');
    assert.ok(['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].includes(cible.pays));
  }
  const choisies = choisirCiblesDuJour(4);
  assert.ok(choisies.length <= 4);
  for (const cible of choisies) {
    assert.equal(cible.statut, 'Qualifie');
  }
});

test('drive : génération des contenus du jour', () => {
  const contenus = contenusDuJour('2026-10-21');
  assert.ok(contenus.length >= 4, `au moins 4 contenus (reçu ${contenus.length})`);
  const types = new Set(contenus.map((c) => c.type));
  assert.ok(types.has('Reel') && types.has('Story'));
  for (const contenu of contenus) {
    assert.ok(fs.existsSync(contenu.cheminFichier), `fichier présent : ${contenu.cheminPublic}`);
    assert.ok(contenu.image.startsWith('/media/'), 'URL média exposée');
  }
  // Idempotence
  const avant = listerContenus({ limite: 500 }).length;
  plannifierJournee({ cycleId: 'cycle-test', compte, date: '2026-10-21', numeroJour: 1 });
  assert.equal(listerContenus({ limite: 500 }).length, avant);
  const sync = synchroniser();
  assert.ok(sync.total >= avant);
});

test('publications : planification dans la fenêtre 16 h → 00 h', () => {
  assert.ok(cycle.publications.length > 0);
  const publications = listerPublications({ jour: '2026-10-21' });
  assert.ok(publications.length > 0);
  for (const publication of publications) {
    const heure = publication.dateHeure.slice(11, 16);
    assert.ok(heure >= '16:00' && heure <= '23:59', `publication à ${heure} dans la fenêtre (R2/R8)`);
  }
});

test('publications : publication puis vérification du statut', async () => {
  const publication = listerPublications({ jour: '2026-10-21', statut: 'Planifiee' })[0];
  assert.ok(publication, 'une publication planifiée existe');
  const publiee = await publierPublication(publication.id);
  assert.equal(publiee.statut, 'Publiee');
  assert.match(publiee.lien, /instagram\.com/);
  const statut = verifierStatut(publication.id);
  assert.equal(statut.publiee, true);
});

test('interactions : règles R2/R4/R7/R9', () => {
  const horsFenetre = verifierLimites({ type: 'Like', minute: 600, date: '2026-10-21' });
  assert.equal(horsFenetre.autorise, false);
  assert.match(horsFenetre.raison, /16 h/);
  const messagePrive = verifierLimites({ type: 'MessagePrive', minute: 1020, date: '2026-10-21' });
  assert.equal(messagePrive.autorise, false);
  const autorise = verifierLimites({ type: 'Like', minute: 1020, date: '2026-10-21' });
  assert.equal(autorise.autorise, true);

  for (let i = 0; i < 5; i += 1) {
    executerLotInteractions({
      date: '2026-10-21',
      minute: 1000 + i * 12,
      cycleId: 'cycle-test',
      sessionId: null,
      compte: comptePublic(),
      volume: 6,
      graine: 100 + i,
    });
  }
  const interactions = listerInteractions({ date: '2026-10-21', limite: 500 });
  assert.ok(interactions.length > 0);
  const types = new Set(interactions.map((i) => i.type));
  assert.equal(types.has('MessagePrive'), false, 'aucun message privé (R4)');
  for (const interaction of interactions) {
    if (!interaction.pays) continue;
    assert.ok(
      ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].includes(interaction.pays),
      `pays autorisé uniquement (${interaction.pays})`,
    );
    if (interaction.age) assert.ok(interaction.age >= 25, 'aucune interaction avec un compte de moins de 25 ans');
  }
  const stats = statistiquesInteractions({ date: '2026-10-21' });
  assert.ok(stats.total > 0);
});

test('statistiques : agrégation de la journée', () => {
  const stats = calculerStatistiquesJour({
    cycle: { id: 'cycle-test' },
    date: '2026-10-21',
    compte: comptePublic(),
    visionnageSecondes: 1900,
  });
  assert.equal(stats.date, '2026-10-21');
  assert.ok(stats.publications >= 1);
  assert.ok(stats.vues >= 0);
  assert.equal(stats.details.visionnageMin, 32);
  assert.ok(stats.abonnesGagnes > 0);
  assert.equal(statistiquesDuJour('2026-10-21').id, stats.id);
});

test('rapports : génération, contenu et export', () => {
  const rapport = genererRapport({
    type: 'quotidien',
    date: '2026-10-21',
    cycle: { id: 'cycle-test', cycle_numero: 1, numero_jour: 1 },
    compte: comptePublic(),
  });
  assert.match(rapport.contenu, /Rapport quotidien/);
  assert.match(rapport.contenu, /Recommandations/);
  assert.match(rapport.contenu, /USA/);
  assert.ok(rapport.statistiques.publications >= 1);
  const exporte = exporterRapport(rapport.id);
  assert.ok(fs.existsSync(exporte.chemin));
  assert.match(fs.readFileSync(exporte.chemin, 'utf8'), /Rapport quotidien/);
  assert.ok(obtenirRapport(rapport.id).contenu.length > 500);
});

test('base : aucune donnée de configuration n’est perdue', () => {
  assert.equal(un('SELECT COUNT(*) AS n FROM compte_instagram')?.n, 1);
  assert.ok((un('SELECT COUNT(*) AS n FROM parametres_audience')?.n ?? 0) >= 1);
  assert.ok((un('SELECT COUNT(*) AS n FROM journal_evenement')?.n ?? 0) > 0);
});
