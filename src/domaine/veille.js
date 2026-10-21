import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { creerAlea } from '../utils/alea.js';
import { jourSemaine } from '../utils/temps.js';
import { PAYS_AUTORISES } from '../../public/shared/enums.js';

const CATALOGUE = [
  {
    type: 'Format',
    source: 'Instagram Explore (simulation)',
    titre: 'Reels de 12 à 20 s : hook + résultat immédiat',
    contenu: 'Les Reels courts avec une transformation visible dès la 2e seconde génèrent 2,3× plus de partages.',
    tendances: ['#transformation', '#beforeafter', '#shortform'],
  },
  {
    type: 'Audio',
    source: 'Reels audio trend (simulation)',
    titre: '« Golden Hour Drive » — Neon Palm',
    contenu: 'Audio en forte progression sur les contenus fitness lifestyle aux États-Unis et au Royaume-Uni (+38 %).',
    tendances: ['#goldenhour', '#sunsetworkout'],
  },
  {
    type: 'Sujet',
    source: 'Veille éditoriale (simulation)',
    titre: 'Protéines végétales : forte demande en France et en Allemagne',
    contenu: 'Recherches en hausse sur les assiettes riches en protéines sans viande, avec une attente de recettes rapides.',
    tendances: ['#proteinesvegetales', '#plantprotein'],
  },
  {
    type: 'Compte',
    source: 'Benchmark interne',
    titre: 'Les carrousels « 3 erreurs / 3 solutions » performent',
    contenu: 'Trois comptes de référence de la niche obtiennent leur meilleur engagement avec ce format.',
    tendances: ['#3erreurs', '#coachadvice'],
  },
  {
    type: 'Sujet',
    source: 'Veille IA (simulation)',
    titre: 'Avatars IA : transparence et coulisses très demandées',
    contenu: 'Les audiences réagissent positivement aux contenus qui expliquent comment un avatar IA est utilisé.',
    tendances: ['#avatarIA', '#behindtheai', '#digitaltwin'],
  },
  {
    type: 'Audio',
    source: 'Reels audio trend (simulation)',
    titre: '« Run It Back » — KOLA (afro house)',
    contenu: 'Audio montant sur les contenus running et cardio en Pologne et en Allemagne.',
    tendances: ['#afrohouse', '#runtok'],
  },
  {
    type: 'Format',
    source: 'Instagram Explore (simulation)',
    titre: 'Stories « sondage » : +22 % de réponses',
    contenu: 'Les stories avec un sondage binaire obtiennent nettement plus de réponses que les stories simples.',
    tendances: ['#storypoll', '#engagement'],
  },
  {
    type: 'Sujet',
    source: 'Veille éditoriale (simulation)',
    titre: 'Sommeil et récupération : sujet porteur chez les 30–44 ans',
    contenu: 'Le contenu « routine du soir » gagne en portée sur les audiences actives de 30 à 44 ans.',
    tendances: ['#sleeproutine', '#recovery'],
  },
];

/** Collecte la veille du jour (idempotent, 100 % local en simulation). */
export function collecterVeille({ date } = {}) {
  const jour = date || new Date().toISOString().slice(0, 10);
  const existant = un('SELECT COUNT(*) AS n FROM veille WHERE substr(date_collecte, 1, 10) = ?', jour)?.n ?? 0;
  if (existant > 0) return { crees: 0, existants: existant };
  const alea = creerAlea(Number(jour.replace(/-/g, '')) % 2147483647);
  const jourSem = jourSemaine(jour);
  const nombre = jourSem === 1 || jourSem === 4 ? 4 : 2;
  const indices = new Set();
  while (indices.size < nombre) indices.add(alea.entier(0, CATALOGUE.length - 1));
  let crees = 0;
  for (const index of indices) {
    const item = CATALOGUE[index];
    executer(
      `INSERT INTO veille (id, type, source, titre, url, contenu, tendances, pays_cible, statut, date_collecte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Nouveau', ?)`,
      uuid(),
      item.type,
      item.source,
      item.titre,
      '',
      item.contenu,
      JSON.stringify(item.tendances),
      JSON.stringify(PAYS_AUTORISES.filter(() => alea.probabilite(0.55))),
      new Date().toISOString(),
    );
    crees += 1;
  }
  return { crees, existants: 0 };
}

export function listerVeille({ limite = 20, type } = {}) {
  const clause = type ? 'WHERE type = ?' : '';
  const params = type ? [type] : [];
  return tous(`SELECT * FROM veille ${clause} ORDER BY date_collecte DESC LIMIT ?`, ...params, limite).map((l) => ({
    id: l.id,
    type: l.type,
    source: l.source,
    titre: l.titre,
    contenu: l.contenu,
    tendances: JSON.parse(l.tendances || '[]'),
    paysCible: JSON.parse(l.pays_cible || '[]'),
    statut: l.statut,
    dateCollecte: l.date_collecte,
  }));
}

export function marquerVeilleTraitee(id) {
  return executer(`UPDATE veille SET statut = 'Traite' WHERE id = ?`, id).changes;
}
