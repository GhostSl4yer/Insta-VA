import { echapper, nf, dateFr, badge, heureFr, minutesEnTexte, anneau, courbe, vide } from '../lib/ui.js';
import { entete, carte, kpi, tableau, brancherActions } from './commun.js';

export default {
  titre: 'Cycle & journées',
  async rendre(ctx) {
    const etat = ctx.etat;
    const { cycles } = await ctx.api('/api/cycles?limite=45');
    const jour = etat.horloge.date;
    const statsJour = etat.journee.statistiques;
    const sessions = etat.journee.sessions || [];
    const pubsJour = etat.journee.publications;

    const sessionsHtml = sessions
      .map((s, index) => {
        const vision = Math.round((s.dureeVisionnage || 0) / 60);
        const objectif = index === 0 ? 20 : 15;
        return `<div class="carte" style="${s.statut === 'EnCours' ? 'border-color:var(--trait-fort)' : ''}">
          <div class="carte-entete">
            <div><div class="carte-titre">Session ${index + 1} · ${s.heureDebut} → ${s.heureFin}</div>
              <div class="carte-sous">${nf(s.dureeVisionnage || 0)} s de visionnage · objectif ${objectif} min</div></div>
            <div class="carte-actions">${badge(s.statut)}</div>
          </div>
          <div class="progression mint"><span style="width:${Math.min(100, (vision / objectif) * 100)}%"></span></div>
          <div class="flex entre mt-8 small muet"><span>${vision} min</span><span>${objectif} min</span></div>
        </div>`;
      })
      .join('');

    const serie = cycles
      .slice()
      .reverse()
      .map((c) => ({ label: c.dateDebut, valeur: c.interactions || 0 }));

    const lignesCycles = cycles.map(
      (c) => `<tr>
        <td class="serre"><span class="mono tiny muet">${c.dateDebut}</span><div style="font-weight:600">J${c.numeroJour} · cycle ${c.cycleNumero}</div></td>
        <td>${badge(c.statut)}</td>
        <td class="num">${nf(c.publications)}</td>
        <td class="num">${nf(c.interactions)}</td>
        <td class="num">${c.visionnageMin} min</td>
        <td class="serre"><div class="flex gap-6">${c.visionnageMin >= 30 ? badge('Conforme', 'mint') : badge('À surveiller', 'ambre')}
          ${c.publications >= 4 ? badge('R5 OK', 'bleu') : badge('R5 partiel', 'gris')}</div></td>
        <td class="droite"><button class="btn btn-petit btn-fantome" data-action="detail" data-id="${c.id}">Détail</button></td>
      </tr>`,
    );

    return `${entete(
      'Cycle & journées',
      `Cycle ${etat.programme.cycleNumero} · jour ${etat.programme.numeroJour}/${etat.programme.joursTotal} — cycle quotidien 16 h → 00 h découpé en deux sessions.`,
      `<button class="btn btn-fantome" data-action="relancer">Réinitialiser le cycle</button>
       <button class="btn btn-primaire" data-action="fin-jour">Clôturer la journée</button>`,
    )}
    <div class="carte" style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">
      ${anneau(etat.programme.progression, { taille: 108, libelle: 'cycle 30 j' })}
      <div style="flex:1;min-width:220px">
        <div class="carte-titre" style="font-size:15px">Journée ${etat.horloge.date ? dateFr(etat.horloge.date) : '—'}</div>
        <div class="carte-sous">Horloge simulée ${etat.horloge.heure} · ${etat.horloge.sessionCourante ? `session ${etat.horloge.sessionCourante.numero} en cours` : 'entre deux sessions'}</div>
        <div class="progression mt-12"><span style="width:${etat.horloge.progression}%"></span></div>
        <div class="flex entre mt-8 small muet"><span>16:00</span><span>20:00</span><span>00:00</span></div>
      </div>
      <div class="flex gap-16 wrap">
        <div class="mini-stat"><b>${nf(pubsJour.filter((p) => p.statut === 'Publiee').length)}</b><span>publiées</span></div>
        <div class="mini-stat"><b>${Math.round(etat.journee.visionnage.secondes / 60)} min</b><span>visionnage</span></div>
        <div class="mini-stat"><b>${nf(etat.journee.interactions.sortantes)}</b><span>interactions</span></div>
        <div class="mini-stat"><b>${nf(statsJour?.abonnesGagnes || 0)}</b><span>abonnés</span></div>
      </div>
    </div>

    <div class="grille g2 mt-16">${sessionsHtml}</div>

    <div class="grille g3 mt-16">
      ${kpi('Journées terminées', `${nf(cycles.filter((c) => c.statut === 'Termine').length)}`, 'sur 30 dans le cycle')}
      ${kpi('Publications cumulées', nf(cycles.reduce((s, c) => s + (c.publications || 0), 0)), 'cycle en cours')}
      ${kpi('Visionnage cumulé', `${nf(cycles.reduce((s, c) => s + (c.visionnageMin || 0), 0))} min`, 'objectif 30 min / jour')}
    </div>

    <div class="grille g-sidebar mt-16">
      ${carte('Interactions par journée', `<div class="carte-sous" style="margin-bottom:8px">Volume d’interactions sortantes et reçues</div>
        ${courbe(serie, { hauteur: 190, cle: 'valeur', etiquette: 'interactions' })}
        <div class="legende-graph"><span><i style="background:var(--encre)"></i>interactions / jour</span></div>`)}
      ${carte(
        'Répartition du jour',
        `<div class="liste">
          <div class="ligne-liste"><div class="ligne-principal"><div class="ligne-titre">Stories publiées</div><div class="ligne-sous">rôle de présence quotidienne</div></div><div class="ligne-droite mono">${pubsJour.filter((p) => p.type === 'Story' && p.statut === 'Publiee').length}</div></div>
          <div class="ligne-liste"><div class="ligne-principal"><div class="ligne-titre">Reels publiés</div><div class="ligne-sous">portée et découverte</div></div><div class="ligne-droite mono">${pubsJour.filter((p) => p.type === 'Reel' && p.statut === 'Publiee').length}</div></div>
          <div class="ligne-liste"><div class="ligne-principal"><div class="ligne-titre">Unes publiées</div><div class="ligne-sous">3× / semaine (lun. mer. ven.)</div></div><div class="ligne-droite mono">${pubsJour.filter((p) => p.type === 'UnePleine' && p.statut === 'Publiee').length}</div></div>
          <div class="ligne-liste"><div class="ligne-principal"><div class="ligne-titre">Interactions sortantes</div><div class="ligne-sous">likes, commentaires, suivis</div></div><div class="ligne-droite mono">${nf(etat.journee.interactions.sortantes)}</div></div>
          <div class="ligne-liste"><div class="ligne-principal"><div class="ligne-titre">Réactions reçues</div><div class="ligne-sous">audience qualifiée uniquement</div></div><div class="ligne-droite mono">${nf(etat.journee.interactions.entrantes)}</div></div>
        </div>
        <div class="sep"></div>
        <div class="small muet">La journée se clôture automatiquement à 00 h, puis la suivante démarre à 16 h. À J+30, le cycle est relancé sans reconfiguration.</div>`,
      )}
    </div>

    ${carte('Historique des journées', tableau(
      [
        { libelle: 'Journée' },
        { libelle: 'Statut' },
        { libelle: 'Publi.', classe: 'num' },
        { libelle: 'Inter.', classe: 'num' },
        { libelle: 'Visionnage', classe: 'num' },
        { libelle: 'Contrôles' },
        { libelle: '' },
      ],
      lignesCycles,
    ), { sous: `${cycles.length} journée(s) enregistrée(s)`, actions: `<span class="badge violet">cycle ${etat.programme.cycleNumero}</span>` })}
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async detail(bouton) {
        const donnees = await ctx.api(`/api/cycles/${bouton.dataset.id}`);
        const sessions = donnees.sessions
          .map(
            (s) => `<div class="ligne-liste">
              <div class="ligne-principal"><div class="ligne-titre">Session ${s.heure_debut} → ${s.heure_fin}</div>
              <div class="ligne-sous">Visionnage ${minutesEnTexte(s.duree_visionnage)} · ${s.statut}</div></div>
              <div class="ligne-droite">${badge(s.statut)}</div></div>`,
          )
          .join('');
        const pubs = donnees.publications
          .map(
            (p) => `<div class="ligne-liste">
              <div class="ligne-principal"><div class="ligne-titre">${echapper((p.contenu || '').split('\n')[0].slice(0, 70))}</div>
              <div class="ligne-sous">${p.type} · ${heureFr(p.dateHeure)} · ${nf(p.likes)} likes · ${nf(p.commentaires)} commentaires</div></div>
              <div class="ligne-droite">${badge(p.statut)}</div></div>`,
          )
          .join('');
        const execution = donnees.execution
          .map((e) => `<tr><td>${echapper(e.etape)}</td><td class="mono">${e.heure_prevue}</td><td class="mono">${e.heure_reelle || '—'}</td><td>${badge(e.statut)}</td></tr>`)
          .join('');
        ctx.modale({
          titre: `Journée ${dateFr(donnees.cycle.date_debut)} · J${donnees.cycle.numero_jour}`,
          corps: `<div class="grille g2">
            ${carte('Sessions', `<div class="liste">${sessions || vide('Aucune session')}</div>`)}
            ${carte('Statistiques', `<div class="mini-stats">
              <div class="mini-stat"><b>${nf(donnees.publications.filter((p) => p.statut === 'Publiee').length)}</b><span>publications</span></div>
              <div class="mini-stat"><b>${nf(donnees.publications.reduce((s, p) => s + p.likes, 0))}</b><span>likes</span></div>
              <div class="mini-stat"><b>${nf(donnees.publications.reduce((s, p) => s + p.portee, 0))}</b><span>portée</span></div>
            </div>
            <div class="sep"></div>
            <div class="tableau-zone"><table class="tableau"><thead><tr><th>Étape</th><th>Prévue</th><th>Réelle</th><th>Statut</th></tr></thead><tbody>${execution}</tbody></table></div>`)}
          </div>
          <div class="mt-16">${carte('Publications', `<div class="liste">${pubs || vide('Aucune publication')}</div>`)}</div>`,
          largeur: 860,
        });
      },
      async relancer(bouton, evenement) {
        const ok = await ctx.confirmer(
          'Le cycle repart au jour 1 avec le même compte et le même historique. La configuration initiale est conservée.',
          { titre: 'Réinitialiser le cycle', libelle: 'Réinitialiser', danger: true },
        );
        if (!ok) return;
        await ctx.api('/api/compte/reinitialiser-cycle', { corps: { conserverHistorique: true } });
        ctx.toast('Cycle réinitialisé. Le moteur reprendra au jour 1.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async 'fin-jour'() {
        await ctx.api('/api/controle/fin-jour', { method: 'POST' });
        ctx.toast('Journée clôturée, rapport généré.', { type: 'succes' });
        await ctx.rafraichir();
      },
    });
  },
};
