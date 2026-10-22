import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexte de compte.
 *
 * Toutes les données métier sont cloisonnées par `compte_id`. Le contexte évite
 * de faire circuler l'identifiant dans chaque signature : la couche HTTP (compte
 * sélectionné dans la session) et l'orchestrateur (un compte à la fois) ouvrent
 * une portée, et les requêtes lisent `compteIdCourant()`.
 *
 * Une portée absente lève une erreur explicite : mieux vaut une requête refusée
 * qu'une requête qui mélange les comptes.
 */
const stockage = new AsyncLocalStorage();

export function executerPour(compteId, fonction) {
  if (!compteId) return Promise.reject(new Error('Aucun compte sélectionné.'));
  return stockage.run({ compteId: String(compteId) }, fonction);
}

export function compteIdCourant() {
  return stockage.getStore()?.compteId || null;
}

export function exigerCompte() {
  const id = compteIdCourant();
  if (!id) {
    const erreur = new Error('Aucun compte Instagram sélectionné.');
    erreur.statut = 409;
    throw erreur;
  }
  return id;
}

/** Exécute une fonction synchrone dans la portée d'un compte (utile aux tests). */
export function avecCompte(compteId, fonction) {
  if (!compteId) throw new Error('Aucun compte sélectionné.');
  return stockage.run({ compteId: String(compteId) }, fonction);
}
