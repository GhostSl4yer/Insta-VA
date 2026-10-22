import { executer, un } from '../db.js';
import { uuid } from '../utils/ids.js';
import { AGENT_DEFAUT } from '../donnees/personas.js';
import { config } from '../config.js';

function mapper(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    nom: ligne.nom,
    prenom: ligne.prenom,
    role: ligne.role,
    email: ligne.email,
    statut: ligne.statut,
    fuseauHoraire: ligne.fuseau_horaire,
    configuration: JSON.parse(ligne.configuration || '{}'),
  };
}

export function assurerAgent() {
  const existant = un('SELECT * FROM agent LIMIT 1');
  if (existant) return mapper(existant);
  if (config.production) return null;
  const id = uuid();
  const configuration = {
    notifications: { journal: true, anomalies: true, rapportQuotidien: true },
    apparence: { theme: 'sombre' },
    objectif: {
      abonnes: 1200,
      engagement: 5.5,
      lienExterne: 'https://tavia.app/avatar/maya',
    },
    restrictions: {
      messagesPrives: false,
      publicationHeures: { debut: config.heureDebut, fin: config.heureFin },
      ageMinimum: config.ageMinimum,
    },
  };
  executer(
    `INSERT INTO agent (id, nom, prenom, role, email, statut, fuseau_horaire, configuration)
     VALUES (?, ?, ?, ?, ?, 'Actif', ?, ?)`,
    id,
    AGENT_DEFAUT.nom,
    AGENT_DEFAUT.prenom,
    AGENT_DEFAUT.role,
    AGENT_DEFAUT.email,
    config.fuseau,
    JSON.stringify(configuration),
  );
  return mapper(un('SELECT * FROM agent WHERE id = ?', id));
}

export function agentCourant() {
  return mapper(un('SELECT * FROM agent LIMIT 1'));
}

export function configurerProfilAgent(payload = {}) {
  const agent = assurerAgent();
  const configuration = { ...agent.configuration, ...(payload.configuration || {}) };
  if (payload.configuration?.notifications) {
    configuration.notifications = { ...agent.configuration.notifications, ...payload.configuration.notifications };
  }
  if (payload.configuration?.objectif) {
    configuration.objectif = { ...agent.configuration.objectif, ...payload.configuration.objectif };
  }
  executer(
    `UPDATE agent SET nom = ?, prenom = ?, email = ?, role = ?, configuration = ? WHERE id = ?`,
    payload.nom ?? agent.nom,
    payload.prenom ?? agent.prenom,
    payload.email ?? agent.email,
    payload.role ?? agent.role,
    JSON.stringify(configuration),
    agent.id,
  );
  return agentCourant();
}

/** Raccourci demandé par le diagramme de classes. */
export function configurerProfil(payload) {
  return configurerProfilAgent(payload);
}
