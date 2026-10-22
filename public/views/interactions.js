import { echapper, nf, badge, drapeau, nomPays, heureFr, vide, dateFr, minutesEnTexte } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherActions, brancherFiltres, pastilleAvatar, tableau } from './commun.js';

const SENS = [
  { valeur: '', libelle: 'Tout' },
  { valeur: 'sortante', libelle: 'Sortantes (bot)' },
  { valeur: 'entrante', libelle: 'Entrantes (audience)' },
];

const TYPES = [
  { valeur: '', libelle: 'Tous types' },
  { valeur: 'Like', libelle: 'Likes' },
  { valeur: 'Commentaire', libelle: 'Commentaires' },
  { valeur: 'Visionnage', libelle: 'Visionnages' },
  { valeur: 'Suivi', libelle: 'Suivis' },
];

const PAYS = [
  { valeur: '', libelle: 'Tous les pays' },
  ...['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].map((p) => ({ valeur: p, libelle: `${drapeau(p)} ${nomPays(p)}` })),
];

const COULEUR_TYPE = { Like: 'rose', Commentaire: 'violet', Visionnage: 'bleu', Suivi: 'mint' };

export default {
  titre: 'Interactions',
  async rendre(ctx) {
    const params = new URLSearchParams({
      sens: ctx.params.sens || '',
      type: ctx.params.type || '',
      pays: ctx.params.pays || '',
      date: ctx.params.date || '',
      limite: '150',
    });
    const { interactions, statistiques } = await ctx.api(`/api/interactions?${params}`);
    const commentaires = interactions.filter((i) => i.type === 'Commentaire');
    const suivis = interactions.filter((i) => i.type === 'Suivi');

    const lignes = interactions.map(
      (i) => `<tr>
        <td class="serre">${pastilleAvatar(i.entrante ? i.auteur : i.cible, 26, i.entrante ? 'douce' : 'pleine')}</td>
        <td style="min-width:140px"><div style="font-weight:600;font-size:12.5px">@${echapper(i.entrante ? i.auteur : i.cible)}</div>
          <div class="tiny muet">${i.entrante ? 'audience' : 'cible'} · ${drapeau(i.pays)} ${echapper(nomPays(i.pays))} ${i.age ? `· ${i.age} ans` : ''}</div></td>
        <td>${badge(i.type, COULEUR_TYPE[i.type] || 'gris')}</td>
        <td style="max-width:420px"><div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${echapper(i.contenu)}">${echapper(i.contenu || '—')}</div></td>
        <td class="serre mono tiny muet">${i.dateHeure.slice(11, 16)}<div>${dateFr(i.date, { court: true })}</div></td>
        <td>${badge(i.entrante ? 'Reçue' : 'Émise', i.entrante ? 'bleu' : 'violet')}</td>
      </tr>`,
    );

    const maxType = Math.max(1, ...Object.values(statistiques.parType));

    return `${entete(
      'Interactions',
      'Likes, commentaires, visionnages et suivis — jamais de message privé (R4). Chaque action est datée et rattachée à une cible qualifiée.',
      `<button class="btn btn-fantome" data-action="aujourdhui">Aujourd’hui</button>
       <button class="btn btn-primaire" data-action="avancer">Avancer de 30 min</button>`,
    )}

    <div class="grille g4">
      ${kpi('Total', nf(statistiques.total), 'toutes interactions')}
      ${kpi('Sortantes', nf(statistiques.sortantes), 'likes, commentaires, suivis')}
      ${kpi('Reçues', nf(statistiques.entrantes), 'réactions de l’audience')}
      ${kpi('Commentaires', nf(statistiques.parType.Commentaire || 0), `${nf(suivis.length)} suivi(s) · 0 DM`)}
    </div>

    <div class="grille g-sidebar mt-16">
      ${carte(
        'Journal des interactions',
        `<div class="filtres" style="margin-bottom:14px">
          ${selecteur('sens', SENS, ctx.params.sens || '')}
          ${selecteur('type', TYPES, ctx.params.type || '')}
          ${selecteur('pays', PAYS, ctx.params.pays || '')}
          <input class="input" type="date" data-filtre="date" value="${echapper(ctx.params.date || '')}"/>
          <span class="small muet">${nf(interactions.length)} interaction(s)</span>
        </div>
        ${tableau(
          ['', { libelle: 'Compte' }, { libelle: 'Type' }, { libelle: 'Contenu' }, { libelle: 'Quand' }, { libelle: 'Sens' }],
          lignes,
        )}`,
        { sous: 'Les cibles hors zone sont ignorées et tracées' },
      )}

      <div class="flex-col" style="gap:14px">
        ${carte(
          'Répartition par type',
          `<div class="flex-col gap-8">${['Like', 'Commentaire', 'Visionnage', 'Suivi']
            .map((type) => {
              const valeur = statistiques.parType[type] || 0;
              const couleur = { Like: 'var(--encre)', Commentaire: 'var(--encre-2)', Visionnage: 'var(--muet)', Suivi: 'var(--muet-2)' }[type];
              return `<div class="flex gap-8"><span class="small" style="flex:0 0 96px">${type}</span>
                <div class="progression" style="flex:1;height:8px"><span style="width:${(valeur / maxType) * 100}%;background:${couleur};box-shadow:none"></span></div>
                <span class="mono tiny" style="flex:0 0 40px;text-align:right">${nf(valeur)}</span></div>`;
            })
            .join('')}</div>`,
        )}
        ${carte(
          'Derniers commentaires',
          commentaires.length
            ? `<div class="liste">${commentaires
                .slice(0, 5)
                .map(
                  (c) => `<div class="ligne-liste">
                    ${pastilleAvatar(c.entrante ? c.auteur : c.cible, 28, c.entrante ? 'douce' : 'pleine')}
                    <div class="ligne-principal"><div class="ligne-titre" style="font-size:12px">@${echapper(c.entrante ? c.auteur : c.cible)}</div>
                      <div class="ligne-sous" style="white-space:normal;font-size:11.5px">${echapper(c.contenu)}</div></div>
                    <div class="ligne-droite"><span class="tiny muet">${heureFr(c.dateHeure)}</span></div>
                  </div>`,
                )
                .join('')}</div>`
            : vide('Aucun commentaire', 'Les commentaires sont générés lors des sessions.'),
        )}
        ${carte(
          'Statistiques par pays',
          `<div class="flex-col gap-4">${statistiques.parPays
            .slice(0, 6)
            .map((p) => {
              const max = Math.max(...statistiques.parPays.map((x) => x.n), 1);
              return `<div class="barre-pays"><div>${drapeau(p.pays)} ${echapper(nomPays(p.pays))}</div>
                <div class="piste"><span style="width:${(p.n / max) * 100}%"></span></div>
                <div class="valeur">${nf(p.n)}</div></div>`;
            })
            .join('') || '<div class="vide">Aucune donnée.</div>'}</div>`,
        )}
      </div>
    </div>
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());
    brancherActions(racine, ctx, {
      async aujourdhui() {
        ctx.params.date = ctx.etat.horloge.date;
        await ctx.rafraichir();
      },
      async avancer() {
        await ctx.api('/api/controle/avancer', { corps: { minutes: 30 } });
        ctx.toast('30 minutes simulées écoulées.', { type: 'succes' });
        await ctx.rafraichir();
      },
    });
  },
};
