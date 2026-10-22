import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Authentification de la console.
 *
 * - Activée dès qu'un mot de passe est fourni (`INSTAVA_MOT_DE_PASSE` ou
 *   `INSTAVA_MOT_DE_PASSE_HASH`). Sans mot de passe (mode développement), la
 *   console reste ouverte comme auparavant.
 * - Session sans état : cookie signé HMAC-SHA256, `HttpOnly`, `SameSite=Lax`,
 *   `Secure` en production.
 * - Le secret de signature vient de `INSTAVA_SECRET`, sinon il est généré une
 *   fois et conservé dans `DATA_DIR/.session` (0600).
 * - Limitation du nombre de tentatives par adresse IP.
 */

const NOM_COOKIE = 'instava_session';
const TENTATIVES_MAX = 8;
const FENETRE_MS = 15 * 60 * 1000;

const tentatives = new Map();
let secretMemoire = null;

export const authActive = () => Boolean(config.motDePasse || config.hashMotDePasse);

function secret() {
  if (secretMemoire) return secretMemoire;
  if (config.secretSession) {
    secretMemoire = Buffer.from(config.secretSession, 'utf8');
    return secretMemoire;
  }
  const fichier = path.join(config.dossierDonnees, '.session');
  try {
    if (fs.existsSync(fichier)) {
      secretMemoire = Buffer.from(fs.readFileSync(fichier, 'utf8').trim(), 'hex');
      if (secretMemoire.length >= 32) return secretMemoire;
    }
  } catch {
    /* ignore */
  }
  secretMemoire = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.writeFileSync(fichier, secretMemoire.toString('hex'), { mode: 0o600 });
  } catch {
    /* disque en lecture seule : le secret reste en mémoire */
  }
  return secretMemoire;
}

const egalConstant = (a, b) => {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
};

const sha256 = (valeur) => crypto.createHash('sha256').update(String(valeur), 'utf8').digest();

function verifierHash(candidat, stocke) {
  const [algo, n, r, p, sel, hash] = String(stocke).split('$');
  if (algo !== 'scrypt' || !sel || !hash) return false;
  const derive = crypto.scryptSync(candidat, Buffer.from(sel, 'hex'), Buffer.from(hash, 'hex').length, {
    N: Number(n) || 16384,
    r: Number(r) || 8,
    p: Number(p) || 1,
  });
  return egalConstant(derive.toString('hex'), hash);
}

export function verifierMotDePasse(candidat) {
  if (typeof candidat !== 'string' || !candidat) return false;
  if (config.hashMotDePasse) return verifierHash(candidat, config.hashMotDePasse);
  if (!config.motDePasse) return true;
  return egalConstant(sha256(candidat).toString('hex'), sha256(config.motDePasse).toString('hex'));
}

/** Génère un hash `scrypt$N$r$p$sel$hash` (utile pour `INSTAVA_MOT_DE_PASSE_HASH`). */
export function hacherMotDePasse(motDePasse, { N = 16384, r = 8, p = 1 } = {}) {
  const sel = crypto.randomBytes(16);
  const hash = crypto.scryptSync(motDePasse, sel, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${sel.toString('hex')}$${hash.toString('hex')}`;
}

/* ─────────────────────────── sessions ─────────────────────────── */

const signer = (charge) => crypto.createHmac('sha256', secret()).update(charge).digest('base64url');

export function creerJeton(millisecondes = config.sessionHeures * 3600 * 1000) {
  const expiration = Date.now() + millisecondes;
  const charge = `v1.${expiration}`;
  return `${charge}.${signer(charge)}`;
}

export function jetonValide(jeton) {
  if (!jeton || typeof jeton !== 'string') return false;
  const parties = jeton.split('.');
  if (parties.length !== 3 || parties[0] !== 'v1') return false;
  const charge = `${parties[0]}.${parties[1]}`;
  if (!egalConstant(parties[2], signer(charge))) return false;
  const expiration = Number(parties[1]);
  return Number.isFinite(expiration) && expiration > Date.now();
}

function lireCookies(req) {
  const brut = req.headers.cookie || '';
  const sortie = {};
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 0) continue;
    sortie[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim());
  }
  return sortie;
}

export function sessionCourante(req) {
  if (!authActive()) return { authentifie: true, expireLe: null };
  const jeton = lireCookies(req)[NOM_COOKIE];
  if (!jetonValide(jeton)) return { authentifie: false, expireLe: null };
  return { authentifie: true, expireLe: Number(jeton.split('.')[1]) };
}

const attributsCookie = (req) => {
  const parties = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  const proto = String(req?.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (config.forcerHttps || proto === 'https') parties.push('Secure');
  return parties.join('; ');
};

export function cookieSession(req, jeton) {
  return `${NOM_COOKIE}=${encodeURIComponent(jeton)}; ${attributsCookie(req)}; Max-Age=${config.sessionHeures * 3600}`;
}

export function cookieSupprime(req) {
  return `${NOM_COOKIE}=; ${attributsCookie(req)}; Max-Age=0`;
}

/* ───────────────────── limitation des tentatives ───────────────────── */

export function ipClient(req) {
  if (!config.derriereProxy) return req.socket?.remoteAddress || 'inconnue';
  const transmis = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return transmis || req.socket?.remoteAddress || 'inconnue';
}

export function tentativesRestantes(ip) {
  const entree = tentatives.get(ip);
  if (!entree || Date.now() > entree.reset) return TENTATIVES_MAX;
  return Math.max(0, TENTATIVES_MAX - entree.n);
}

export function enregistrerEchec(ip) {
  const maintenant = Date.now();
  const entree = tentatives.get(ip);
  if (!entree || maintenant > entree.reset) {
    tentatives.set(ip, { n: 1, reset: maintenant + FENETRE_MS });
    return;
  }
  entree.n += 1;
}

export function reinitialiserTentatives(ip) {
  tentatives.delete(ip);
}

export function oublierTentatives() {
  tentatives.clear();
}
