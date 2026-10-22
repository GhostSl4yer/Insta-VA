import { executer, tous, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { isoNaif } from '../utils/temps.js';
import { urlMedia } from './drive.js';
import { journaliser, notifier } from './journal.js';
import { detecterAnomalie } from './anomalies.js';
import { publierMedia, modeSimulation } from '../services/instagram.js';

export function mapperPublication(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    compteId: ligne.compte_id,
    cycleId: ligne.cycle_id,
    type: ligne.type,
    contenu: ligne.contenu,
    contenuId: ligne.contenu_id,
    dateHeure: ligne.date_heure,
    statut: ligne.statut,
    lien: ligne.lien,
    likes: ligne.likes,
    commentaires: ligne.commentaires,
    vues: ligne.vues,
    portee: ligne.portee,
    jour: ligne.jour,
    erreur: ligne.erreur,
    image: ligne.chemin_public ? urlMedia(ligne.chemin_public) : null,
    theme: ligne.theme || 'fitness',
  };
}

const HEURES_PAR_TYPE = {
  Story: [16 * 60 + 40, 19 * 60, 21 * 60 + 20],
  Reel: [17 * 60 + 20, 21 * 60 + 40],
  UnePleine: [19 * 60 + 40],
};

/**
 * `planifierPublicationDuJour()` — crée les publications de la journée à partir
 * du Drive. La publication est toujours planifiée (R5 : pas de spam).
 */
export function planifierPublicationsDuJour({ cycle, date, compte }) {
  const contenus = tous(
    `SELECT c.* FROM contenu_drive c
     WHERE c.jour_prevu = ? AND c.type != 'PhotoProfil'
       AND c.statut IN ('Planifie','Telecharge')
       AND NOT EXISTS (SELECT 1 FROM publication p WHERE p.contenu_id = c.id)
     ORDER BY c.type, c.date_ajout`,
    date,
  );
  const compteurs = { Story: 0, Reel: 0, UnePleine: 0 };
  const publications = [];
  for (const contenu of contenus) {
    const index = compteurs[contenu.type] ?? 0;
    const heures = HEURES_PAR_TYPE[contenu.type] || [18 * 60];
    const minute = heures[Math.min(index, heures.length - 1)] + (index >= heures.length ? index * 20 : 0);
    compteurs[contenu.type] = index + 1;
    const id = uuid();
    executer(
      `INSERT INTO publication
        (id, compte_id, cycle_id, type, contenu, contenu_id, date_heure, statut, jour)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Planifiee', ?)`,
      id,
      compte.id,
      cycle.id,
      contenu.type,
      contenu.description,
      contenu.id,
      isoNaif(date, minute),
      date,
    );
    publications.push({ id, minute, type: contenu.type });
  }
  if (publications.length) {
    journaliser(`${publications.length} publication(s) planifiée(s) pour le ${date}.`, {
      categorie: 'publication',
      jour: date,
      cycleId: cycle.id,
      donnees: { details: publications.map((p) => p.type) },
    });
  }
  return publications;
}

export function publicationsDues(cycleId, minuteCourante) {
  return tous(
    `SELECT p.*, c.chemin_public, c.theme FROM publication p
     LEFT JOIN contenu_drive c ON c.id = p.contenu_id
     WHERE p.cycle_id = ? AND p.statut = 'Planifiee'
     ORDER BY p.date_heure`,
    cycleId,
  )
    .filter((ligne) => {
      const [h, m] = String(ligne.date_heure).slice(11, 16).split(':').map(Number);
      return h * 60 + m <= minuteCourante;
    })
    .map((ligne) => mapperPublication(ligne));
}

/** Publie une publication planifiée (simulation ou API Graph). */
export async function publierPublication(id, { baseUrl = '' } = {}) {
  const ligne = un(
    `SELECT p.*, c.chemin_public, c.theme FROM publication p
     LEFT JOIN contenu_drive c ON c.id = p.contenu_id WHERE p.id = ?`,
    id,
  );
  if (!ligne) return null;
  if (ligne.statut === 'Publiee') return mapperPublication(ligne);
  executer(`UPDATE publication SET statut = 'EnCours' WHERE id = ?`, id);
  try {
    const url = ligne.chemin_public ? `${baseUrl}${urlMedia(ligne.chemin_public)}` : null;
    const resultat = await publierMedia({
      type: ligne.type,
      urlMedia: url,
      legende: ligne.contenu,
      miniatureUrl: url,
    });
    executer(
      `UPDATE publication SET statut = 'Publiee', lien = ?, erreur = NULL WHERE id = ?`,
      resultat.permalink,
      id,
    );
    if (ligne.contenu_id) {
      executer(
        `UPDATE contenu_drive SET statut = 'Publie', date_publication = ? WHERE id = ?`,
        new Date().toISOString(),
        ligne.contenu_id,
      );
    }
    journaliser(`Publication ${ligne.type} publiée${resultat.simule ? ' (simulation)' : ''}.`, {
      categorie: 'publication',
      jour: ligne.jour,
      cycleId: ligne.cycle_id,
      donnees: { type: ligne.type, lien: resultat.permalink },
    });
    return mapperPublication(un(`SELECT p.*, c.chemin_public, c.theme FROM publication p LEFT JOIN contenu_drive c ON c.id = p.contenu_id WHERE p.id = ?`, id));
  } catch (erreur) {
    executer(`UPDATE publication SET statut = 'Echec', erreur = ? WHERE id = ?`, erreur.message, id);
    detecterAnomalie('EchecPublication', `Échec de publication : ${erreur.message}`, {
      severite: 'Critique',
      details: { publicationId: id, type: ligne.type },
      cycleId: ligne.cycle_id,
    });
    return mapperPublication(un('SELECT * FROM publication WHERE id = ?', id));
  }
}

/** `verifierStatut()` du diagramme. */
export function verifierStatut(id) {
  const ligne = un('SELECT * FROM publication WHERE id = ?', id);
  if (!ligne) return null;
  return { id, statut: ligne.statut, publiee: ligne.statut === 'Publiee', lien: ligne.lien };
}

export function supprimerPublication(id) {
  const ligne = un('SELECT * FROM publication WHERE id = ?', id);
  if (!ligne) return null;
  executer(`UPDATE publication SET statut = 'Supprimee' WHERE id = ?`, id);
  if (ligne.contenu_id) {
    executer(`UPDATE contenu_drive SET statut = 'Telecharge' WHERE id = ? AND statut = 'Publie'`, ligne.contenu_id);
  }
  journaliser('Publication retirée du planning.', { categorie: 'publication', niveau: 'alerte' });
  return mapperPublication(un('SELECT * FROM publication WHERE id = ?', id));
}

export function listerPublications({ jour, statut, type, cycleId, limite = 200, avecImage = true } = {}) {
  const clauses = [];
  const params = [];
  if (jour) {
    clauses.push('p.jour = ?');
    params.push(jour);
  }
  if (statut) {
    const liste = String(statut).split(',');
    clauses.push(`p.statut IN (${liste.map(() => '?').join(',')})`);
    params.push(...liste);
  }
  if (type) {
    clauses.push('p.type = ?');
    params.push(type);
  }
  if (cycleId) {
    clauses.push('p.cycle_id = ?');
    params.push(cycleId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const colonnes = avecImage ? 'c.chemin_public, c.theme' : 'NULL AS chemin_public, NULL AS theme';
  const lignes = tous(
    `SELECT p.*, ${colonnes}
     FROM publication p LEFT JOIN contenu_drive c ON c.id = p.contenu_id
     ${where} ORDER BY p.date_heure DESC LIMIT ?`,
    ...params,
    limite,
  );
  return lignes.map(mapperPublication);
}

export function publicationsDuCycle(cycleId) {
  return listerPublications({ cycleId, limite: 50 });
}

export function compterPublicationsParStatut() {
  return Object.fromEntries(
    tous('SELECT statut, COUNT(*) AS n FROM publication GROUP BY statut').map((l) => [l.statut, l.n]),
  );
}

export function dernierePublication() {
  return mapperPublication(
    un(
      `SELECT p.*, c.chemin_public, c.theme FROM publication p
       LEFT JOIN contenu_drive c ON c.id = p.contenu_id
       WHERE p.statut = 'Publiee' ORDER BY p.date_heure DESC LIMIT 1`,
    ),
  );
}

export { modeSimulation };
