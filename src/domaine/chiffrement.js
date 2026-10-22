import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';

/**
 * Chiffrement AES-256-GCM des identifiants du compte (aucun mot de passe n'est
 * réellement utilisé : Instagram ne permet pas ce mode d'accès, on stocke une
 * valeur chiffrée pour respecter le diagramme de classes).
 */
let cleCache = null;

function cle() {
  if (cleCache) return cleCache;
  if (fs.existsSync(config.fichierCle)) {
    cleCache = Buffer.from(fs.readFileSync(config.fichierCle, 'utf8').trim(), 'hex');
  } else {
    cleCache = crypto.randomBytes(32);
    fs.mkdirSync(config.dossierDonnees, { recursive: true });
    fs.writeFileSync(config.fichierCle, cleCache.toString('hex'), { mode: 0o600 });
  }
  return cleCache;
}

export function chiffrer(texte) {
  if (!texte) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cle(), iv);
  const chiffre = Buffer.concat([cipher.update(String(texte), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${chiffre.toString('base64')}`;
}

export function dechiffrer(valeur) {
  if (!valeur) return null;
  const [version, ivB64, tagB64, dataB64] = String(valeur).split(':');
  if (version !== 'v1' || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', cle(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function masquer(valeur) {
  if (!valeur) return '';
  return '•'.repeat(Math.min(12, valeur.length));
}
