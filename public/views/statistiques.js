import { echapper, nf, pc, badgeType, badge, courbe, barresPays, anneau, dateFr, vide, drapeau, nomPays } from '../lib/ui.js';
import { entete, carte, kpi, brancherActions, brancherFiltres, tableau } from './commun.js';

const PERIODES = [
  { valeur: 'semaine', libelle: '7 jours' },
  { valeur: 'mois', libelle: '30 jours' },
  { valeur: 'jour', libelle: "Aujourd'hui" },
];

export default {
  titre: 'Statistiques',
  async rendre(ctx) {
    const periode = ctx.params.periode || 'mois';
    const donnees = await ctx.api(`/api/statistiques?periode=${periode}`);
    const { agregat, serie, pays, top, kpis, courbe: abonnes } = donnees;
    const points = serie.map((l) => ({ label: l.date, valeur: l.portee }));
    const pointsLikes = serie.map((l) => ({ label: l.date, valeur: l.likes }));
    const variations = serie.map((l) => ({ label: l.date, valeur: l.abonnesGagnes }));

    const lignesTop = top.map(
      (p) => `<tr>
        <td style="width:52px"><div style="width:38px;height:48px;border-radius:7px;overflow:hidden;background:var(--surface-2)">${p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : ''}</div></td>
        <td><div style="font-weight:600;font-size:12.5px;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${echapper(p.extrait || '')}</div>
          <div class="tiny muet">${dateFr(p.jour, { court: true })}</div></td>
        <td>${badgeType(p.type)}</td>
        <td class="num">${nf(p.likes)}</td>
        <td class="num">${nf(p.commentaires)}</td>
        <td class="num">${nf(p.portee)}</td>
      </tr>`,
    );

    const parPays = pays.length
      ? barresPays(pays)
      : vide('Aucune interaction géolocalisée');

    const paysHors = pays.filter((p) => !p.autorise);

    return `${entete(
      'Statistiques',
      'Portée, engagement, abonnés et répartition géographique — uniquement des audiences des pays autorisés (R7).',
      `<div class="onglets">${PERIODES.map(
        (p) => `<button class="onglet ${periode === p.valeur ? 'actif' : ''}" data-action="periode" data-periode="${p.valeur}">${p.libelle}</button>`,
      ).join('')}</div>`,
    )}

    <div class="grille g5">
      ${kpi('Portée', nf(agregat.portee), `${nf(agregat.moyennePortee)} / jour`, { progression: Math.min(100, (agregat.moyennePortee / 800) * 100) })}
      ${kpi('Vues', nf(agregat.vues), `${nf(agregat.moyenneVues)} / jour`)}
      ${kpi('Engagement', pc(agregat.engagement), `cible ${kpis.cibleEngagement} %`, { progression: Math.min(100, (agregat.engagement / kpis.cibleEngagement) * 100), couleur: agregat.engagement >= kpis.cibleEngagement ? 'mint' : 'ambre' })}
      ${kpi('Abonnés gagnés', `+${nf(agregat.abonnesGagnes)}`, `${nf(kpis.abonnes)} au total`, { progression: kpis.progressionAbonnes, couleur: 'mint' })}
      ${kpi('Interactions', nf(agregat.interactions), `${nf(agregat.publications)} publication(s)`)}
    </div>

    <div class="grille g-2-1 mt-16">
      ${carte(
        'Portée & likes',
        `${courbe(points, { hauteur: 230, etiquette: 'portée' })}
         <div class="legende-graph"><span><i style="background:var(--encre)"></i>portée / jour</span><span><i style="background:var(--muet-2)"></i>likes cumulés : ${nf(agregat.likes)}</span></div>
         <div class="sep"></div>
         <div class="carte-sous" style="margin-bottom:6px">Likes par jour</div>
         ${courbe(pointsLikes, { hauteur: 130, couleur: 'var(--muet)', etiquette: 'likes' })}`,
        { sous: `${dateFr(agregat.debut, { court: true })} → ${dateFr(agregat.fin, { court: true })} · ${agregat.jours} jour(s)`, actions: `<span class="badge violet">${periode}</span>` },
      )}
      ${carte(
        'Croissance des abonnés',
        `<div class="flex gap-16" style="align-items:center">
          ${anneau(kpis.progressionAbonnes, { taille: 118, libelle: 'objectif' })}
          <div class="flex-col gap-6">
            <div class="mini-stat"><b>${nf(kpis.abonnes)}</b><span>abonnés actuellement</span></div>
            <div class="mini-stat"><b>+${nf(agregat.abonnesGagnes)}</b><span>sur la période</span></div>
            <div class="mini-stat"><b>${nf(kpis.cibleAbonnes)}</b><span>objectif du cycle</span></div>
          </div>
        </div>
        <div class="sep"></div>
        <div class="carte-sous" style="margin-bottom:6px">Abonnés gagnés / jour</div>
        ${courbe(variations, { hauteur: 120, couleur: 'var(--encre)', etiquette: 'abonnés' })}`,
      )}
    </div>

    <div class="grille g2 mt-16">
      ${carte(
        'Audience par pays',
        `${parPays}
         <div class="sep"></div>
         <div class="flex wrap gap-8">
           <span class="badge mint">${pays.filter((p) => p.autorise).length} pays autorisés</span>
           ${paysHors.length ? `<span class="badge rouge">${paysHors.length} pays hors zone détecté(s)</span>` : `<span class="badge gris">aucun pays hors zone</span>`}
         </div>`,
        { sous: 'Les interactions hors zone sont ignorées par le moteur' },
      )}
      ${carte(
        'Performance par thème',
        `<div class="flex-col gap-8">${['fitness', 'nutrition', 'running', 'bienetre', 'ia']
          .map((theme) => {
            const pubs = top.filter((p) => p.theme === theme);
            const total = pubs.reduce((s, p) => s + p.likes + p.commentaires, 0);
            const max = Math.max(1, ...['fitness', 'nutrition', 'running', 'bienetre', 'ia'].map((t) => top.filter((p) => p.theme === t).reduce((s, p) => s + p.likes + p.commentaires, 0)));
            const emoji = { fitness: '🏋️', nutrition: '🥗', running: '🏃', bienetre: '🧘', ia: '🤖' }[theme];
            const libelle = { fitness: 'Fitness', nutrition: 'Nutrition', running: 'Running', bienetre: 'Bien-être', ia: 'IA' }[theme];
            return `<div class="flex gap-8"><span class="small" style="flex:0 0 112px">${emoji} ${libelle}</span>
              <div class="progression" style="flex:1;height:8px"><span style="width:${(total / max) * 100}%"></span></div>
              <span class="mono tiny" style="flex:0 0 44px;text-align:right">${nf(total)}</span></div>`;
          })
          .join('')}</div>
         <div class="sep"></div>
         <div class="small muet">Le thème IA est publié au moins 1 jour sur 7 pour servir l’objectif final (promotion de l’avatar via le lien externe).</div>`,
      )}
    </div>

    ${carte(
      'Publications les plus performantes',
      tableau(
        ['', { libelle: 'Publication' }, { libelle: 'Format' }, { libelle: 'Likes', classe: 'num' }, { libelle: 'Commentaires', classe: 'num' }, { libelle: 'Portée', classe: 'num' }],
        lignesTop,
      ),
      { sous: `Top ${top.length} sur la période — classement par engagement pondéré` },
    )}

    ${carte(
      'Objectifs du cycle',
      `<div class="grille g4">
        ${kpi('Abonnés', `${nf(kpis.abonnes)} / ${nf(kpis.cibleAbonnes)}`, 'objectif 30 jours', { progression: kpis.progressionAbonnes, couleur: 'mint' })}
        ${kpi('Engagement', pc(agregat.engagement), `cible ${kpis.cibleEngagement} %`, { progression: Math.min(100, (agregat.engagement / kpis.cibleEngagement) * 100) })}
        ${kpi('Portée', nf(agregat.portee), 'objectif 22 000 / 30 j', { progression: Math.min(100, (agregat.portee / 22000) * 100) })}
        ${kpi('Commentaires', nf(agregat.commentaires), 'objectif 420 / 30 j', { progression: Math.min(100, (agregat.commentaires / 420) * 100) })}
      </div>`,
      { classe: 'mt-16' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async periode(bouton) {
        ctx.params.periode = bouton.dataset.periode;
        await ctx.rafraichir();
      },
    });
  },
};
