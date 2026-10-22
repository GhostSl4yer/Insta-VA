import { echapper, nf, badge, badgeType, dateFr, vide, heureFr } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherActions, brancherFiltres, tableau } from './commun.js';

const STATUTS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'Planifiee', libelle: 'Planifiées' },
  { valeur: 'Publiee', libelle: 'Publiées' },
  { valeur: 'Echec', libelle: 'En échec' },
  { valeur: 'Supprimee', libelle: 'Supprimées' },
];

const TYPES = [
  { valeur: '', libelle: 'Tous les formats' },
  { valeur: 'Reel', libelle: 'Reels' },
  { valeur: 'Story', libelle: 'Stories' },
  { valeur: 'UnePleine', libelle: 'Unes' },
];

export default {
  titre: 'Publications',
  async rendre(ctx) {
    const params = new URLSearchParams({
      statut: ctx.params.statut || '',
      type: ctx.params.type || '',
      jour: ctx.params.jour || '',
      limite: '150',
    });
    const { publications } = await ctx.api(`/api/publications?${params}`);
    const publiees = publications.filter((p) => p.statut === 'Publiee');
    const planifiees = publications.filter((p) => p.statut === 'Planifiee');
    const likes = publiees.reduce((s, p) => s + p.likes, 0);
    const portee = publiees.reduce((s, p) => s + p.portee, 0);
    const engagement = portee ? ((publiees.reduce((s, p) => s + p.likes + p.commentaires, 0) / portee) * 100).toFixed(1) : '0';

    const lignes = publications.map(
      (p) => `<tr>
        <td style="width:54px"><div style="width:40px;height:50px;border-radius:7px;overflow:hidden;background:var(--surface-2)">${
          p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : ''
        }</div></td>
        <td style="min-width:240px">
          <div style="font-weight:600;font-size:12.5px;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${echapper((p.contenu || '').split('\n')[0].slice(0, 90))}</div>
          <div class="tiny muet">${echapper((p.contenu || '').split('\n').find((l) => l.trim() && !l.startsWith('#')) || '')}</div>
        </td>
        <td>${badgeType(p.type)}</td>
        <td class="serre mono tiny">${p.dateHeure.slice(11, 16)}<div class="muet">${dateFr(p.jour, { court: true })}</div></td>
        <td>${badge(p.statut)}</td>
        <td class="num">${nf(p.likes)}</td>
        <td class="num">${nf(p.commentaires)}</td>
        <td class="num">${nf(p.portee)}</td>
        <td class="droite serre">
          ${p.statut === 'Planifiee' ? `<button class="btn btn-petit btn-primaire" data-action="publier" data-id="${p.id}">Publier</button>` : ''}
          ${p.lien ? `<a class="btn btn-petit btn-fantome" href="${p.lien}" target="_blank" rel="noopener">Voir</a>` : ''}
          ${p.statut !== 'Supprimee' && p.statut !== 'Publiee' ? `<button class="btn btn-petit btn-danger" data-action="supprimer" data-id="${p.id}">Retirer</button>` : ''}
        </td>
      </tr>`,
    );

    return `${entete(
      'Publications',
      'Planning et historique des publications — uniquement dans la fenêtre autorisée 16 h → 00 h (R8).',
      `<button class="btn btn-fantome" data-action="jour">Aujourd’hui</button>
       <button class="btn btn-primaire" data-action="fin-jour">Forcer la fin de journée</button>`,
    )}

    <div class="grille g4">
      ${kpi('Publiées', nf(publiees.length), `sur ${publications.length} publications`)}
      ${kpi('Planifiées', nf(planifiees.length), 'prêtes pour la fenêtre 16 h–00 h')}
      ${kpi('Portée cumulée', nf(portee), `${nf(likes)} likes · ${engagement} % engagement`)}
      ${kpi('Vues cumulées', nf(publiees.reduce((s, p) => s + p.vues, 0)), 'Reels & Unes')}
    </div>

    ${carte(
      'Planning & historique',
      `<div class="filtres" style="margin-bottom:14px">
        ${selecteur('statut', STATUTS, ctx.params.statut || '')}
        ${selecteur('type', TYPES, ctx.params.type || '')}
        <label class="field" style="gap:0"><span class="tiny muet">Journée</span><input class="input" type="date" data-filtre="jour" value="${echapper(ctx.params.jour || '')}"/></label>
        <span class="small muet">${nf(publications.length)} publication(s)</span>
      </div>
      ${tableau(
        [
          '',
          { libelle: 'Contenu' },
          { libelle: 'Format' },
          { libelle: 'Heure' },
          { libelle: 'Statut' },
          { libelle: 'Likes', classe: 'num' },
          { libelle: 'Comm.', classe: 'num' },
          { libelle: 'Portée', classe: 'num' },
          { libelle: '', classe: 'droite' },
        ],
        lignes,
      )}`,
      { sous: 'Chaque publication est planifiée à partir d’un contenu du Drive' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());
    brancherActions(racine, ctx, {
      async publier(bouton) {
        await ctx.api(`/api/publications/${bouton.dataset.id}/publier`, { method: 'POST' });
        ctx.toast('Publication envoyée.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async supprimer(bouton) {
        const ok = await ctx.confirmer('Retirer cette publication du planning ?', { danger: true, libelle: 'Retirer' });
        if (!ok) return;
        await ctx.api(`/api/publications/${bouton.dataset.id}`, { method: 'DELETE' });
        ctx.toast('Publication retirée du planning.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async jour() {
        ctx.params.jour = ctx.etat.horloge.date;
        await ctx.rafraichir();
      },
      async 'fin-jour'() {
        await ctx.api('/api/controle/fin-jour', { method: 'POST' });
        ctx.toast('Journée clôturée.', { type: 'succes' });
        await ctx.rafraichir();
      },
    });
  },
};
