import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { config } from '../config.js';
import { journaliser, notifier } from './journal.js';
import { detecterAnomalie } from './anomalies.js';
import { choisirReponse } from '../donnees/reponses.js';
import { listerCommentaires, repondreCommentaire as repondreViaApi } from '../services/commentaires.js';

/**
 * Réponses aux commentaires reçus — priorité du cahier des charges et seule
 * interaction réellement disponible par l'API officielle.
 *
 * Politique :
 *   - on ne répond qu'aux commentaires de nos propres médias ;
 *   - jamais deux fois au même commentaire (`commentaire_id` unique) ;
 *   - le texte de la réponse est choisi dans une banque écrite à l'avance ;
 *   - en cas d'erreur Graph, le commentaire repasse en `Echec` et reste visible
 *     dans l'interface pour une reprise manuelle.
 */

const mapper = (ligne) =>
  ligne
    ? {
        id: ligne.id,
        mediaId: ligne.media_id,
        commentaireId: ligne.commentaire_id,
        auteur: ligne.auteur,
        texteRecu: ligne.texte_recu,
        reponse: ligne.reponse,
        langue: ligne.langue,
        intention: ligne.intention,
        statut: ligne.statut,
        dateCommentaire: ligne.date_commentaire,
        dateReponse: ligne.date_reponse,
        erreur: ligne.erreur,
      }
    : null;

export function listerReponses({ statut = null, limite = 100 } = {}) {
  const clauses = [];
  const params = [];
  if (statut) {
    clauses.push('statut = ?');
    params.push(statut);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return tous(`SELECT * FROM reponse_commentaire ${where} ORDER BY date_commentaire DESC LIMIT ?`, ...params, limite).map(
    mapper,
  );
}

export function statistiquesReponses() {
  const parStatut = tous('SELECT statut, COUNT(*) AS n FROM reponse_commentaire GROUP BY statut');
  const total = parStatut.reduce((somme, ligne) => somme + ligne.n, 0);
  const repondues = parStatut.find((l) => l.statut === 'Repondu')?.n ?? 0;
  return {
    total,
    repondues,
    aRepondre: parStatut.find((l) => l.statut === 'ARepondre')?.n ?? 0,
    echecs: parStatut.find((l) => l.statut === 'Echec')?.n ?? 0,
    taux: total ? Math.round((repondues / total) * 1000) / 10 : 0,
    parStatut,
  };
}

/** Enregistre un commentaire reçu et prépare sa réponse écrite à l'avance. */
export function enregistrerCommentaire({ mediaId, commentaireId, auteur = '', texte = '', date = '' }) {
  const existant = un('SELECT * FROM reponse_commentaire WHERE commentaire_id = ?', commentaireId);
  if (existant) return mapper(existant);
  const graine = [...String(commentaireId)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const choix = choisirReponse(texte, { graine });
  const id = uuid();
  executer(
    `INSERT INTO reponse_commentaire
      (id, media_id, commentaire_id, auteur, texte_recu, reponse, langue, intention, statut, date_commentaire)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARepondre', ?)`,
    id,
    mediaId,
    commentaireId,
    String(auteur).slice(0, 80),
    String(texte).slice(0, 2000),
    choix.texte,
    choix.langue,
    choix.intention,
    date || new Date().toISOString(),
  );
  return mapper(un('SELECT * FROM reponse_commentaire WHERE id = ?', id));
}

/** Répond réellement (API Graph) à un commentaire enregistré. */
export async function repondre(id) {
  const ligne = un('SELECT * FROM reponse_commentaire WHERE id = ?', id);
  if (!ligne) return null;
  if (ligne.statut === 'Repondu') return mapper(ligne);
  try {
    await repondreViaApi(ligne.commentaire_id, ligne.reponse);
    executer(
      `UPDATE reponse_commentaire SET statut = 'Repondu', date_reponse = ?, erreur = NULL WHERE id = ?`,
      new Date().toISOString(),
      id,
    );
    journaliser(`Réponse publiée à @${ligne.auteur || 'un abonné'}.`, {
      categorie: 'interaction',
      donnees: { commentaireId: ligne.commentaire_id, intention: ligne.intention },
    });
    return mapper(un('SELECT * FROM reponse_commentaire WHERE id = ?', id));
  } catch (erreur) {
    executer(`UPDATE reponse_commentaire SET statut = 'Echec', erreur = ? WHERE id = ?`, erreur.message, id);
    detecterAnomalie('ReponseCommentaire', `Réponse impossible : ${erreur.message}`, {
      severite: 'Avertissement',
      details: { commentaireId: ligne.commentaire_id },
    });
    return mapper(un('SELECT * FROM reponse_commentaire WHERE id = ?', id));
  }
}

/**
 * Cycle de collecte : lit les commentaires des dernières publications publiées,
 * enregistre les nouveaux, puis répond à ceux qui sont en attente.
 */
export async function collecterEtRepondre({ limiteMedias = 5, limiteParMedia = 30 } = {}) {
  if (!config.reponsesCommentaires) return { actif: false, nouveaux: 0, repondues: 0 };
  const medias = tous(
    `SELECT id, media_id_externe FROM publication
      WHERE statut = 'Publiee' AND media_id_externe IS NOT NULL
      ORDER BY date_heure DESC LIMIT ?`,
    limiteMedias,
  );
  let nouveaux = 0;
  let repondues = 0;
  for (const media of medias) {
    let commentaires = [];
    try {
      commentaires = await listerCommentaires(media.media_id_externe, { limite: limiteParMedia });
    } catch (erreur) {
      journaliser(`Lecture des commentaires impossible : ${erreur.message}`, {
        niveau: 'alerte',
        categorie: 'interaction',
      });
      continue;
    }
    for (const commentaire of commentaires) {
      if (commentaire.dejaRepondu) continue;
      const enregistre = enregistrerCommentaire({
        mediaId: media.media_id_externe,
        commentaireId: commentaire.id,
        auteur: commentaire.auteur,
        texte: commentaire.texte,
        date: commentaire.date,
      });
      if (enregistre?.statut === 'ARepondre') nouveaux += 1;
      if (enregistre?.statut === 'ARepondre') {
        const resultat = await repondre(enregistre.id);
        if (resultat?.statut === 'Repondu') repondues += 1;
      }
    }
  }
  if (nouveaux) {
    journaliser(`${nouveaux} commentaire(s) reçu(s), ${repondues} réponse(s) publiée(s).`, {
      categorie: 'interaction',
    });
  }
  return { actif: true, nouveaux, repondues };
}

/** Alerte si des commentaires restent sans réponse au-delà de 24 h. */
export function verifierCommentairesEnAttente() {
  const enAttente = un(
    `SELECT COUNT(*) AS n FROM reponse_commentaire
      WHERE statut = 'ARepondre' AND date_commentaire < datetime('now', '-1 day')`,
  )?.n;
  if (enAttente > 0) {
    notifier({
      type: 'interaction',
      titre: 'Commentaires sans réponse',
      message: `${enAttente} commentaire(s) attendent une réponse depuis plus de 24 h.`,
      niveau: 'Avertissement',
      lien: '/#/liens',
    });
  }
  return enAttente ?? 0;
}
