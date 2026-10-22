import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function typeMime(fichier) {
  return TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream';
}

export class ErreurHttp extends Error {
  constructor(statut, message, details) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

export function envoyerJson(reponse, statut, donnees) {
  const corps = JSON.stringify(donnees);
  reponse.writeHead(statut, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(corps),
  });
  reponse.end(corps);
}

export function envoyerTexte(reponse, statut, texte, mime = 'text/plain; charset=utf-8') {
  reponse.writeHead(statut, {
    'content-type': mime,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(texte),
  });
  reponse.end(texte);
}

/** Lecture du corps JSON avec garde-fou de taille. */
export async function lireJson(requete, limite = 2_000_000) {
  const morceaux = [];
  let taille = 0;
  for await (const morceau of requete) {
    taille += morceau.length;
    if (taille > limite) throw new ErreurHttp(413, 'Corps de requête trop volumineux');
    morceaux.push(morceau);
  }
  if (!morceaux.length) return {};
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8'));
  } catch {
    throw new ErreurHttp(400, 'JSON invalide');
  }
}

/** Sert un fichier statique en bloquant toute traversée de répertoire. */
export function servirFichier(reponse, racine, cheminRelatif, options = {}) {
  const racineAbs = path.resolve(racine);
  const cible = path.resolve(racineAbs, '.' + path.posix.normalize('/' + cheminRelatif));
  if (!cible.startsWith(racineAbs + path.sep) && cible !== racineAbs) {
    envoyerTexte(reponse, 403, 'Accès refusé');
    return false;
  }
  let stat;
  try {
    stat = fs.statSync(cible);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return false;
  const mime = typeMime(cible);
  const entetes = {
    'content-type': mime,
    'content-length': stat.size,
    'cache-control': options.cacheControle || 'no-cache',
    'x-content-type-options': 'nosniff',
  };
  if (options.download) {
    const nom = options.nomFichier || path.basename(cible);
    entetes['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`;
  }
  reponse.writeHead(200, entetes);
  fs.createReadStream(cible).pipe(reponse);
  return true;
}

export function decoderSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
