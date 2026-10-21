import { echapper, nf, badge, drapeau, nomPays, vide, tempsRelatif } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherActions, brancherFiltres, tableau, pastilleAvatar } from './commun.js';

const STATUTS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'Nouveau', libelle: 'Nouveaux' },
  { valeur: 'Analyse', libelle: 'Analysés' },
  { valeur: 'Qualifie', libelle: 'Qualifiés' },
  { valeur: 'Suivi', libelle: 'Suivis' },
  { valeur: 'Rejete', libelle: 'Rejetés' },
];

const PAYS = [
  { valeur: '', libelle: 'Tous les pays' },
  ...['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].map((p) => ({ valeur: p, libelle: `${drapeau(p)} ${nomPays(p)}` })),
];

const couleurScore = (score) => (score >= 70 ? 'mint' : score >= 55 ? '' : score >= 40 ? 'ambre' : 'ambre');

export default {
  titre: 'Cibles scorées',
  async rendre(ctx) {
    const params = new URLSearchParams({
      statut: ctx.params.statut || '',
      pays: ctx.params.pays || '',
      recherche: ctx.params.recherche || '',
      tri: ctx.params.tri || 'score',
      limite: '120',
    });
    const { cibles, statistiques, parStatut } = await ctx.api(`/api/cibles?${params}`);
    const qualifies = cibles.filter((c) => c.statut === 'Qualifie');
    const moyenne = cibles.length ? (cibles.reduce((s, c) => s + c.scoreAttractivite, 0) / cibles.length).toFixed(1) : '0';

    const lignes = cibles.map(
      (c) => `<tr>
        <td><div class="flex gap-8">${pastilleAvatar(c.username, 30)}
          <div style="min-width:0"><div style="font-weight:600;font-size:12.5px">@${echapper(c.username)} ${c.estReference ? '<span class="badge rose">référence</span>' : ''}</div>
          <div class="tiny muet" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${echapper(c.bio || c.nomAffichage)}</div></div></div></td>
        <td class="serre">${drapeau(c.pays)} ${echapper(nomPays(c.pays))}</td>
        <td class="serre">${c.trancheAge} <span class="muet tiny">(${c.age} ans)</span></td>
        <td class="num">${nf(c.nombreAbonnes)}</td>
        <td class="serre ${c.croissance >= 0 ? '' : 'muet'}">${c.croissance >= 0 ? '↗' : '↘'} ${nf(Math.abs(c.croissance), 1)} %</td>
        <td style="min-width:130px">
          <div class="flex gap-8"><span class="mono tiny" style="flex:0 0 34px">${nf(c.scoreAttractivite, 0)}</span>
          <div class="progression ${couleurScore(c.scoreAttractivite)}" style="flex:1;height:6px"><span style="width:${c.scoreAttractivite}%"></span></div></div>
        </td>
        <td>${badge(c.statut)}</td>
        <td class="droite serre">
          <button class="btn btn-petit btn-fantome" data-action="analyser" data-id="${c.id}">Analyser</button>
          ${c.statut !== 'Suivi' && c.statut !== 'Rejete' ? `<button class="btn btn-petit btn-primaire" data-action="suivre" data-id="${c.id}">Suivre</button>` : ''}
          <button class="btn btn-petit btn-fantome" data-action="detail" data-id="${c.id}">i</button>
        </td>
      </tr>`,
    );

    return `${entete(
      'Cibles scorées',
      'Avant toute interaction, chaque compte est filtré (pays autorisé, 25 ans minimum) puis scoré : intérêts, taille, croissance.',
      `<button class="btn btn-fantome" data-action="analyser-tout">Ré-analyser tout</button>
       <a class="btn btn-primaire" href="#/interactions">Voir les interactions</a>`,
    )}

    <div class="grille g5">
      ${kpi('Cibles en base', nf(statistiques.total), `${statistiques.references} comptes de référence`)}
      ${kpi('Qualifiées', nf(parStatut.Qualifie || 0), 'prêtes à être suivies', { progression: statistiques.total ? ((parStatut.Qualifie || 0) / statistiques.total) * 100 : 0, couleur: 'mint' })}
      ${kpi('Suivies', nf(statistiques.suivis), 'abonnements actifs', { progression: statistiques.total ? ((statistiques.suivis || 0) / statistiques.total) * 100 : 0 })}
      ${kpi('Rejetées', nf((parStatut.Rejete || 0)), 'hors zone ou score trop faible')}
      ${kpi('Score moyen', moyenne, 'sur 100')}
    </div>

    ${carte(
      'Explorateur de cibles',
      `<div class="filtres" style="margin-bottom:14px">
        ${selecteur('statut', STATUTS, ctx.params.statut || '')}
        ${selecteur('pays', PAYS, ctx.params.pays || '')}
        ${selecteur('tri', [
          { valeur: 'score', libelle: 'Trier par score' },
          { valeur: 'abonnes', libelle: 'Trier par abonnés' },
          { valeur: 'recent', libelle: 'Trier par date' },
        ], ctx.params.tri || 'score')}
        <input class="input" style="min-width:230px" placeholder="Rechercher un compte…" data-filtre-recherche="recherche" value="${echapper(ctx.params.recherche || '')}"/>
      </div>
      ${tableau(
        [
          { libelle: 'Compte' },
          { libelle: 'Pays' },
          { libelle: 'Âge' },
          { libelle: 'Abonnés', classe: 'num' },
          { libelle: 'Croissance' },
          { libelle: 'Score' },
          { libelle: 'Statut' },
          { libelle: '', classe: 'droite' },
        ],
        lignes,
      )}`,
      { sous: `${nf(cibles.length)} cible(s) affichée(s) · tri : ${ctx.params.tri || 'score'}` },
    )}

    <div class="grille g2 mt-16">
      ${carte(
        'Répartition par pays',
        `<div class="flex-col gap-6">${statistiques.parPays
          .map((p) => {
            const max = Math.max(...statistiques.parPays.map((x) => x.n), 1);
            const autorise = ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].includes(p.pays);
            return `<div class="barre-pays ${autorise ? '' : 'hors'}">
              <div>${drapeau(p.pays)} ${echapper(nomPays(p.pays))}</div>
              <div class="piste"><span style="width:${Math.max(3, (p.n / max) * 100)}%"></span></div>
              <div class="valeur">${p.n}</div>
            </div>`;
          })
          .join('')}</div>`,
        { sous: 'Les cibles hors zone sont rejetées automatiquement (R7)' },
      )}
      ${carte(
        'Comment le score est calculé',
        `<div class="flex-col gap-8 small">
          <div class="flex entre"><span class="muet">Correspondance personas / intérêts</span><strong>22 pts</strong></div>
          <div class="flex entre"><span class="muet">Taille de compte (8k–120k idéal)</span><strong>18 pts</strong></div>
          <div class="flex entre"><span class="muet">Croissance récente</span><strong>12 pts</strong></div>
          <div class="flex entre"><span class="muet">Pays autorisé (R7)</span><strong>26 pts</strong></div>
          <div class="flex entre"><span class="muet">Affinité thématique avatar (fitness, nutrition…)</span><strong>22 pts</strong></div>
          <div class="sep"></div>
          <div class="small muet">Un compte non qualifié n’est jamais suivi : il reste « analysé » ou « rejeté » et peut être réévalué plus tard.</div>
        </div>`,
      )}
    </div>
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());
    brancherActions(racine, ctx, {
      async analyser(bouton) {
        await ctx.api(`/api/cibles/${bouton.dataset.id}/analyser`, { method: 'POST' });
        ctx.toast('Cible ré-analysée.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async 'analyser-tout'() {
        const resultat = await ctx.api('/api/cibles/analyser-tout', { method: 'POST' });
        ctx.toast(`${resultat.analyses} cible(s) analysée(s).`, { type: 'succes', titre: 'Analyse terminée' });
        await ctx.rafraichir();
      },
      async suivre(bouton) {
        await ctx.api(`/api/cibles/${bouton.dataset.id}/suivre`, { method: 'POST' });
        ctx.toast('Compte suivi et enregistré dans les abonnements.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async detail(bouton) {
        const { cibles } = await ctx.api('/api/cibles?limite=200');
        const cible = cibles.find((c) => c.id === bouton.dataset.id);
        if (!cible) return;
        ctx.modale({
          titre: `@${cible.username}`,
          corps: `<div class="grille g2">
            <div>
              <div class="flex gap-12">${pastilleAvatar(cible.username, 54)}
                <div><div style="font-weight:700">${echapper(cible.nomAffichage)}</div>
                <div class="small muet">${echapper(cible.bio)}</div></div>
              </div>
              <div class="sep"></div>
              <div class="flex-col gap-6 small">
                <div class="flex entre"><span class="muet">Pays</span><span>${drapeau(cible.pays)} ${echapper(nomPays(cible.pays))}</span></div>
                <div class="flex entre"><span class="muet">Âge</span><span>${cible.age} ans (${cible.trancheAge})</span></div>
                <div class="flex entre"><span class="muet">Abonnés</span><span>${nf(cible.nombreAbonnes)}</span></div>
                <div class="flex entre"><span class="muet">Croissance</span><span>${nf(cible.croissance, 1)} %</span></div>
                <div class="flex entre"><span class="muet">Dernière analyse</span><span>${tempsRelatif(cible.derniereAnalyse)}</span></div>
                <div class="flex entre"><span class="muet">Statut</span>${badge(cible.statut)}</div>
              </div>
            </div>
            <div>
              <div class="carte-titre" style="margin-bottom:6px">Motif du score</div>
              <div class="small" style="background:rgba(4,6,12,.5);border:1px solid var(--line);border-radius:10px;padding:10px">${echapper(cible.motifStatut || '—')}</div>
              <div class="carte-titre mt-16" style="margin-bottom:6px">Intérêts détectés</div>
              <div class="flex wrap gap-6">${(cible.interets || []).map((i) => `<span class="badge violet">${echapper(i)}</span>`).join('')}</div>
              <div class="carte-titre mt-16" style="margin-bottom:6px">Filters appliqués</div>
              <div class="flex-col gap-4 small">
                <div class="flex entre"><span class="muet">R7 · pays autorisé</span>${['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'].includes(cible.pays) ? badge('Oui', 'mint') : badge('Non', 'rouge')}</div>
                <div class="flex entre"><span class="muet">R9 · 25 ans minimum</span>${cible.age >= 25 ? badge('Oui', 'mint') : badge('Non', 'rouge')}</div>
              </div>
            </div>
          </div>`,
          largeur: 760,
        });
      },
    });
  },
};
