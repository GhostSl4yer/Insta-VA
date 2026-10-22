import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { creerAlea } from '../utils/alea.js';
import { DATE_HEURE } from '../utils/temps.js';
import { OBJECTIF, AUTORISATION_MESSAGE_GROUPE } from '../../public/shared/enums.js';
import { COMMENTAIRES_BOT, COMMENTAIRES_AUDIENCE, LANGUE_PAR_PAYS } from '../donnees/commentaires.js';
import { choisirCiblesDuJour } from './cibles.js';
import { obtenirParametres, verifierDisponibilite } from './audience.js';
import { journaliser } from './journal.js';

export function mapperInteraction(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    date: ligne.date,
    type: ligne.type,
    cible: ligne.cible,
    auteur: ligne.auteur,
    pays: ligne.auteur_pays,
    age: ligne.auteur_age,
    reference: Boolean(ligne.reference),
    contenu: ligne.contenu,
    dateHeure: ligne.date_heure,
    statut: ligne.statut,
    publicationId: ligne.publication_id,
    sessionId: ligne.session_id,
    entrante: !ligne.session_id,
  };
}

export function enregistrerInteraction(donnees) {
  const id = uuid();
  executer(
    `INSERT INTO interaction
      (id, date, type, cible, auteur, auteur_pays, auteur_age, reference, contenu, date_heure, statut, publication_id, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    donnees.date,
    donnees.type,
    donnees.cible,
    donnees.auteur,
    donnees.pays || '',
    donnees.age || 0,
    donnees.reference ? 1 : 0,
    donnees.contenu || '',
    donnees.dateHeure || new Date().toISOString(),
    donnees.statut || 'Effectue',
    donnees.publicationId || null,
    donnees.sessionId || null,
  );
  return id;
}

/**
 * Vérifie les règles d'interaction : 16 h → 00 h uniquement (R2/R8),
 * aucun message privé (R4), plafond horaire anti-spam.
 */
export function verifierLimites({ type, minute, date }) {
  if (!AUTORISATION_MESSAGE_GROUPE[type] || type === 'MessagePrive') {
    return { autorise: false, raison: 'Type d’interaction interdit par les règles du compte.' };
  }
  const heure = Number(minute);
  if (!(heure >= 960 && heure < 1440)) {
    return { autorise: false, raison: 'Hors de la plage autorisée 16 h → 00 h (R2/R8).' };
  }
  const heureCourante = String(heure >= 1440 ? 0 : Math.floor(heure / 60)).padStart(2, '0');
  const compteHoraire = un(
    `SELECT COUNT(*) AS n FROM interaction
     WHERE session_id IS NOT NULL AND type = ? AND date = ? AND substr(date_heure, 12, 2) = ?`,
    type,
    date,
    heureCourante,
  )?.n ?? 0;
  const plafond = type === 'Commentaire' ? OBJECTIF.commentairesParHeureMax : OBJECTIF.likesParHeureMax;
  if (compteHoraire >= plafond) {
    return { autorise: false, raison: `Plafond horaire atteint pour ${type} (${plafond}/h).` };
  }
  return { autorise: true };
}

const LIKES_CIBLES = ['like publication', 'like story', 'like reel', 'like carrousel'];

/** Suivi d'un compte cible (crée le compte suivi et l'abonnement). */
export function suivreCompte(cible, { date, reference = false } = {}) {
  const existant = un('SELECT * FROM compte_suivi WHERE username = ?', cible.username);
  let compteSuiviId = existant?.id;
  if (!existant) {
    compteSuiviId = uuid();
    executer(
      `INSERT INTO compte_suivi
        (id, username, bio, pays, tranche_age, est_reference, nombre_abonnes, nombre_publications,
         categorie, date_dernier_suivi, est_actif, score_attractivite, created_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      compteSuiviId,
      cible.username,
      cible.bio || '',
      cible.pays,
      cible.trancheAge || '25-34',
      reference || cible.estReference ? 1 : 0,
      cible.nombreAbonnes || 0,
      Math.max(12, Math.round((cible.nombreAbonnes || 1000) / 90)),
      cible.interets?.[0] || cible.categorie || 'fitness',
      new Date().toISOString(),
      cible.scoreAttractivite || 0,
      new Date().toISOString(),
    );
  } else {
    executer(
      'UPDATE compte_suivi SET date_dernier_suivi = ?, est_actif = 1 WHERE id = ?',
      new Date().toISOString(),
      compteSuiviId,
    );
  }
  const abonnementExistant = un('SELECT * FROM abonnement WHERE compte_suivi_id = ?', compteSuiviId);
  if (!abonnementExistant) {
    executer(
      `INSERT INTO abonnement (id, compte_suivi_id, abonnement, date_abonnement, date_suivi, suivi, actif)
       VALUES (?, ?, ?, ?, ?, 1, 1)`,
      uuid(),
      compteSuiviId,
      reference || cible.estReference ? 'Reference' : 'Audience',
      date || new Date().toISOString().slice(0, 10),
      new Date().toISOString(),
    );
  }
  executer(`UPDATE cible SET statut = 'Suivi' WHERE username = ?`, cible.username);
  return compteSuiviId;
}

/** `suivre()` déclenché manuellement depuis l'interface. */
export function suivreCible(id, { date } = {}) {
  const cible = un('SELECT * FROM cible WHERE id = ?', id);
  if (!cible) return null;
  suivreCompte(
    {
      username: cible.username,
      bio: cible.bio,
      pays: cible.pays,
      trancheAge: cible.tranche_age,
      nombreAbonnes: cible.nombre_abonnes,
      interets: JSON.parse(cible.interets || '[]'),
      estReference: Boolean(cible.est_compte_reference),
      scoreAttractivite: cible.score_attractivite,
    },
    { date: date || new Date().toISOString().slice(0, 10), reference: Boolean(cible.est_compte_reference) },
  );
  journaliser(`Suivi manuel du compte @${cible.username}.`, { categorie: 'interaction' });
  return { username: cible.username, suivi: true };
}

/**
 * Lot d'interactions sortantes : likes, commentaires contextualisés (langue de
 * la cible) et suivis — jamais de message privé (R4).
 */
export function executerLotInteractions({ date, minute, cycleId, sessionId, compte, volume = 6, graine = 1 }) {
  const alea = creerAlea(graine + minute);
  const dejaSuivis = new Set(tous('SELECT username FROM compte_suivi').map((l) => l.username));
  const cibles = choisirCiblesDuJour(6, { dejaSuivis });
  const resultats = [];
  if (!cibles.length) return resultats;

  const parametres = obtenirParametres();
  const quotaCommentaires = alea.entier(2, 4);
  let commentaires = 0;
  let suivis = 0;

  for (let i = 0; i < volume; i += 1) {
    const cible = cibles[i % cibles.length];
    if (!cible) break;
    const dispo = verifierDisponibilite({ age: cible.age, pays: cible.pays, genre: cible.genre }, parametres);
    if (!dispo.disponible) {
      executer(
        `INSERT INTO interaction
          (id, date, type, cible, auteur, auteur_pays, auteur_age, reference, contenu, date_heure, statut, session_id)
         VALUES (?, ?, 'Like', ?, ?, ?, ?, 0, ?, ?, 'Ignore', ?)`,
        uuid(),
        date,
        cible.username,
        compte.username,
        cible.pays,
        cible.age,
        `Cible ignorée : ${dispo.raisons.join(' · ')}`,
        DATE_HEURE(date, minute + i),
        sessionId,
      );
      continue;
    }
    const langue = LANGUE_PAR_PAYS[cible.pays] || 'en';
    const banque = COMMENTAIRES_BOT[langue] || COMMENTAIRES_BOT.en;
    const veutSuivre = cible.estReference || alea.probabilite(0.22);
    const typeDemande =
      commentaires < quotaCommentaires && alea.probabilite(0.55)
        ? 'Commentaire'
        : veutSuivre && suivis < 2
          ? 'Suivi'
          : 'Like';

    const limites = verifierLimites({ type: typeDemande, minute, date });
    if (!limites.autorise) continue;

    let contenu = alea.choisir(LIKES_CIBLES);
    if (typeDemande === 'Commentaire') {
      contenu = alea.choisir(banque);
      commentaires += 1;
    } else if (typeDemande === 'Suivi') {
      contenu = `Suivi de @${cible.username}${cible.estReference ? ' (compte de référence)' : ''}`;
      suivis += 1;
      suivreCompte(cible, { date, reference: cible.estReference });
    }

    enregistrerInteraction({
      date,
      type: typeDemande,
      cible: cible.username,
      auteur: compte.username,
      pays: cible.pays,
      age: cible.age,
      reference: cible.estReference,
      contenu,
      dateHeure: DATE_HEURE(date, minute + i),
      statut: 'Effectue',
      sessionId,
    });
    resultats.push({ type: typeDemande, cible: cible.username, pays: cible.pays });
  }
  if (resultats.length) {
    journaliser(
      `${resultats.length} interaction(s) : ${commentaires} commentaire(s), ${suivis} suivi(s) — volume ${volume}.`,
      {
        categorie: 'interaction',
        jour: date,
        cycleId,
        donnees: { minute, cibles: [...new Set(resultats.map((r) => r.cible))] },
      },
    );
  }
  return resultats;
}

/** Visionnage simulé : incrémente la durée de la session (R3 : 30 min/jour). */
export function enregistrerVisionnage({ date, minute, secondes, sessionId, compte, cible }) {
  enregistrerInteraction({
    date,
    type: 'Visionnage',
    cible: cible?.username || '@niche.fitness',
    auteur: compte.username,
    pays: cible?.pays || 'USA',
    age: cible?.age || 30,
    reference: Boolean(cible?.estReference),
    contenu: `Visionnage ${Math.max(1, Math.round(secondes / 60))} min${
      cible ? ` · reels de @${cible.username}` : ' · contenus de la niche'
    }`,
    dateHeure: DATE_HEURE(date, minute),
    statut: 'Effectue',
    sessionId,
  });
  if (sessionId) {
    executer(
      'UPDATE session_quotidienne SET duree_visionnage = duree_visionnage + ? WHERE id = ?',
      secondes,
      sessionId,
    );
  }
}

export function totalVisionnage(date) {
  return un('SELECT COALESCE(SUM(duree_visionnage), 0) AS s FROM session_quotidienne WHERE date = ?', date)?.s ?? 0;
}

/**
 * Réactions entrantes de l'audience sur une publication : likes et commentaires
 * cohérents avec les pays/âges autorisés uniquement (R7/R9).
 */
export function simulerReactionsEntrantes({ publication, date, compte, graine = 1, theme = 'fitness' }) {
  const alea = creerAlea(graine + publication.likes + 7);
  const parametres = obtenirParametres();
  const cibles = tous(
    `SELECT * FROM cible WHERE est_compte_reference = 0 AND statut != 'Rejete' ORDER BY RANDOM() LIMIT 24`,
  );
  if (!cibles.length) return { likes: 0, commentaires: 0 };

  const facteur = publication.type === 'Reel' ? 1.6 : publication.type === 'Story' ? 0.5 : 1;
  const portee = Math.round(alea.entre(260, 980) * facteur);
  const likes = Math.round(portee * alea.entre(0.035, 0.085));
  const commentaires = Math.max(1, Math.round(likes * alea.entre(0.04, 0.11)));
  const vues = publication.type === 'Reel' ? Math.round(portee * alea.entre(1.4, 2.6)) : portee;

  const invites = alea.entier(6, 14);
  let commentairesCrees = 0;
  for (let i = 0; i < invites; i += 1) {
    const cible = cibles[i % cibles.length];
    const dispo = verifierDisponibilite({ age: cible.age, pays: cible.pays, genre: cible.genre }, parametres);
    if (!dispo.disponible) continue;
    const langue = LANGUE_PAR_PAYS[cible.pays] || 'en';
    const banque = COMMENTAIRES_AUDIENCE[langue] || COMMENTAIRES_AUDIENCE.en;
    const texte = i < 3 ? alea.choisir(banque[theme] || banque.generique) : '';
    enregistrerInteraction({
      date,
      type: texte ? 'Commentaire' : 'Like',
      cible: compte.username,
      auteur: cible.username,
      pays: cible.pays,
      age: cible.age,
      reference: false,
      contenu: texte || `like ${publication.type.toLowerCase()}`,
      dateHeure: DATE_HEURE(date, alea.entier(970, 1435)),
      statut: 'Effectue',
      publicationId: publication.id,
    });
    if (texte) commentairesCrees += 1;
  }

  executer(
    'UPDATE publication SET likes = likes + ?, commentaires = commentaires + ?, vues = vues + ?, portee = portee + ? WHERE id = ?',
    likes,
    commentaires,
    vues,
    portee,
    publication.id,
  );
  return { likes, commentaires, vues, portee, commentairesCrees };
}

export function listerInteractions({ type, sens, pays, date, limite = 150 } = {}) {
  const clauses = [];
  const params = [];
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (pays) {
    clauses.push('auteur_pays = ?');
    params.push(pays);
  }
  if (date) {
    clauses.push('date = ?');
    params.push(date);
  }
  if (sens === 'sortante') clauses.push('session_id IS NOT NULL');
  if (sens === 'entrante') clauses.push('session_id IS NULL');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return tous(
    `SELECT * FROM interaction ${where} ORDER BY date_heure DESC LIMIT ?`,
    ...params,
    limite,
  ).map(mapperInteraction);
}

export function listerAbonnements({ limite = 100 } = {}) {
  return tous(
    `SELECT a.*, cs.username, cs.pays, cs.est_reference, cs.nombre_abonnes, cs.categorie
     FROM abonnement a JOIN compte_suivi cs ON cs.id = a.compte_suivi_id
     ORDER BY a.date_suivi DESC LIMIT ?`,
    limite,
  ).map((l) => ({
    id: l.id,
    compteSuiviId: l.compte_suivi_id,
    username: l.username,
    pays: l.pays,
    estReference: Boolean(l.est_reference),
    nombreAbonnes: l.nombre_abonnes,
    categorie: l.categorie,
    abonnement: l.abonnement,
    dateAbonnement: l.date_abonnement,
    dateSuivi: l.date_suivi,
    suivi: Boolean(l.suivi),
  }));
}

export function verifierStatutAbonnement(id) {
  const ligne = un('SELECT * FROM abonnement WHERE id = ?', id);
  if (!ligne) return null;
  return { id, actif: Boolean(ligne.actif), suivi: Boolean(ligne.suivi), abonnement: ligne.abonnement };
}

export function statistiquesInteractions({ date } = {}) {
  const clause = date ? 'WHERE date = ?' : '';
  const params = date ? [date] : [];
  const parType = Object.fromEntries(
    tous(`SELECT type, COUNT(*) AS n FROM interaction ${clause} GROUP BY type`, ...params).map((l) => [l.type, l.n]),
  );
  const parPays = tous(
    `SELECT auteur_pays AS pays, COUNT(*) AS n FROM interaction ${clause} GROUP BY auteur_pays ORDER BY n DESC`,
    ...params,
  );
  const sortantes = un(
    `SELECT COUNT(*) AS n FROM interaction ${date ? 'WHERE date = ? AND' : 'WHERE'} session_id IS NOT NULL`,
    ...params,
  )?.n ?? 0;
  const entrantes = un(
    `SELECT COUNT(*) AS n FROM interaction ${date ? 'WHERE date = ? AND' : 'WHERE'} session_id IS NULL`,
    ...params,
  )?.n ?? 0;
  return { parType, parPays, sortantes, entrantes, total: sortantes + entrantes };
}

export function suivisDuJour(date) {
  return un(
    `SELECT COUNT(*) AS n FROM interaction WHERE type = 'Suivi' AND session_id IS NOT NULL AND date = ?`,
    date,
  )?.n ?? 0;
}
