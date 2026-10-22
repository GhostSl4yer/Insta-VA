/** Générateur pseudo-aléatoire déterministe (mulberry32) : rend la simulation reproductible. */
export function creerAlea(graine = 1) {
  let a = graine >>> 0;
  const suivant = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  suivant.entier = (min, max) => Math.floor(suivant() * (max - min + 1)) + min;
  suivant.entre = (min, max) => suivant() * (max - min) + min;
  suivant.choisir = (tableau) => tableau[Math.floor(suivant() * tableau.length)];
  suivant.probabilite = (p) => suivant() < p;
  suivant.bruit = (amplitude = 1) => (suivant() - 0.5) * 2 * amplitude;
  suivant.graine = () => a >>> 0;
  return suivant;
}

export function arrondi(valeur, decimales = 0) {
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
}

export function borner(valeur, min, max) {
  return Math.min(max, Math.max(min, valeur));
}
