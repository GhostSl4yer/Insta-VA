#!/usr/bin/env node
/**
 * Génère un hash scrypt pour `INSTAVA_MOT_DE_PASSE_HASH`.
 *   node scripts/hash-mot-de-passe.js "mon mot de passe"
 */
import crypto from 'node:crypto';

const motDePasse = process.argv[2];
if (!motDePasse) {
  console.error('Usage : node scripts/hash-mot-de-passe.js "mon mot de passe"');
  process.exit(1);
}
const sel = crypto.randomBytes(16);
const hash = crypto.scryptSync(motDePasse, sel, 32, { N: 16384, r: 8, p: 1 });
console.log(`scrypt$16384$8$1$${sel.toString('hex')}$${hash.toString('hex')}`);
