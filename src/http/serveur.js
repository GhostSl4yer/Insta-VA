import http from 'node:http';
import path from 'node:path';
import { config } from '../config.js';
import { routesApi } from './api.js';
import { ErreurHttp, envoyerJson, envoyerTexte, servirFichier } from '../utils/http.js';
import { etatPublic } from '../domaine/moteur.js';

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
};

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
      envoyerJson(res, 500, { erreur: 'Erreur interne du serveur', detail: erreur.message });
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
