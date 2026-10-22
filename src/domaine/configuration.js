import { executer, un } from '../db.js';
import { config } from '../config.js';
import { chiffrer, dechiffrer } from './chiffrement.js';
import {
  compteCourant,
  compteParId,
  etatCompte,
  listerComptes,
  compterComptesActifs,
} from './compte.js';
import { obtenirParametres } from './audience.js';
import { compteIdCourant } from './contexte.js';
import { journaliser } from './journal.js';
import { configurerManuellement } from './compte.js';
import * as agentModule from './agent.js';

/**
 * Mise en service par compte.
 *
 * Un compte est « prêt » quand ses quatre blocs sont réellement renseignés :
 * profil, identifiants Graph, dossier Drive partagé, audience. Aucune valeur
 * n'est supposée : l'état affiché est celui de la base.
 */

export function identifiantsGraph(compteId = compteIdCourant()) {
  if (!compteId) return { userId: '', token: '' };
  const ligne = un('SELECT ig_user_id, jeton_chiffre FROM compte_instagram WHERE id = ?', compteId);
  if (!ligne) return { userId: '', token: '' };
  return {
    userId: ligne.ig_user_id || '',
    token: dechiffrer(ligne.jeton_chiffre) || '',
  };
}

export function enregistrerIdentifiantsGraph({ userId, token } = {}) {
  const compte = compteCourant();
  if (!compte) throw new Error('Aucun compte sélectionné.');
  if (token) {
    executer(
      'UPDATE compte_instagram SET ig_user_id = ?, jeton_chiffre = ? WHERE id = ?',
      String(userId || '').replace(/[^0-9]/g, ''),
      chiffrer(String(token).trim()),
      compte.id,
    );
  } else {
    executer(
      'UPDATE compte_instagram SET ig_user_id = ? WHERE id = ?',
      String(userId || '').replace(/[^0-9]/g, ''),
      compte.id,
    );
  }
  journaliser('Identifiants Graph enregistrés (jeton chiffré).', { categorie: 'compte' });
  return etatConfiguration();
}

export function oublierIdentifiantsGraph() {
  const compteId = compteIdCourant();
  if (!compteId) return null;
  executer(`UPDATE compte_instagram SET ig_user_id = '', jeton_chiffre = '' WHERE id = ?`, compteId);
  return etatConfiguration();
}

/** Le compte courant (ou le premier compte) existe-t-il ? */
export function compteExistant() {
  return Boolean(compteCourant() || listerComptes()[0]);
}

export function configurationFaite() {
  return compterComptesActifs() > 0;
}

export function moteurAutorise() {
  return configurationFaite();
}

/** État de mise en service du compte courant. */
export function etatConfiguration() {
  const comptes = listerComptes();
  const compte = compteCourant() || comptes[0] || null;
  if (!compte) {
    return {
      requise: true,
      complete: false,
      compte: null,
      comptes: 0,
      etapes: [],
      manquants: ['aucun compte'],
      moteurAutorise: false,
    };
  }
  const audience = obtenirParametres();
  const base = etatCompte(compte);
  const manquants = [...base.manquants];
  if (!audience.id) manquants.push('audience (pays et âge)');
  const etapes = [
    { cle: 'profil', libelle: 'Profil du compte', fait: Boolean(compte.nomComplet && compte.bio) },
    { cle: 'graph', libelle: 'Identifiants Instagram Graph', fait: Boolean(compte.igUserId && compte.jetonConfigure) },
    { cle: 'drive', libelle: 'Dossier Drive partagé', fait: Boolean(compte.driveFolderId) },
    { cle: 'audience', libelle: 'Audience (pays, âge ≥ 25 ans)', fait: Boolean(audience.id) },
  ];
  return {
    requise: true,
    complete: manquants.length === 0,
    compte,
    comptes: comptes.length,
    actifs: compterComptesActifs(),
    etapes,
    manquants,
    moteurAutorise: compterComptesActifs() > 0,
  };
}

/** Finalise un compte : recalcule son statut et l'active s'il est complet. */
export function finaliserConfiguration() {
  const compte = compteCourant();
  if (!compte) {
    const erreur = new Error('Aucun compte sélectionné.');
    erreur.statut = 400;
    throw erreur;
  }
  const etat = etatCompte(compte);
  executer(
    `UPDATE compte_instagram SET statut = ?, configuration_ok = ?, actif = ? WHERE id = ?`,
    etat.complete ? 'Actif' : 'EnAttente',
    etat.complete ? 1 : 0,
    etat.complete ? 1 : 0,
    compte.id,
  );
  journaliser(
    etat.complete
      ? `Compte @${compte.username} activé.`
      : `Compte @${compte.username} incomplet : ${etat.manquants.join(', ')}.`,
    { categorie: 'compte', niveau: etat.complete ? 'info' : 'alerte' },
  );
  return etatConfiguration();
}

/** Enregistre le profil du compte courant (étape « compte » de la mise en service). */
export function enregistrerCompte(payload = {}) {
  const compte = compteCourant();
  if (!compte) {
    const erreur = new Error('Aucun compte sélectionné.');
    erreur.statut = 400;
    throw erreur;
  }
  return configurerManuellement(payload);
}

/** Enregistre le responsable (global à l'installation). */
export function enregistrerAgent(payload = {}) {
  const { configurerProfil } = agentModule;
  return configurerProfil(payload);
}

/** Conservé pour compatibilité : alias de l'état du compte. */
export function configurationInitiale() {
  return etatConfiguration();
}

export { config };
