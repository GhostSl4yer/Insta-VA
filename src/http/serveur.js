import http from 'node:http';
import path from 'node:path';
import { config } from '../config.js';
import { routesApi } from './api.js';
import { ErreurHttp, envoyerJson, envoyerTexte, servirFichier } from '../utils/http.js';
import { etatPublic } from '../domaine/moteur.js';
import {
  authActive, verifierMotDePasse, creerJeton, sessionCourante, cookieSession, cookieSupprime,
  ipClient, tentativesRestantes, enregistrerEchec, reinitialiserTentatives,
} from './auth.js';
import { pageConnexion, pageErreur } from './pages.js';
import { enregistrerClic } from '../domaine/liens.js';

const clientsSse = new Set();
let diffusion = null;

function ouvrirFlux(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(': insta-va stream\n\n');
  try {
    res.write(`event: etat\ndata: ${JSON.stringify(etatPublic())}\n\n`);
  } catch {
    /* ignore */
  }
  clientsSse.add(res);
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 20_000);
  if (ping.unref) ping.unref();
  req.on('close', () => {
    clearInterval(ping);
    clientsSse.delete(res);
  });
}

export function diffuserEtat() {
  if (!clientsSse.size) return;
  let charge;
  try {
    charge = JSON.stringify(etatPublic());
  } catch {
    return;
  }
  const trame = `event: etat\ndata: ${charge}\n\n`;
  for (const client of clientsSse) {
    try {
      client.write(trame);
    } catch {
      clientsSse.delete(client);
    }
  }
}

function demarrerDiffusion() {
  if (diffusion) return;
  diffusion = setInterval(diffuserEtat, 1500);
  if (diffusion.unref) diffusion.unref();
}

const ENTETES_SECURITE = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
};

/** Routes accessibles sans session. */
const PUBLIQUES = new Set(['/connexion', '/api/auth/connexion', '/api/auth/session', '/healthz', '/readyz']);

function lireCorps(req, limite = 4096) {
  return new Promise((resolve, reject) => {
    let taille = 0;
    const morceaux = [];
    req.on('data', (morceau) => {
      taille += morceau.length;
      if (taille > limite) {
        reject(new ErreurHttp(413, 'Requête trop volumineuse'));
        req.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', reject);
  });
}

function suiteSure(valeur) {
  const suite = String(valeur || '/').trim();
  if (!suite.startsWith('/') || suite.startsWith('//')) return '/';
  return suite;
}

async function traiterConnexion(req, res) {
  const ip = ipClient(req);
  if (tentativesRestantes(ip) <= 0) {
    envoyerTexte(res, 429, 'Trop de tentatives. Réessayez dans quelques minutes.', 'text/plain; charset=utf-8');
    return;
  }
  let corps = '';
  try {
    corps = await lireCorps(req);
  } catch {
    envoyerTexte(res, 413, 'Requête trop volumineuse');
    return;
  }
  const type = String(req.headers['content-type'] || '');
  let donnees = {};
  if (type.includes('application/json')) {
    try {
      donnees = JSON.parse(corps || '{}');
    } catch {
      donnees = {};
    }
  } else {
    donnees = Object.fromEntries(new URLSearchParams(corps));
  }
  const suite = suiteSure(donnees.suite);
  if (!verifierMotDePasse(donnees.motDePasse)) {
    enregistrerEchec(ip);
    const reste = tentativesRestantes(ip);
    if (type.includes('application/json')) {
      envoyerJson(res, 401, { erreur: 'Mot de passe incorrect', restantes: reste });
    } else {
      res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(pageConnexion({ erreur: 'Mot de passe incorrect.', suite, restantes: reste }));
    }
    return;
  }
  reinitialiserTentatives(ip);
  res.setHeader('set-cookie', cookieSession(req, creerJeton()));
  if (type.includes('application/json')) {
    envoyerJson(res, 200, { ok: true, suite });
  } else {
    res.writeHead(303, { location: suite, 'cache-control': 'no-store' });
    res.end();
  }
}

function creerServeur() {
  demarrerDiffusion();
  const serveur = http.createServer(async (req, res) => {
    for (const [cle, valeur] of Object.entries(ENTETES_SECURITE)) res.setHeader(cle, valeur);
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      envoyerTexte(res, 400, 'Requête invalide');
      return;
    }
    let chemin;
    try {
      chemin = decodeURIComponent(url.pathname);
    } catch {
      envoyerTexte(res, 400, 'Chemin invalide');
      return;
    }

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { allow: 'GET,POST,PUT,DELETE,OPTIONS' });
        res.end();
        return;
      }

      if (chemin === '/api/auth/connexion' && req.method === 'POST') {
        await traiterConnexion(req, res);
        return;
      }

      if (chemin === '/api/auth/deconnexion' && req.method === 'POST') {
        res.setHeader('set-cookie', cookieSupprime(req));
        envoyerJson(res, 200, { ok: true });
        return;
      }

      if (chemin === '/api/auth/session' && req.method === 'GET') {
        envoyerJson(res, 200, sessionCourante(req));
        return;
      }

      if (chemin === '/healthz' || chemin === '/readyz') {
        let pret = true;
        try {
          etatPublic();
        } catch {
          pret = false;
        }
        envoyerJson(res, pret ? 200 : 503, {
          statut: pret ? 'ok' : 'indisponible',
          version: config.version,
          environnement: config.environnement,
          heure: new Date().toISOString(),
        });
        return;
      }

      // Lien de suivi : public (c'est un lien partagé), puis redirection.
      if (chemin.startsWith('/l/') && req.method === 'GET') {
        const code = chemin.slice(3).replace(/\/+$/, '');
        const resultat = enregistrerClic({
          code,
          referent: String(req.headers.referer || ''),
          pays: String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || ''),
        });
        if (!resultat) {
          res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
          res.end(pageErreur({ statut: 404, titre: 'Lien introuvable', message: 'Ce lien n’existe plus.' }));
          return;
        }
        res.writeHead(302, { location: resultat.url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        res.end();
        return;
      }

      if (authActive() && !PUBLIQUES.has(chemin) && !sessionCourante(req).authentifie) {
        if (chemin.startsWith('/api/')) {
          envoyerJson(res, 401, { erreur: 'Authentification requise' });
        } else {
          res.writeHead(303, { location: `/connexion?suite=${encodeURIComponent(chemin + url.search)}`, 'cache-control': 'no-store' });
          res.end();
        }
        return;
      }

      if (chemin === '/connexion' && req.method === 'GET') {
        if (sessionCourante(req).authentifie) {
          res.writeHead(303, { location: '/' });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(pageConnexion({ suite: suiteSure(url.searchParams.get('suite')) }));
        return;
      }

      if (chemin === '/api/stream' && req.method === 'GET') {
        ouvrirFlux(req, res);
        return;
      }

      if (chemin.startsWith('/api/')) {
        await routesApi(req, res, chemin, url);
        return;
      }

      if (chemin.startsWith('/media/')) {
        const relatif = chemin.slice('/media/'.length);
        const servi = servirFichier(res, config.dossierDrive, relatif, { cacheControle: 'public, max-age=3600' });
        if (!servi) envoyerTexte(res, 404, 'Média introuvable');
        return;
      }

      if (chemin.startsWith('/rapports/')) {
        const relatif = chemin.slice('/rapports/'.length);
        const servi = servirFichier(res, config.dossierRapports, relatif, { download: url.searchParams.has('telecharger') });
        if (!servi) envoyerTexte(res, 404, 'Rapport introuvable');
        return;
      }

      const relatif = chemin === '/' ? 'index.html' : chemin.replace(/^\/+/, '');
      const servi = servirFichier(res, config.dossierPublic, relatif, {
        cacheControle: relatif === 'index.html' ? 'no-cache' : 'public, max-age=300',
      });
      if (!servi) {
        envoyerTexte(
          res,
          404,
          `Page introuvable. Les routes de l’interface sont accessibles via /#/… (ex. /#/statistiques).`,
          'text/plain; charset=utf-8',
        );
      }
    } catch (erreur) {
      if (erreur instanceof ErreurHttp) {
        envoyerJson(res, erreur.statut, { erreur: erreur.message, details: erreur.details || null });
        return;
      }
      console.error(`[insta-va] ${req.method} ${chemin} —`, erreur);
      if (chemin.startsWith('/api/')) {
        envoyerJson(res, 500, { erreur: 'Erreur interne du serveur' });
      } else {
        res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
        res.end(pageErreur({ statut: 500, titre: 'Erreur interne', message: 'La console a rencontré un problème.' }));
      }
    }
  });
  serveur.on('clientError', (erreur, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
  return serveur;
}

export { creerServeur };

export function cheminRelatifPublic(...segments) {
  return path.join(config.dossierPublic, ...segments);
}
