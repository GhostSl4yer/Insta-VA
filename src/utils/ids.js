import crypto from 'node:crypto';

export const uuid = () => crypto.randomUUID();

export function identifiant(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export function hash(texte) {
  return crypto.createHash('sha256').update(String(texte)).digest('hex');
}

/** Transforme un pseudo Instagram en nom d'utilisateur normalisé. */
export function normaliserPseudo(pseudo) {
  return String(pseudo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}
