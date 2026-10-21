export function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function slug(texte, max = 48) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

export function tronquer(texte, max = 90) {
  const valeur = String(texte ?? '');
  if (valeur.length <= max) return valeur;
  return `${valeur.slice(0, max - 1).trimEnd()}…`;
}

export function capitaliser(texte) {
  const valeur = String(texte ?? '');
  return valeur.charAt(0).toUpperCase() + valeur.slice(1);
}

export function pluriel(n, singulier, plurielMot = `${singulier}s`) {
  return n > 1 ? plurielMot : singulier;
}

export function nombreFr(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));
}

export function pourcentageFr(n, decimales = 1) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(Number(n) || 0)} %`;
}
