/* Helpers d'interface : formatage, graphiques SVG, markdown, modale, toasts. */

export const $ = (selecteur, racine = document) => racine.querySelector(selecteur);
export const $$ = (selecteur, racine = document) => [...racine.querySelectorAll(selecteur)];

export const echapper = (texte) =>
  String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const nf = (n, decimales = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: 0 }).format(Number(n) || 0);

export const pc = (n, decimales = 1) => `${nf(n, decimales)} %`;

export function heureFr(iso, { avecDate = false } = {}) {
  if (!iso) return '—';
  try {
    const date = new Date(String(iso).length <= 19 ? `${iso}Z` : iso);
    if (Number.isNaN(date.getTime())) return iso;
    const options = avecDate
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  } catch {
    return iso;
  }
}

export function dateFr(date, options = {}) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: options.compact ? undefined : 'long',
      day: '2-digit',
      month: options.court ? 'short' : 'long',
      ...(options.annee ? { year: 'numeric' } : {}),
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}

export function minutesEnTexte(secondes) {
  const minutes = Math.round((Number(secondes) || 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export const DRAPEAUX = {
  USA: '🇺🇸',
  France: '🇫🇷',
  RoyaumeUni: '🇬🇧',
  Allemagne: '🇩🇪',
  Pologne: '🇵🇱',
  AutresPays: '🌍',
  HorsZone: '🚫',
};

export const NOMS_PAYS = {
  USA: 'États-Unis',
  France: 'France',
  RoyaumeUni: 'Royaume-Uni',
  Allemagne: 'Allemagne',
  Pologne: 'Pologne',
  AutresPays: 'Autres pays',
  HorsZone: 'Hors zone',
};

export const drapeau = (pays) => DRAPEAUX[pays] || '🌍';
export const nomPays = (pays) => NOMS_PAYS[pays] || pays || '—';

const CLASSES_BADGE = {
  Publiee: 'mint', Publie: 'mint', Effectue: 'mint', Effectuée: 'mint', Termine: 'mint', Actif: 'mint',
  Terminé: 'mint', Effectué: 'mint', Qualifie: 'mint', Configuré: 'mint', Résolue: 'mint', envoye: 'mint',
  Planifie: 'bleu', Planifiee: 'bleu', Planifiée: 'bleu', Telecharge: 'bleu', Téléchargé: 'bleu',
  EnCours: 'violet', 'En cours': 'violet', Nouveau: 'violet', Analyse: 'bleu', Analysé: 'bleu',
  Archive: 'gris', Archivé: 'gris', Ignore: 'gris', Ignoré: 'gris', Suspendu: 'ambre',
  Echec: 'rouge', Échec: 'rouge', Rejete: 'rouge', Rejeté: 'rouge', Ouverte: 'rouge', Urgente: 'rouge', Critique: 'rouge',
  Avertissement: 'ambre', Reporte: 'ambre', Reporté: 'ambre', Suivi: 'rose', Relance: 'rose', Relancé: 'rose',
  Haute: 'ambre', Normale: 'bleu', Basse: 'gris', Info: 'bleu', NonCommence: 'gris', 'Non commencé': 'gris',
};

export function badge(libelle, classe = null) {
  const variante = classe || CLASSES_BADGE[libelle] || 'gris';
  return `<span class="badge ${variante}">${echapper(libelle)}</span>`;
}

export const badgeType = (type) => {
  const map = {
    Reel: ['rose', 'Reel'],
    Story: ['violet', 'Story'],
    UnePleine: ['ambre', 'Une'],
    PhotoProfil: ['bleu', 'Profil'],
  };
  const [classe, libelle] = map[type] || ['gris', type];
  return `<span class="badge ${classe}">${libelle}</span>`;
};

export const badgeStatut = (statut) => badge(statut);

/* ─────────────────────────── graphiques ─────────────────────────── */

export function courbe(points, { largeur = 720, hauteur = 220, cle = 'valeur', couleur = 'currentColor', etiquette = 'valeur', format = nf } = {}) {
  if (!points?.length) return `<div class="vide">Aucune donnée sur la période.</div>`;
  const marges = { haut: 14, droite: 12, bas: 26, gauche: 44 };
  const largeurUtile = largeur - marges.gauche - marges.droite;
  const hauteurUtile = hauteur - marges.haut - marges.bas;
  const valeurs = points.map((p) => Number(p[cle]) || 0);
  const max = Math.max(...valeurs, 1);
  const min = 0;
  const x = (i) => marges.gauche + (points.length === 1 ? largeurUtile / 2 : (i / (points.length - 1)) * largeurUtile);
  const y = (v) => marges.haut + hauteurUtile - ((v - min) / (max - min || 1)) * hauteurUtile;
  const chemin = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Number(p[cle]) || 0).toFixed(1)}`).join(' ');
  const aire = `${chemin} L ${x(points.length - 1).toFixed(1)} ${marges.haut + hauteurUtile} L ${x(0).toFixed(1)} ${marges.haut + hauteurUtile} Z`;
  const lignesGrille = 4;
  const grille = Array.from({ length: lignesGrille + 1 }, (_, i) => {
    const valeur = min + ((max - min) / lignesGrille) * i;
    const yy = y(valeur);
    return `<line class="grille-ligne" x1="${marges.gauche}" y1="${yy.toFixed(1)}" x2="${largeur - marges.droite}" y2="${yy.toFixed(1)}"/>
      <text class="axe" x="${marges.gauche - 8}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${format(valeur)}</text>`;
  }).join('');
  const pasEtiquette = Math.max(1, Math.ceil(points.length / 7));
  const etiquettes = points
    .map((p, i) =>
      i % pasEtiquette === 0 || i === points.length - 1
        ? `<text class="axe" x="${x(i).toFixed(1)}" y="${hauteur - 8}" text-anchor="middle">${echapper(String(p.label ?? p.date ?? '').slice(5))}</text>`
        : '',
    )
    .join('');
  const pointsDerniers = points
    .map((p, i) =>
      i === points.length - 1
        ? `<circle class="point" cx="${x(i).toFixed(1)}" cy="${y(Number(p[cle]) || 0).toFixed(1)}" r="4"/>`
        : '',
    )
    .join('');

  return `<svg class="graphique" viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="none" role="img" aria-label="Évolution de ${echapper(etiquette)}" style="color:${couleur}">
    ${grille}
    <path class="aire" d="${aire}"/>
    <path class="courbe" d="${chemin}"/>
    ${pointsDerniers}
    ${etiquettes}
  </svg>`;
}

export function barresPays(repartition = []) {
  if (!repartition.length) return `<div class="vide">Aucune interaction géolocalisée.</div>`;
  const max = Math.max(...repartition.map((p) => p.valeur), 1);
  return repartition
    .map(
      (p) => `<div class="barre-pays ${p.autorise === false ? 'hors' : ''}">
        <div>${drapeau(p.pays)} ${echapper(nomPays(p.pays))}</div>
        <div class="piste"><span style="width:${Math.max(3, (p.valeur / max) * 100).toFixed(1)}%"></span></div>
        <div class="valeur">${nf(p.valeur)} · ${nf(p.pourcentage, 0)}%</div>
      </div>`,
    )
    .join('');
}

export function anneau(progression, { taille = 128, epaisseur = 10, libelle = '', sous = '', couleur = 'currentColor' } = {}) {
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const valeur = Math.max(0, Math.min(100, Number(progression) || 0));
  const offset = circonference * (1 - valeur / 100);
  return `<div class="anneau" style="width:${taille}px;height:${taille}px">
    <svg width="${taille}" height="${taille}">
      <circle cx="${taille / 2}" cy="${taille / 2}" r="${rayon}" fill="none" stroke="var(--surface-3)" stroke-width="${epaisseur}"/>
      <circle cx="${taille / 2}" cy="${taille / 2}" r="${rayon}" fill="none" stroke="${couleur}" stroke-width="${epaisseur}"
        stroke-linecap="round" stroke-dasharray="${circonference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        style="transition: stroke-dashoffset .6s ease"/>
    </svg>
    <div class="anneau-centre"><b>${nf(valeur, 0)}%</b><span>${echapper(libelle)}${sous ? `<br>${echapper(sous)}` : ''}</span></div>
  </div>`;
}

export function miniBarres(valeurs = [], { couleur = 'currentColor', hauteur = 34, largeur = 120 } = {}) {
  if (!valeurs.length) return '';
  const max = Math.max(...valeurs, 1);
  const pas = largeur / valeurs.length;
  return `<svg width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" aria-hidden="true">
    ${valeurs
      .map((v, i) => {
        const h = Math.max(2, (v / max) * (hauteur - 4));
        return `<rect x="${(i * pas + 1).toFixed(1)}" y="${(hauteur - h).toFixed(1)}" width="${Math.max(2, pas - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${couleur}" opacity="${0.35 + (v / max) * 0.65}"/>`;
      })
      .join('')}
  </svg>`;
}

/* ─────────────────────────── markdown ─────────────────────────── */

export function markdown(source = '') {
  const lignes = String(source).split('\n');
  const sortie = [];
  let liste = null;
  let tableau = null;
  const fermer = () => {
    if (liste) {
      sortie.push(`</${liste}>`);
      liste = null;
    }
    if (tableau) {
      sortie.push('</tbody></table>');
      tableau = null;
    }
  };
  const enLigne = (texte) =>
    echapper(texte)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (const brute of lignes) {
    const ligne = brute.trimEnd();
    if (/^\|/.test(ligne)) {
      const cellules = ligne.split('|').slice(1, -1).map((c) => c.trim());
      if (/^\|[\s:|-]+\|$/.test(ligne.trim())) continue;
      if (!tableau) {
        fermer();
        tableau = true;
        sortie.push('<table><thead><tr>' + cellules.map((c) => `<th>${enLigne(c)}</th>`).join('') + '</tr></thead><tbody>');
      } else {
        sortie.push('<tr>' + cellules.map((c) => `<td>${enLigne(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    if (tableau) {
      sortie.push('</tbody></table>');
      tableau = null;
    }
    const titre = ligne.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      fermer();
      sortie.push(`<h${titre[1].length}>${enLigne(titre[2])}</h${titre[1].length}>`);
      continue;
    }
    if (/^---+$/.test(ligne.trim())) {
      fermer();
      sortie.push('<hr>');
      continue;
    }
    const puce = ligne.match(/^\s*[-*]\s+(.*)$/);
    if (puce) {
      if (liste !== 'ul') {
        fermer();
        liste = 'ul';
        sortie.push('<ul>');
      }
      sortie.push(`<li>${enLigne(puce[1])}</li>`);
      continue;
    }
    const numero = ligne.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numero) {
      if (liste !== 'ol') {
        fermer();
        liste = 'ol';
        sortie.push('<ol>');
      }
      sortie.push(`<li>${enLigne(numero[1])}</li>`);
      continue;
    }
    if (/^>\s?/.test(ligne)) {
      fermer();
      sortie.push(`<blockquote>${enLigne(ligne.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    fermer();
    if (ligne.trim()) sortie.push(`<p>${enLigne(ligne)}</p>`);
  }
  fermer();
  return `<div class="markdown">${sortie.join('\n')}</div>`;
}

/* ─────────────────────────── modale & toasts ─────────────────────────── */

let voileActif = null;

export function modale({ titre, corps, pied = '', largeur = 920, surFermeture = null }) {
  fermerModale();
  const voile = document.createElement('div');
  voile.className = 'voile';
  voile.innerHTML = `
    <div class="modale" style="width:min(${largeur}px,100%)" role="dialog" aria-modal="true">
      <div class="modale-entete">
        <div class="carte-titre" style="font-size:15px">${titre}</div>
        <button class="btn btn-fantome btn-icone" data-fermer aria-label="Fermer">✕</button>
      </div>
      <div class="modale-corps">${corps}</div>
      ${pied ? `<div class="modale-pied">${pied}</div>` : ''}
    </div>`;
  voile.addEventListener('click', (evenement) => {
    if (evenement.target === voile || evenement.target.closest('[data-fermer]')) fermerModale(surFermeture);
  });
  document.body.appendChild(voile);
  voileActif = voile;
  document.body.style.overflow = 'hidden';
  return voile;
}

export function fermerModale(surFermeture = null) {
  if (voileActif) {
    voileActif.remove();
    voileActif = null;
    document.body.style.overflow = '';
    if (typeof surFermeture === 'function') surFermeture();
  }
}

export function toast(message, { type = 'info', titre = null, duree = 4200 } = {}) {
  let zone = $('.toasts');
  if (!zone) {
    zone = document.createElement('div');
    zone.className = 'toasts';
    document.body.appendChild(zone);
  }
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  element.innerHTML = `<div>${titre ? `<b>${echapper(titre)}</b>` : ''}${echapper(message)}</div>`;
  zone.appendChild(element);
  setTimeout(() => {
    element.style.transition = 'opacity .25s, transform .25s';
    element.style.opacity = '0';
    element.style.transform = 'translateX(18px)';
    setTimeout(() => element.remove(), 260);
  }, duree);
}

export async function confirmer(message, { titre = 'Confirmer', danger = false, libelle = 'Confirmer' } = {}) {
  return new Promise((resolve) => {
    const voile = modale({
      titre: echapper(titre),
      corps: `<p style="margin:0;color:var(--encre-2)">${echapper(message)}</p>`,
      pied: `<button class="btn btn-fantome" data-annuler>Annuler</button>
             <button class="btn ${danger ? 'btn-danger' : 'btn-primaire'}" data-confirmer>${echapper(libelle)}</button>`,
      largeur: 520,
      surFermeture: () => resolve(false),
    });
    voile.querySelector('[data-confirmer]').addEventListener('click', () => {
      voile.remove();
      voileActif = null;
      document.body.style.overflow = '';
      resolve(true);
    });
    voile.querySelector('[data-annuler]').addEventListener('click', () => {
      fermerModale();
      resolve(false);
    });
  });
}

/* ─────────────────────────── divers ─────────────────────────── */

export function tempsRelatif(iso) {
  if (!iso) return '—';
  const date = new Date(String(iso).length <= 19 ? `${iso}Z` : iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 45) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`;
  return `il y a ${Math.round(diff / 86400)} j`;
}

export function vide(titre, texte = '') {
  return `<div class="vide"><b>${echapper(titre)}</b>${texte ? echapper(texte) : ''}</div>`;
}

export function squelette(hauteur = 120) {
  return `<div class="skeleton" style="height:${hauteur}px"></div>`;
}

export function surligner(texte, recherche) {
  if (!recherche) return echapper(texte);
  const motif = new RegExp(`(${recherche.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return echapper(texte).replace(motif, '<mark style="background:var(--surface-3);color:var(--encre);border-radius:3px">$1</mark>');
}

export const telecharger = (nom, contenu, type = 'text/plain') => {
  const blob = new Blob([contenu], { type });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
};
