import { echapper, nf, badge, dateFr, markdown, heureFr, vide } from '../lib/ui.js';
import { entete, carte, kpi, brancherActions } from './commun.js';

const TYPES = [
  { valeur: 'quotidien', libelle: 'Quotidien' },
  { valeur: 'hebdomadaire', libelle: 'Hebdomadaire' },
  { valeur: 'mensuel', libelle: 'Mensuel' },
  { valeur: 'fin_cycle', libelle: 'Bilan de cycle' },
];

export default {
  titre: 'Rapports',
  async rendre(ctx) {
    const { rapports, statistiques } = await ctx.api('/api/rapports?limite=60');
    const selectionId = ctx.params.id || rapports[0]?.id;
    let rapport = null;
    if (selectionId) {
      const resultat = await ctx.api(`/api/rapports/${selectionId}`);
      rapport = resultat.rapport;
    }

    const liste = rapports.length
      ? `<div class="liste">${rapports
          .map(
            (r) => `<div class="ligne-liste" style="cursor:pointer;${r.id === selectionId ? 'background:var(--surface-2);border-radius:6px;padding-left:8px;padding-right:8px' : ''}" data-action="ouvrir" data-id="${r.id}">
              <div class="ligne-principal">
                <div class="ligne-titre">${echapper(r.type === 'fin_cycle' ? 'Bilan de fin de cycle' : `Rapport ${r.type}`)}</div>
                <div class="ligne-sous">${dateFr(r.date)} · ${nf(r.statistiques.publications || 0)} publi. · ${nf(r.statistiques.interactions || 0)} interactions</div>
              </div>
              <div class="ligne-droite">${r.envoye ? badge('Transmis', 'mint') : badge('À envoyer', 'ambre')}</div>
            </div>`,
          )
          .join('')}</div>`
      : vide('Aucun rapport', 'Les rapports sont générés automatiquement à 23 h 52.');

    const detail = rapport
      ? `<div class="flex entre wrap gap-8" style="margin-bottom:10px">
          <div class="flex gap-8 wrap">${badge(rapport.type)} ${badge(rapport.envoye ? 'Transmis' : 'Non transmis', rapport.envoye ? 'mint' : 'ambre')}
            <span class="small muet">Généré le ${heureFr(rapport.genereLe, { avecDate: true })}</span></div>
          <div class="flex gap-6">
            <button class="btn btn-petit btn-fantome" data-action="export" data-id="${rapport.id}">Exporter (.md)</button>
            <button class="btn btn-petit btn-fantome" data-action="envoyer" data-id="${rapport.id}">Envoyer</button>
          </div>
        </div>
        <div style="max-height:620px;overflow:auto;padding-right:8px">${markdown(rapport.contenu)}</div>`
      : vide('Sélectionnez un rapport', 'Le contenu du rapport s’affichera ici.');

    return `${entete(
      'Rapports',
      'Rapport quotidien généré à la clôture, synthèse hebdomadaire, bilan mensuel et export Markdown pour le responsable.',
      `<button class="btn btn-fantome" data-action="generer" data-type="hebdomadaire">Rapport hebdo</button>
       <button class="btn btn-primaire" data-action="generer" data-type="quotidien">Générer le rapport du jour</button>`,
    )}

    <div class="grille g4">
      ${kpi('Rapports', nf(statistiques.total), 'quotidiens, hebdo, bilans')}
      ${kpi('Transmis', nf(statistiques.envoyes), 'au responsable')}
      ${kpi('En attente', nf(statistiques.enAttente), 'notification non envoyée')}
      ${kpi('Dernier rapport', rapports[0] ? dateFr(rapports[0].date, { court: true }) : '—', rapports[0] ? rapports[0].type : '')}
    </div>

    <div class="grille" style="grid-template-columns:minmax(0,340px) minmax(0,1fr);margin-top:16px">
      ${carte('Historique', liste, { sous: `${rapports.length} rapport(s)` })}
      ${carte('Contenu du rapport', detail, { sous: rapport ? `${rapport.type} · ${rapport.date}` : '' })}
    </div>

    ${carte(
      'Ce que contient chaque rapport',
      `<div class="grille g4">
        ${['Résumé exécutif', 'Indicateurs clés (portée, vues, likes, commentaires)', 'Publications de la journée', 'Audience et pays (R7)', 'Problèmes détectés', 'Recommandations', 'Prochaines actions', 'Traçabilité du moteur']
          .map((element, index) => `<div class="flex gap-8 small"><span class="badge violet">${index + 1}</span><span>${element}</span></div>`)
          .join('')}
      </div>`,
      { classe: 'mt-16', sous: 'Format Markdown lisible et archivable' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async ouvrir(bouton) {
        ctx.params.id = bouton.dataset.id;
        await ctx.rafraichir();
      },
      async generer(bouton) {
        await ctx.api('/api/rapports/generer', { corps: { type: bouton.dataset.type, date: ctx.etat.horloge.date } });
        ctx.toast('Rapport généré.', { type: 'succes' });
        ctx.params.id = null;
        await ctx.rafraichir();
      },
      async export(bouton) {
        window.open(`/api/rapports/${bouton.dataset.id}/export`, '_blank');
      },
      async envoyer(bouton) {
        const resultat = await ctx.api(`/api/rapports/${bouton.dataset.id}/envoyer`, { method: 'POST' });
        ctx.toast(
          resultat.transmission?.statut === 'echec'
            ? 'Le webhook a échoué : le rapport reste disponible dans l’application.'
            : 'Rapport transmis au responsable.',
          { type: resultat.transmission?.statut === 'echec' ? 'alerte' : 'succes' },
        );
        await ctx.rafraichir();
      },
    });
  },
};
