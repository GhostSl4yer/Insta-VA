import { echapper, nf, dateFr, badge } from '../lib/ui.js';
import { entete, carte, brancherActions } from './commun.js';

const REGLES = [
  ['R1', 'Configuration manuelle du profil (photo, bio, nom, lien) — une seule fois.'],
  ['R2', 'Cycle quotidien de 16 h à 00 h, découpé en 2 sessions (16–20 h / 20–00 h).'],
  ['R3', 'Visionnage de vidéos : 30 min minimum par jour et par compte.'],
  ['R4', 'Interactions uniquement sur les commentaires — jamais de messages privés.'],
  ['R5', 'Publication planifiée obligatoire : pas de spam, pas de publication improvisée.'],
  ['R6', 'Suivi de comptes de référence ≥ leurs abonnés (12–25 % du volume de suivis).'],
  ['R7', 'Statistiques limitées aux pays autorisés (USA, France, Royaume-Uni, Allemagne, Pologne + autres pays fournis).'],
  ['R8', 'Aucune publication pendant les heures interdites (00 h → 16 h).'],
  ['R9', 'Âge minimum : 25 ans — aucun compte hors zone ou mineur n’est traité.'],
  ['R10', 'À la fin du cycle de 30 jours : relancement automatique du cycle (même compte, même historique).'],
];

export default {
  titre: 'Programme 30 jours',
  async rendre(ctx) {
    const etat = ctx.etat;
    const { cycles } = await ctx.api('/api/cycles?limite=60');
    const joursFaits = new Map();
    for (const cycle of cycles) {
      joursFaits.set(cycle.numeroJour, cycle);
    }
    const jourActuel = etat.programme.numeroJour;
    const grille = Array.from({ length: 30 }, (_, index) => {
      const numero = index + 1;
      const cycle = joursFaits.get(numero);
      const classes = ['marqueur-jour'];
      if (numero === jourActuel) classes.push('actif');
      else if (cycle?.statut === 'Termine') classes.push('fait');
      else if (numero > jourActuel) classes.push('futur');
      const infos = cycle
        ? `J${numero} · ${cycle.dateDebut} · ${cycle.publications} publi. · ${cycle.interactions} interactions · ${cycle.visionnageMin} min`
        : `J${numero} · à venir`;
      return `<div class="${classes.join(' ')}" title="${echapper(infos)}" data-action="jour" data-numero="${numero}">${numero}</div>`;
    }).join('');

    const etapes = [
      { titre: 'Jour 1 — configuration', detail: 'Profil manuel : photo, nom, bio, lien. Paramètres d’audience, comptes de référence, contenus du Drive.', statut: 'Effectué' },
      { titre: 'Jour 2 — démarrage du cycle', detail: 'Première journée complète 16 h → 00 h : publications planifiées, interactions, visionnage.', statut: 'Effectué' },
      { titre: 'Jours 3 → 29 — croisière autonome', detail: 'Publication quotidienne, deux sessions, veille, statistiques et rapports hebdomadaires.', statut: 'EnCours' },
      { titre: 'Jour 30 — bilan', detail: 'Bilan de fin de cycle, rapport mensuel, archivage des contenus, relance automatique.', statut: 'Planifié' },
    ];

    return `${entete(
      'Programme 30 jours',
      'Un cycle = 30 journées de 16 h à 00 h. À la fin du cycle, le moteur relance automatiquement sans reconfiguration.',
      `<a class="btn btn-fantome" href="#/cycle">Voir les journées</a>
       <button class="btn btn-primaire" data-action="avancer-jour">Passer à la journée suivante</button>`,
    )}

    <div class="grille g-sidebar">
      ${carte(
        'Calendrier du cycle',
        `<div style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:8px">${grille}</div>
         <div class="flex gap-12 wrap mt-16 small muet">
           <span class="flex gap-6"><i class="pastille-type" style="background:var(--mint)"></i> terminé</span>
           <span class="flex gap-6"><i class="pastille-type" style="background:var(--rose)"></i> en cours</span>
           <span class="flex gap-6"><i class="pastille-type" style="background:#2a3450"></i> à venir</span>
         </div>`,
        { sous: `Cycle ${etat.programme.cycleNumero} · progression ${Math.round(etat.programme.progression)} %` },
      )}
      ${carte(
        'Jalons',
        `<div class="liste">${etapes
          .map(
            (e) => `<div class="ligne-liste">
              <div class="ligne-principal"><div class="ligne-titre">${echapper(e.titre)}</div>
              <div class="ligne-sous" style="white-space:normal">${echapper(e.detail)}</div></div>
              <div class="ligne-droite">${badge(e.statut)}</div>
            </div>`,
          )
          .join('')}</div>`,
      )}
    </div>

    <div class="grille g2 mt-16">
      ${carte(
        'Les 10 règles du système',
        `<div>${REGLES.map(([id, texte]) => `<div class="regle"><b>${id}</b><span>${echapper(texte)}</span></div>`).join('')}</div>`,
        { sous: 'Chaque action du moteur est vérifiée contre ces règles' },
      )}
      ${carte(
        'Flux du programme',
        `<div class="liste">
          ${[
            ['1', 'Configuration manuelle du profil (jour 1)'],
            ['2', 'À partir du jour 2 : cycle quotidien 16 h → 00 h'],
            ['3', 'Visionnage de vidéos ≥ 30 min / compte / jour'],
            ['4', 'Publication des stories et Reels planifiés'],
            ['5', 'Suivi de comptes de référence + abonnés'],
            ['6', 'Suivi des comptes de référence + leurs abonnés'],
            ['7', 'Analyse des statistiques et ajustements'],
            ['8', 'À la fin de 30 jours : relancement automatique du cycle'],
          ]
            .map(
              ([numero, texte]) => `<div class="ligne-liste">
                <span class="badge violet">${numero}</span>
                <div class="ligne-principal"><div class="ligne-titre" style="font-weight:500">${echapper(texte)}</div></div>
              </div>`,
            )
            .join('')}
        </div>`,
      )}
    </div>

    ${carte(
      'Objectif final',
      `<div class="grille g3">
        <div><div class="kpi-label">Audience visée</div><div class="kpi-valeur" style="font-size:22px">${nf(etat.kpis.cibleAbonnes)}</div>
          <div class="small muet">abonnés qualifiés · 25 ans et +</div></div>
        <div><div class="kpi-label">Zones</div><div class="kpi-valeur" style="font-size:22px">${etat.audience.paysAutorises.length}</div>
          <div class="small muet">${etat.audience.paysAutorises.map((p) => ({ USA: '🇺🇸', France: '🇫🇷', RoyaumeUni: '🇬🇧', Allemagne: '🇩🇪', Pologne: '🇵🇱', AutresPays: '🌍' })[p]).join(' ')}</div></div>
        <div><div class="kpi-label">Lien promu</div><div class="kpi-valeur" style="font-size:16px"><a href="https://tavia.app/avatar/maya" target="_blank" rel="noopener">tavia.app/avatar/maya</a></div>
          <div class="small muet">Promouvoir l’avatar IA via un lien externe</div></div>
      </div>`,
      { sous: 'Développer une audience qualifiée et engagée sur Instagram', classe: 'mt-16' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async jour(bouton) {
        const numero = Number(bouton.dataset.numero);
        const { cycles } = await ctx.api('/api/cycles?limite=60');
        const cycle = cycles.find((c) => c.numeroJour === numero);
        ctx.modale({
          titre: `Journée ${numero} du cycle`,
          corps: cycle
            ? `<div class="grille g2">
                ${carte('Résumé', `<div class="mini-stats">
                  <div class="mini-stat"><b>${cycle.publications}</b><span>publications</span></div>
                  <div class="mini-stat"><b>${nf(cycle.interactions)}</b><span>interactions</span></div>
                  <div class="mini-stat"><b>${cycle.visionnageMin} min</b><span>visionnage</span></div>
                </div>`)}
                ${carte('Contrôles', `<div class="flex-col gap-6 small">
                  <div class="flex entre"><span class="muet">Statut de la journée</span>${badge(cycle.statut)}</div>
                  <div class="flex entre"><span class="muet">R2 · fenêtre 16 h → 00 h</span>${badge('Respectée', 'mint')}</div>
                  <div class="flex entre"><span class="muet">R3 · visionnage ≥ 30 min</span>${cycle.visionnageMin >= 30 ? badge('Conforme', 'mint') : badge('Insuffisant', 'ambre')}</div>
                  <div class="flex entre"><span class="muet">R5 · publication planifiée</span>${cycle.publications > 0 ? badge('Conforme', 'mint') : badge('Aucune', 'rouge')}</div>
                </div>`)}
              </div>`
            : `<div class="vide"><b>Journée ${numero} à venir</b>Elle sera exécutée automatiquement à la prochaine ouverture de cycle.</div>`,
          largeur: 720,
        });
      },
      async 'avancer-jour'() {
        await ctx.api('/api/controle/fin-jour', { method: 'POST' });
        ctx.toast('Journée clôturée. La suivante démarrera automatiquement.', { type: 'succes' });
        await ctx.rafraichir();
      },
    });
  },
};
