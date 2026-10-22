import fs from 'node:fs';
import path from 'node:path';
import { PALETTES } from '../donnees/concepts.js';
import { creerAlea } from '../utils/alea.js';

const FORMATS = {
  Reel: { largeur: 1080, hauteur: 1920 },
  Story: { largeur: 1080, hauteur: 1920 },
  UnePleine: { largeur: 1080, hauteur: 1350 },
  PhotoProfil: { largeur: 420, hauteur: 420 },
};

const echapper = (texte) =>
  String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function interpoler(points, t) {
  const segments = points.length - 1;
  const position = Math.min(segments, Math.max(0, t * segments));
  const i = Math.min(segments - 1, Math.floor(position));
  const ratio = position - i;
  return ratio;
}

function degrade(id, couleurs, angle = 135) {
  const rad = (angle * Math.PI) / 180;
  const x2 = 0.5 + Math.cos(rad) / 2;
  const y2 = 0.5 + Math.sin(rad) / 2;
  return `<linearGradient id="${id}" x1="${0.5 - Math.cos(rad) / 2}" y1="${0.5 - Math.sin(rad) / 2}" x2="${x2}" y2="${y2}">
    <stop offset="0%" stop-color="${couleurs[0]}"/>
    <stop offset="100%" stop-color="${couleurs[1]}"/>
  </linearGradient>`;
}

function motif(id, couleur) {
  return `<pattern id="${id}" width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
    <circle cx="4" cy="4" r="1.4" fill="${couleur}" opacity="0.16"/>
  </pattern>`;
}

function texteMultiligne(lignes, { x, y, taille, interligne, poids = 800, remplissage, ancre = 'middle', famille = 'Inter, Helvetica Neue, Arial, sans-serif', espacement = '-0.02em' }) {
  return lignes
    .map(
      (ligne, i) =>
        `<text x="${x}" y="${y + i * interligne}" font-family="${famille}" font-size="${taille}" font-weight="${poids}" fill="${remplissage}" text-anchor="${ancre}" letter-spacing="${espacement}">${echapper(ligne)}</text>`,
    )
    .join('\n    ');
}

function monogramme(nom = 'Maya Rivera') {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() || '')
    .join('');
}

function piedDePage({ largeur, hauteur, palette, username, badge, note }) {
  const marge = 72;
  return `
    <g transform="translate(0, ${hauteur - 168})">
      <rect x="${marge}" y="0" width="${largeur - marge * 2}" height="96" rx="48" fill="${palette.accent}" opacity="0.34"/>
      <circle cx="${marge + 54}" cy="48" r="28" fill="${palette.halo}"/>
      <text x="${marge + 54}" y="58" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${palette.accent}" text-anchor="middle">${echapper(monogramme())}</text>
      <text x="${marge + 100}" y="44" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="${palette.texte}">@${echapper(username)}</text>
      <text x="${marge + 100}" y="74" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="500" fill="${palette.texte}" opacity="0.75">${echapper(note)}</text>
      <text x="${largeur - marge - 34}" y="58" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.halo}" text-anchor="end">${echapper(badge)}</text>
    </g>`;
}


/** Extrait 3 points clés de la légende pour composer une carte éditoriale. */
function extrairePoints(caption = '', max = 3) {
  const lignes = String(caption).split('\n');
  const points = [];
  for (const ligneBrute of lignes) {
    const ligne = ligneBrute.trim();
    if (!ligne) continue;
    const correspondance = ligne.match(/^(?:[•\-–]|\d[).])\s*(.+)$/);
    if (!correspondance) continue;
    let texte = correspondance[1].replace(/\s+/g, ' ').replace(/\*\*/g, '');
    if (texte.length > 52) texte = `${texte.slice(0, 50).trimEnd()}…`;
    points.push(texte);
    if (points.length >= max) break;
  }
  return points;
}

function cartePoints(points, { x, y, largeur, palette }) {
  if (!points.length) return '';
  const hauteur = 26 + points.length * 54 + 14;
  return `<g transform="translate(${x}, ${y})">
    <rect x="0" y="0" width="${largeur}" height="${hauteur}" rx="28" fill="${palette.accent}" opacity="0.34"/>
    <rect x="0" y="0" width="${largeur}" height="${hauteur}" rx="28" fill="none" stroke="${palette.halo}" stroke-opacity="0.35" stroke-width="2"/>
    ${points
      .map(
        (point, i) => `<g transform="translate(28, ${44 + i * 54})">
        <circle cx="6" cy="0" r="5" fill="${palette.halo}"/>
        <text x="26" y="8" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="${palette.texte}" opacity="0.95">${echapper(point)}</text>
      </g>`,
      )
      .join('')}
  </g>`;
}

/** Arc décoratif concentrique qui structure le visuel. */
function arcs({ x, y, rayon, couleur, opacite = 0.16 }) {
  return `<g fill="none" stroke="${couleur}" stroke-opacity="${opacite}" stroke-width="2">
      <circle cx="${x}" cy="${y}" r="${rayon}"/>
      <circle cx="${x}" cy="${y}" r="${rayon * 0.78}"/>
      <circle cx="${x}" cy="${y}" r="${rayon * 0.56}"/>
      <circle cx="${x}" cy="${y}" r="${rayon * 0.34}" fill="${couleur}" fill-opacity="0.10" stroke="none"/>
    </g>`;
}

function visuelReelStory({ largeur, hauteur, concept, palette, username, format }) {
  const alea = creerAlea(hashTexte(concept.titre) + concept.id.length * 31);
  const marge = 84;
  const lignes = String(concept.accroche).split('\n');
  const plusLongue = Math.max(...lignes.map((l) => l.length));
  const tailleMax = lignes.length > 2 ? 112 : 138;
  const taille = Math.max(64, Math.min(tailleMax, Math.floor((largeur - marge * 2) / (plusLongue * 0.56))));
  const haut = hauteur * 0.3;
  const rotation = alea.entre(-18, 18);
  const cercleX = largeur * (0.55 + alea.entre(-0.12, 0.12));
  const cercleY = hauteur * 0.22;
  const badge = format === 'Reel' ? 'REEL' : 'STORY';
  const points = extrairePoints(concept.caption);
  const yPoints = hauteur * 0.63;
  const note = format === 'Reel' ? (concept.musique?.titres || 'Son original') : 'Faites glisser ↑';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${echapper(concept.titre)}">
  <defs>
    ${degrade('fond', palette.fond, 145 + rotation / 6)}
    ${degrade('halo', [palette.halo, palette.fond[0]], 45)}
    ${motif('grain', palette.texte)}
    <filter id="flou"><feGaussianBlur stdDeviation="90"/></filter>
    <style>
      @keyframes derive { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(26px,-34px) scale(1.08); } 100% { transform: translate(0,0) scale(1); } }
      .bulle { animation: derive 14s ease-in-out infinite; transform-origin: center; }
      .ligne { animation: apparait 1.2s ease both; }
      .ligne:nth-child(2) { animation-delay: .18s; }
      .ligne:nth-child(3) { animation-delay: .36s; }
      @keyframes apparait { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .bulle, .ligne { animation: none; opacity: 1; } }
    </style>
  </defs>
  <rect width="${largeur}" height="${hauteur}" fill="url(#fond)"/>
  <g class="bulle" filter="url(#flou)" opacity="0.85">
    <circle cx="${cercleX}" cy="${cercleY}" r="${largeur * 0.52}" fill="url(#halo)" opacity="0.55"/>
    <circle cx="${largeur * 0.16}" cy="${hauteur * 0.72}" r="${largeur * 0.4}" fill="${palette.halo}" opacity="0.28"/>
  </g>
  <rect width="${largeur}" height="${hauteur}" fill="url(#grain)"/>
  <g opacity="0.9">
    <rect x="${marge}" y="${marge + 18}" width="${badge.length * 22 + 52}" height="56" rx="28" fill="${palette.accent}" opacity="0.34"/>
    <text x="${marge + 26}" y="${marge + 56}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${palette.texte}" letter-spacing="0.16em">${badge}</text>
    <text x="${largeur - marge}" y="${marge + 56}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="${palette.texte}" text-anchor="end" opacity="0.8">${echapper(concept.sousTitre || '')}</text>
  </g>
  <g>
    ${lignes
      .map(
        (ligne, i) =>
          `<text class="ligne" x="${marge}" y="${haut + i * (taille + 14)}" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="${taille}" font-weight="900" fill="${palette.texte}" letter-spacing="-0.035em">${echapper(ligne)}</text>`,
      )
      .join('\n    ')}
  </g>
  <g transform="translate(${marge}, ${haut + lignes.length * (taille + 14) + 46})">
    <rect x="0" y="0" width="${Math.min(largeur - marge * 2, 560)}" height="2" fill="${palette.texte}" opacity="0.5"/>
    <text x="0" y="56" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="${palette.texte}" opacity="0.9">${echapper(concept.punchline || 'Un pas de plus, chaque jour.')}</text>
  </g>
  ${cartePoints(points, { x: marge, y: yPoints, largeur: largeur - marge * 2, palette })}
  <g opacity="0.5">${arcs({ x: largeur - 60, y: hauteur * 0.52, rayon: 260, couleur: palette.halo, opacite: 0.22 })}</g>
  ${format === 'Story'
    ? `<g transform="translate(${largeur / 2}, ${hauteur - 300})">
        <rect x="-250" y="0" width="500" height="88" rx="44" fill="${palette.texte}" opacity="0.95"/>
        <text x="0" y="54" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="${palette.accent}" text-anchor="middle">Découvrir l’avatar ↗</text>
      </g>`
    : `<g transform="translate(${marge}, ${hauteur - 272})">
        <circle cx="18" cy="18" r="18" fill="${palette.texte}" opacity="0.9"/>
        <path d="M12 7 L26 18 L12 29 Z" fill="${palette.accent}"/>
        <text x="52" y="30" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="${palette.texte}" opacity="0.9">${echapper(note)}</text>
      </g>`}
  ${piedDePage({ largeur, hauteur, palette, username, badge: 'maya.rivera.fit', note: concept.themeLabel || '#coachmaya' })}
  ${format === 'Story' ? `<rect x="40" y="34" width="${(largeur - 80) * 0.42}" height="8" rx="4" fill="${palette.texte}" opacity="0.85"/>` : ''}
</svg>`;
}

function visuelUne({ largeur, hauteur, concept, palette, username }) {
  const marge = 92;
  const lignes = String(concept.accroche).split('\n');
  const plusLongue = Math.max(...lignes.map((l) => l.length));
  const taille = Math.max(62, Math.min(118, Math.floor((largeur - marge * 2) / (plusLongue * 0.56))));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${echapper(concept.titre)}">
  <defs>
    ${degrade('fondp', palette.fond, 160)}
    ${motif('grainp', palette.texte)}
    <filter id="floup"><feGaussianBlur stdDeviation="70"/></filter>
  </defs>
  <rect width="${largeur}" height="${hauteur}" fill="url(#fondp)"/>
  <circle cx="${largeur * 0.82}" cy="${hauteur * 0.18}" r="330" fill="${palette.halo}" opacity="0.6" filter="url(#floup)"/>
  <rect width="${largeur}" height="${hauteur}" fill="url(#grainp)"/>
  <text x="${marge}" y="${marge + 20}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${palette.texte}" letter-spacing="0.2em" opacity="0.85">UNE · ${echapper((concept.theme || '').toUpperCase())}</text>
  <g>
    ${lignes
      .map(
        (ligne, i) =>
          `<text x="${marge}" y="${hauteur * 0.36 + i * (taille + 12)}" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="${taille}" font-weight="900" fill="${palette.texte}" letter-spacing="-0.04em">${echapper(ligne)}</text>`,
      )
      .join('\n    ')}
  </g>
  ${cartePoints(extrairePoints(concept.caption, 3), { x: marge, y: hauteur - 640, largeur: largeur - marge * 2, palette })}
  <g opacity="0.5">${arcs({ x: largeur - 40, y: hauteur * 0.28, rayon: 280, couleur: palette.halo, opacite: 0.2 })}</g>
  <g transform="translate(${marge}, ${hauteur - 420})">
    <rect x="0" y="0" width="${largeur - marge * 2}" height="2" fill="${palette.texte}" opacity="0.45"/>
    <text x="0" y="70" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="600" fill="${palette.texte}" opacity="0.92">${echapper(concept.sousTitre || '')}</text>
    <text x="0" y="118" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="500" fill="${palette.texte}" opacity="0.7">${echapper(concept.punchline || '')}</text>
  </g>
  ${piedDePage({ largeur, hauteur, palette, username, badge: 'UNE', note: '#mayarivera' })}
</svg>`;
}

function visuelProfil({ largeur, hauteur, palette, avatar }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="Photo de profil de ${echapper(avatar.nom || 'Maya Rivera')}">
  <defs>
    ${degrade('fondf', [palette.fond[1], palette.fond[0]], 120)}
    ${degrade('halof', [palette.halo, palette.fond[0]], 60)}
    <radialGradient id="lumiere" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${largeur}" height="${hauteur}" fill="url(#fondf)"/>
  <circle cx="${largeur * 0.5}" cy="${hauteur * 0.5}" r="${largeur * 0.46}" fill="url(#halof)" opacity="0.55"/>
  <circle cx="${largeur / 2}" cy="${hauteur * 0.42}" r="${largeur * 0.15}" fill="${palette.texte}" opacity="0.9"/>
  <path d="M ${largeur * 0.24} ${hauteur * 0.94} Q ${largeur * 0.5} ${hauteur * 0.5} ${largeur * 0.76} ${hauteur * 0.94} Z" fill="${palette.texte}" opacity="0.92"/>
  <rect width="${largeur}" height="${hauteur}" fill="url(#lumiere)"/>
  <text x="${largeur - 26}" y="${hauteur - 26}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="${palette.accent}" text-anchor="end" opacity="0.85">${echapper(monogramme(avatar.nom))}</text>
</svg>`;
}

export function hashTexte(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function choisirPalette(graine) {
  const cles = Object.keys(PALETTES);
  return PALETTES[cles[hashTexte(String(graine)) % cles.length]];
}

export function genererSvg({ format = 'Reel', concept = {}, palette, username = 'maya.rivera.fit', avatar = {} }) {
  const dimensions = FORMATS[format] || FORMATS.Reel;
  const couleurs = palette || choisirPalette(concept.id || concept.titre || 'maya');
  if (format === 'PhotoProfil') {
    return visuelProfil({ ...dimensions, palette: couleurs, avatar });
  }
  if (format === 'UnePleine') {
    return visuelUne({ ...dimensions, concept, palette: couleurs, username });
  }
  return visuelReelStory({ ...dimensions, concept, palette: couleurs, username, format });
}

/** Écrit le visuel sur disque et renvoie le chemin relatif au dossier Drive. */
export function ecrireVisuel({ dossier, nomFichier, format, concept, avatar, username }) {
  const svg = genererSvg({ format, concept, username, avatar });
  const cible = path.join(dossier, nomFichier);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, svg, 'utf8');
  return cible;
}

export { FORMATS };
