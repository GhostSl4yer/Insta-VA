import { echapper, nf } from '../lib/ui.js';

export function entete(titre, sous, actions = '') {
  return `<div class="entete-page">
    <div><h1>${titre}</h1><p>${sous}</p></div>
    ${actions ? `<div class="entete-actions">${actions}</div>` : ''}
  </div>`;
}

export function carte(titre, corps, { sous = '', actions = '', zone = '', classe = '', icone = '' } = {}) {
  return `<div class="carte ${classe}" ${zone ? `data-zone="${zone}"` : ''}>
    <div class="carte-entete">
      <div>
        <div class="carte-titre">${icone}${titre}</div>
        ${sous ? `<div class="carte-sous">${sous}</div>` : ''}
      </div>
      ${actions ? `<div class="carte-actions">${actions}</div>` : ''}
    </div>
    ${corps}
  </div>`;
}

export function kpi(label, valeur, sous = '', { progression = null, couleur = '' } = {}) {
  return `<div class="carte"><div class="kpi">
    <span class="kpi-label">${label}</span>
    <div class="kpi-valeur">${valeur}</div>
    ${sous ? `<div class="kpi-delta neutre">${sous}</div>` : ''}
    ${progression !== null
      ? `<div class="progression ${couleur}" style="margin-top:6px"><span style="width:${Math.max(0, Math.min(100, progression))}%"></span></div>`
      : ''}
  </div></div>`;
}

export function tableau(entetes, lignes, { classe = '' } = {}) {
  return `<div class="tableau-zone"><table class="tableau ${classe}">
    <thead><tr>${entetes.map((e) => `<th${e.classe ? ` class="${e.classe}"` : ''}>${e.libelle ?? e}</th>`).join('')}</tr></thead>
    <tbody>${lignes.join('') || `<tr><td colspan="${entetes.length}"><div class="vide">Aucune ligne.</div></td></tr>`}</tbody>
  </table></div>`;
}

export function selecteur(nom, options, valeur, { libelle = '', className = 'select' } = {}) {
  return `<select class="${className}" data-filtre="${nom}" aria-label="${echapper(libelle || nom)}">
    ${options
      .map(
        (option) =>
          `<option value="${echapper(option.valeur)}" ${String(option.valeur) === String(valeur ?? '') ? 'selected' : ''}>${echapper(option.libelle)}</option>`,
      )
      .join('')}
  </select>`;
}

export function barreProgression(valeur, { couleur = '', hauteur = '' } = {}) {
  return `<div class="progression ${couleur}" ${hauteur ? `style="height:${hauteur}"` : ''}><span style="width:${Math.max(0, Math.min(100, valeur))}%"></span></div>`;
}

export function monogramme(nom = '?') {
  const lettres = String(nom)
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() || '')
    .join('');
  return lettres || '?';
}

export function pastilleAvatar(nom, taille = 34, variante = 'pleine') {
  return `<div class="pastille-avatar ${variante}" style="width:${taille}px;height:${taille}px;border-radius:${Math.round(taille / 3.4)}px;font-size:${Math.round(taille / 2.7)}px;flex:0 0 ${taille}px">${echapper(monogramme(nom))}</div>`;
}

export function nombre(n) {
  return nf(n);
}

export function jsonBloc(donnees) {
  return `<pre class="code" style="white-space:pre-wrap;overflow:auto;max-height:280px">${echapper(JSON.stringify(donnees, null, 2))}</pre>`;
}

/** Branche les actions `[data-action]` avec délégation d'événements. */
export function brancherActions(racine, ctx, gestionnaires) {
  racine.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('[data-action]');
    if (!bouton || !racine.contains(bouton)) return;
    const nom = bouton.dataset.action;
    const gestionnaire = gestionnaires[nom];
    if (!gestionnaire) return;
    evenement.preventDefault();
    if (bouton.disabled) return;
    bouton.disabled = true;
    try {
      await gestionnaire(bouton, evenement);
    } finally {
      bouton.disabled = false;
    }
  });
}

/** Branche les filtres `[data-filtre]` (select / input). */
export function brancherFiltres(racine, ctx, rappel) {
  let minuteur = null;
  racine.addEventListener('change', (evenement) => {
    const champ = evenement.target.closest('[data-filtre]');
    if (!champ) return;
    ctx.params[champ.dataset.filtre] = champ.value;
    rappel(champ.dataset.filtre, champ.value);
  });
  racine.addEventListener('input', (evenement) => {
    const champ = evenement.target.closest('[data-filtre-recherche]');
    if (!champ) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      ctx.params[champ.dataset.filtreRecherche] = champ.value;
      rappel(champ.dataset.filtreRecherche, champ.value);
    }, 260);
  });
}

export function modaleDetail(ctx, { titre, corps, pied = '', largeur = 780 }) {
  return ctx.modale({ titre, corps, pied, largeur });
}
