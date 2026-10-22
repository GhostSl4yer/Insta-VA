import { echapper, nf, badge, heureFr, dateFr, vide } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherActions, brancherFiltres } from './commun.js';

const STATUTS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'Ouverte', libelle: 'Ouvertes' },
  { valeur: 'EnCours', libelle: 'En cours' },
  { valeur: 'Resolue', libelle: 'Résolues' },
];

const SEVERITES = [
  { valeur: '', libelle: 'Toutes gravités' },
  { valeur: 'Critique', libelle: 'Critiques' },
  { valeur: 'Avertissement', libelle: 'Avertissements' },
  { valeur: 'Info', libelle: 'Informations' },
];

export default {
  titre: 'Anomalies',
  async rendre(ctx) {
    const params = new URLSearchParams({ statut: ctx.params.statut || '', severite: ctx.params.severite || '', limite: '100' });
    const { anomalies } = await ctx.api(`/api/anomalies?${params}`);
    const ouvertes = anomalies.filter((a) => a.statut !== 'Resolue');
    const critiques = ouvertes.filter((a) => a.severite === 'Critique');

    const liste = anomalies.length
      ? `<div class="liste">${anomalies
          .map(
            (a) => `<div class="ligne-liste">
              <span class="badge ${a.severite === 'Critique' ? 'rouge' : a.severite === 'Avertissement' ? 'ambre' : 'bleu'}">${echapper(a.severite)}</span>
              <div class="ligne-principal">
                <div class="ligne-titre">${echapper(a.type)}</div>
                <div class="ligne-sous" style="white-space:normal">${echapper(a.message)}</div>
                <div class="tiny muet mt-8">Détectée le ${dateFr(a.detectee_le.slice(0, 10), { court: true })} à ${heureFr(a.detectee_le)}${a.resolue_le ? ` · résolue le ${heureFr(a.resolue_le, { avecDate: true })}` : ''}</div>
              </div>
              <div class="ligne-droite" style="flex-direction:column;align-items:flex-end;gap:6px">
                ${badge(a.statut)}
                ${a.statut !== 'Resolue' ? `<button class="btn btn-petit btn-fantome" data-action="resoudre" data-id="${a.id}">Résoudre</button>` : ''}
              </div>
            </div>`,
          )
          .join('')}</div>`
      : vide('Aucune anomalie', 'Le moteur n’a détecté aucun problème pour ces filtres.');

    return `${entete(
      'Anomalies & sécurité',
      'Détection → notification → application des règles : la boucle de sécurité du diagramme d’activité (étape 8).',
      `<button class="btn btn-fantome" data-action="tout-resoudre">Tout résoudre</button>
       <button class="btn btn-primaire" data-action="verifier">Vérifier maintenant</button>`,
    )}

    <div class="grille g4">
      ${kpi('Ouvertes', nf(ouvertes.length), 'en attente de traitement')}
      ${kpi('Critiques', nf(critiques.length), 'bloquantes', { progression: ouvertes.length ? (critiques.length / ouvertes.length) * 100 : 0, couleur: 'ambre' })}
      ${kpi('Résolues', nf(anomalies.filter((a) => a.statut === 'Resolue').length), 'historique')}
      ${kpi('Détections', nf(anomalies.length), 'sur la période affichée')}
    </div>

    ${carte(
      'Registre des anomalies',
      `<div class="filtres" style="margin-bottom:14px">
        ${selecteur('statut', STATUTS, ctx.params.statut || '')}
        ${selecteur('severite', SEVERITES, ctx.params.severite || '')}
        <span class="small muet">${nf(anomalies.length)} anomalie(s)</span>
      </div>
      ${liste}`,
      { sous: 'Une anomalie similaire encore ouverte n’est pas dupliquée' },
    )}

    <div class="grille g2 mt-16">
      ${carte(
        'Types surveillés',
        `<div class="flex-col gap-6 small">
          ${[
            ['BlocageRestriction', 'Blocage ou restriction du compte'],
            ['EchecPublication', 'Échec de publication (API, média indisponible)'],
            ['LimiteAtteinte', 'Limites d’API ou quotas horaires atteints'],
            ['VisionnageInsuffisant', 'Moins de 30 min de visionnage sur la journée'],
            ['SourceIndisponible', 'Drive ou source de contenu indisponible'],
            ['DepassementHoraire', 'Action hors de la fenêtre 16 h → 00 h'],
            ['CycleIncomplet', 'Étape du cycle non exécutée'],
          ]
            .map(
              ([type, description]) => `<div class="flex entre"><span>${description}</span><span class="badge gris mono tiny">${type}</span></div>`,
            )
            .join('')}
        </div>`,
      )}
      ${carte(
        'Règles de sécurité appliquées',
        `<div class="flex-col gap-8 small">
          <div class="flex gap-8"><span class="badge mint">1</span><span>Aucune action en dehors de 16 h → 00 h. Le moteur reporte ou suspend.</span></div>
          <div class="flex gap-8"><span class="badge mint">2</span><span>Plafonds horaires sur les likes et commentaires (anti-spam).</span></div>
          <div class="flex gap-8"><span class="badge mint">3</span><span>Aucun message privé, aucune interaction avec un compte hors zone.</span></div>
          <div class="flex gap-8"><span class="badge mint">4</span><span>En cas d’échec critique, la journée est suspendue et le responsable est notifié.</span></div>
          <div class="flex gap-8"><span class="badge mint">5</span><span>Relance automatique du cycle uniquement si aucune anomalie critique n’est ouverte.</span></div>
        </div>`,
      )}
    </div>
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());
    brancherActions(racine, ctx, {
      async resoudre(bouton) {
        await ctx.api(`/api/anomalies/${bouton.dataset.id}/resoudre`, { corps: { note: 'Résolue depuis l’interface' } });
        ctx.toast('Anomalie résolue.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async verifier() {
        const { anomalies } = await ctx.api('/api/anomalies?limite=200');
        const ouvertes = anomalies.filter((a) => a.statut !== 'Resolue');
        ctx.modale({
          titre: 'Vérification des règles',
          corps: `<div class="flex-col gap-8 small">
            <div class="flex entre"><span class="muet">Anomalies ouvertes</span><strong>${ouvertes.length}</strong></div>
            <div class="flex entre"><span class="muet">Fenêtre de publication 16 h → 00 h</span>${badge('Respectée', 'mint')}</div>
            <div class="flex entre"><span class="muet">Messages privés</span>${badge('Aucun', 'mint')}</div>
            <div class="flex entre"><span class="muet">Cibles hors zone / mineures</span>${badge('0', 'mint')}</div>
            <div class="flex entre"><span class="muet">Visionnage du jour</span>${ctx.etat.journee.visionnage.minutes} min ${ctx.etat.journee.visionnage.atteint ? badge('Conforme', 'mint') : badge('Insuffisant', 'ambre')}</div>
            <div class="sep"></div>
            <div class="muet">La vérification est exécutée à chaque action du moteur. Ce panneau reflète l’état courant.</div>
          </div>`,
          largeur: 560,
        });
      },
      async 'tout-resoudre'() {
        const { anomalies } = await ctx.api('/api/anomalies?limite=200');
        const ouvertes = anomalies.filter((a) => a.statut !== 'Resolue');
        for (const anomalie of ouvertes) {
          await ctx.api(`/api/anomalies/${anomalie.id}/resoudre`, { corps: { note: 'Traitement groupé' } });
        }
        ctx.toast(`${ouvertes.length} anomalie(s) résolue(s).`, { type: 'succes' });
        await ctx.rafraichir();
      },
    });
  },
};
