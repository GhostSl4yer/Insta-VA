#!/usr/bin/env node
/**
 * Sauvegarde cohérente de la base et des médias.
 *
 *   node scripts/sauvegarde.js [dossier-de-destination]
 *
 * - copie SQLite via `VACUUM INTO` (pas de fichier à moitié écrit) ;
 * - archive le Drive (médias) et les rapports ;
 * - conserve 14 sauvegardes par défaut (`INSTAVA_SAUVEGARDES`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const destination = path.resolve(process.argv[2] || path.join(config.dossierDonnees, 'sauvegardes'));
const conserver = Math.max(1, Number(process.env.INSTAVA_SAUVEGARDES) || 14);
const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dossier = path.join(destination, horodatage);

fs.mkdirSync(dossier, { recursive: true });

if (fs.existsSync(config.fichierBase)) {
  const copie = path.join(dossier, 'insta-va.sqlite');
  const base = new DatabaseSync(config.fichierBase, { readOnly: true });
  try {
    base.exec(`VACUUM INTO '${copie.replace(/'/g, "''")}'`);
  } finally {
    base.close();
  }
}

for (const [nom, source] of [
  ['drive', config.dossierDrive],
  ['rapports', config.dossierRapports],
  ['cle', config.fichierCle],
]) {
  if (!fs.existsSync(source)) continue;
  if (fs.statSync(source).isFile()) {
    fs.copyFileSync(source, path.join(dossier, path.basename(source)));
    continue;
  }
  execFileSync('tar', ['-czf', path.join(dossier, `${nom}.tar.gz`), '-C', path.dirname(source), path.basename(source)]);
}

const sauvegardes = fs
  .readdirSync(destination, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
for (const ancienne of sauvegardes.slice(0, Math.max(0, sauvegardes.length - conserver))) {
  fs.rmSync(path.join(destination, ancienne), { recursive: true, force: true });
}

console.log(`✔ Sauvegarde créée : ${dossier}`);
