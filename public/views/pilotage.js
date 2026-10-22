import {
  echapper, nf, pc, dateFr, anneau, courbe, barresPays, badgeType, badge, vide, heureFr, minutesEnTexte,
} from '../lib/ui.js';
import { entete } from './commun.js';

const PAYS_DRAPEAUX = { USA: '🇺🇸', France: '🇫🇷', RoyaumeUni: '🇬🇧', Allemagne: '🇩🇪', Pologne: '🇵🇱', AutresPays: '🌍' };

function etatMoteur(etat) {
  const { horloge } = etat;
  if (horloge.etat === 'en_cours') return { texte: 'Autonome · en cours', classe: 'mint' };
  if (horloge.etat === 'en_pause') {
    return horloge.pauseManuelle
      ? { texte: 'En pause manuelle', classe: 'ambre' }
      : { texte: 'Entre deux journées', classe: 'bleu' };
  }
  return { texte: 'À l’arrêt', classe: 'gris' };
}

function zoneHero(etat) {
  const moteur = etatMoteur(etat);
  const p = etat.programme;
  return `<div class="hero">
    <svg class="hero-arcs" viewBox="0 0 900 220" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="806" cy="6" r="196" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="806" cy="6" r="146" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="806" cy="6" r="96" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>
    <div class="hero-grille">
      <div>
        <div class="flex gap-8" style="margin-bottom:10px">
          <span class="badge ${moteur.classe}"><span class="point" style="color:currentColor"></span> ${moteur.texte}</span>
          <span class="badge violet">Cycle ${p.cycleNumero}</span>
          <span class="badge gris">Jour ${p.numeroJour} / ${p.joursTotal}</span>
        </div>
        <h2>Journée du ${dateFr(etat.horloge.date)}</h2>
        <p>L’avatar IA orchestre seul la journée : préparation du Drive, publication entre 16 h et 00 h, visionnage, interactions ciblées puis rapport du soir. Aucun message privé, aucune cible hors zone.</p>
        <div class="hero-tags">
          <span class="chip">${etat.horloge.sessionCourante ? `Session ${etat.horloge.sessionCourante.numero} · ${etat.horloge.sessionCourante.heureDebut}–${etat.horloge.sessionCourante.heureFin}` : 'Hors session'}</span>
          <span class="chip">Objectif visionnage <strong>${etat.journee.visionnage.minutes}/${etat.journee.visionnage.objectif / 60} min</strong></span>
          <span class="chip">Vitesse <strong>${etat.horloge.vitesse}</strong> min/s</span>
          ${etat.liens ? `<span class="chip">Clics lien <strong>${nf(etat.liens.clicsAujourdhui)}</strong> aujourd’hui · ${nf(etat.liens.clics30Jours)} / 30 j</span>` : ''}
          <span class="chip">${paysDrapeaux(etat.audience.paysAutorises)}</span>
        </div>
      </div>
      <div class="hero-droite">
        ${anneau(etat.horloge.progression, { taille: 122, libelle: 'journée' })}
        <div class="flex-col" style="gap:14px">
          <div class="mini-stat"><b>${etat.horloge.heure}</b><span>heure simulée</span></div>
          <div class="mini-stat"><b>${nf(etat.journee.interactions.sortantes)}</b><span>interactions</span></div>
          <div class="mini-stat"><b>${etat.journee.publications.filter((x) => x.statut === 'Publiee').length}</b><span>publications</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

const paysDrapeaux = (pays = []) => pays.map((p) => `${PAYS_DRAPEAUX[p] || '🌍'}`).join(' ');

function zoneKpi(etat) {
  const k = etat.kpis;
  const pubsPubliees = etat.journee.publications.filter((p) => p.statut === 'Publiee').length;
  const engagement = k.engagement;
  return `<div class="grille g5" style="margin-top:16px">
    <div class="carte"><div class="kpi">
      <span class="kpi-label">Abonnés</span>
      <div class="kpi-valeur">${nf(k.abonnes)} <small>/ ${nf(k.cibleAbonnes)}</small></div>
      <div class="kpi-delta">+${nf(k.abonnesGagnesCycle)} sur le cycle · ${pc(k.progressionAbonnes, 0)}</div>
      <div class="progression mint" style="margin-top:6px"><span style="width:${k.progressionAbonnes}%"></span></div>
    </div></div>
    <div class="carte"><div class="kpi">
      <span class="kpi-label">Portée (30 j)</span>
      <div class="kpi-valeur">${nf(k.portee)}</div>
      <div class="kpi-delta ${k.semaine.portee > 0 ? '' : 'neutre'}">${nf(k.semaine.portee)} cette semaine</div>
    </div></div>
    <div class="carte"><div class="kpi">
      <span class="kpi-label">Engagement</span>
      <div class="kpi-valeur">${pc(engagement)} <small>cible ${k.cibleEngagement}%</small></div>
      <div class="kpi-delta ${engagement >= k.cibleEngagement ? '' : 'bas'}">${engagement >= k.cibleEngagement ? 'au-dessus de la cible' : 'sous la cible'}</div>
    </div></div>
    <div class="carte"><div class="kpi">
      <span class="kpi-label">Publications du jour</span>
      <div class="kpi-valeur">${pubsPubliees} <small>/ ${etat.journee.publications.length}</small></div>
      <div class="kpi-delta neutre">${nf(k.publications)} publiées au total</div>
    </div></div>
    <div class="carte"><div class="kpi">
      <span class="kpi-label">Interactions</span>
      <div class="kpi-valeur">${nf(etat.journee.interactions.total)}</div>
      <div class="kpi-delta neutre">${nf(etat.journee.interactions.sortantes)} sortantes · ${nf(etat.journee.interactions.entrantes)} reçues</div>
    </div></div>
  </div>`;
}

function zoneChronologie(etat) {
  const lignes = etat.execution.map((etape) => {
    const classe = etape.statut === 'Effectue' ? 'faite' : etape.statut === 'EnCours' ? 'en_cours' : etape.statut === 'Echec' ? 'erreur' : '';
    const actuelle = etape.statut === 'EnCours' ? 'actuelle' : '';
    return `<div class="etape ${classe} ${actuelle}">
      <div class="etape-entete">
        <span class="etape-heure">${etape.heurePrevue}</span>
        <span class="etape-libelle">${echapper(etape.etape)}</span>
        <span style="margin-left:auto">${badge(etape.statut)}</span>
      </div>
      <div class="etape-detail">${echapper(etape.detail || 'En attente')}${etape.heureReelle ? ` · ${etape.heureReelle}` : ''}</div>
    </div>`;
  });
  const prochaines = etat.plan.filter((t) => t.statut === 'Planifie').slice(0, 6);
  return `<div class="carte">
    <div class="carte-entete">
      <div>
        <div class="carte-titre">Chronologie de la journée</div>
        <div class="carte-sous">7 étapes — de l’initialisation du compte à la clôture à 00 h</div>
      </div>
      <div class="carte-actions"><span class="badge violet">${etat.horloge.heure}</span></div>
    </div>
    <div class="chronologie">${lignes.join('')}</div>
    <div class="sep"></div>
    <div class="section-titre" style="margin-top:0">Prochaines actions</div>
    ${prochaines.length
      ? `<div class="liste">${prochaines
          .map(
            (t) => `<div class="ligne-liste">
              <span class="mono tiny" style="color:var(--encre);flex:0 0 44px">${t.heure}</span>
              <div class="ligne-principal"><div class="ligne-titre" style="font-weight:500;font-size:12.5px">${echapper(t.libelle)}</div></div>
              <span class="badge gris">${echapper(t.type === 'interactions' ? 'interactions' : t.type)}</span>
            </div>`,
          )
          .join('')}</div>`
      : vide('Journée terminée', 'La prochaine journée démarrera automatiquement à 16 h.')}
  </div>`;
}

function zoneFlux(etat) {
  const lignes = etat.flux
    .slice(0, 18)
    .map(
      (l) => `<div class="console-ligne ${l.niveau}">
        <span class="console-heure">${heureFr(l.ts)}</span>
        <span class="console-cat">${echapper(l.categorie)}</span>
        <span class="console-msg">${echapper(l.message)}</span>
      </div>`,
    )
    .join('');
  return `<div class="carte">
    <div class="carte-entete">
      <div>
        <div class="carte-titre">Flux en direct</div>
        <div class="carte-sous">Chaque décision du moteur est tracée</div>
      </div>
      <div class="carte-actions"><a class="btn btn-petit btn-fantome" href="#/journal">Tout voir</a></div>
    </div>
    <div class="console" id="console-flux">${lignes || '<div class="vide">Aucun événement.</div>'}</div>
    <div class="sep"></div>
    <div class="flex wrap gap-8">
      <span class="badge mint">${etat.compteurs.publications.Publiee || 0} publiées</span>
      <span class="badge bleu">${etat.compteurs.publications.Planifiee || 0} planifiées</span>
      <span class="badge rouge">${etat.compteurs.anomalies} anomalie(s)</span>
      <span class="badge violet">${etat.compteurs.notifications} notification(s)</span>
      <span class="badge gris">mode ${etat.mode}</span>
    </div>
  </div>`;
}

function zonePublications(etat) {
  const publications = etat.journee.publications.filter((p) => p.type !== 'PhotoProfil').slice(0, 8);
  if (!publications.length) {
    return `<div class="carte"><div class="carte-entete"><div class="carte-titre">Publications du jour</div>
      <div class="carte-actions"><a class="btn btn-petit btn-fantome" href="#/publications">Planning</a></div></div>
      ${vide('Aucune publication planifiée', 'Les contenus sont préparés lors de l’ouverture de la journée.')}</div>`;
  }
  return `<div class="carte">
    <div class="carte-entete">
      <div><div class="carte-titre">Publications du jour</div><div class="carte-sous">${publications.length} contenu(s) · Drive → Instagram</div></div>
      <div class="carte-actions"><a class="btn btn-petit btn-fantome" href="#/publications">Planning</a></div>
    </div>
    <div class="liste">
      ${publications
        .map(
          (p) => `<div class="ligne-liste">
          <div class="vignette-image" style="width:44px;height:54px;border-radius:8px;overflow:hidden;flex:0 0 44px;position:relative">
            ${p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : ''}
          </div>
          <div class="ligne-principal">
            <div class="ligne-titre">${badgeType(p.type)} ${echapper((p.contenu || '').split('\n')[0].slice(0, 60))}</div>
            <div class="ligne-sous">${echapper(p.dateHeure.slice(11, 16))} · ${nf(p.likes)} likes · ${nf(p.commentaires)} commentaires · ${nf(p.portee)} portée</div>
          </div>
          <div class="ligne-droite">${badge(p.statut)}</div>
        </div>`,
        )
        .join('')}
    </div>
  </div>`;
}

function zoneInteractions(etat) {
  const i = etat.journee.interactions;
  const types = [
    { cle: 'Like', couleur: 'var(--encre)' },
    { cle: 'Commentaire', couleur: 'var(--encre-2)' },
    { cle: 'Visionnage', couleur: 'var(--muet)' },
    { cle: 'Suivi', couleur: 'var(--muet-2)' },
  ];
  const max = Math.max(1, ...types.map((t) => i.parType[t.cle] || 0));
  return `<div class="carte">
    <div class="carte-entete">
      <div><div class="carte-titre">Interactions du jour</div><div class="carte-sous">Comments first, jamais de DM (R4)</div></div>
      <div class="carte-actions"><a class="btn btn-petit btn-fantome" href="#/interactions">Détail</a></div>
    </div>
    <div class="flex-col gap-8">
      ${types
        .map(
          (t) => `<div class="flex gap-8">
          <span class="tiny muet" style="flex:0 0 88px">${t.cle}</span>
          <div class="progression" style="flex:1;height:8px"><span style="width:${(((i.parType[t.cle] || 0) / max) * 100).toFixed(1)}%;background:${t.couleur};box-shadow:none"></span></div>
          <span class="mono tiny" style="flex:0 0 42px;text-align:right">${nf(i.parType[t.cle] || 0)}</span>
        </div>`,
        )
        .join('')}
    </div>
    <div class="sep"></div>
    <div class="flex entre mb-0">
      <div class="mini-stat"><b>${nf(i.sortantes)}</b><span>sortantes</span></div>
      <div class="mini-stat"><b>${nf(i.entrantes)}</b><span>reçues</span></div>
      <div class="mini-stat"><b>${nf(i.suivis)}</b><span>suivis</span></div>
      <div class="mini-stat"><b>${minutesEnTexte(etat.journee.visionnage.secondes)}</b><span>visionnage</span></div>
    </div>
    <div class="sep"></div>
    <div class="carte-sous" style="margin-bottom:6px">Répartition des interactions reçues par pays</div>
    ${barresPays(
      (i.parPays || []).slice(0, 5).map((p) => {
        const total = (i.parPays || []).reduce((s, x) => s + x.n, 0) || 1;
        return { pays: p.pays, valeur: p.n, pourcentage: (p.n / total) * 100, autorise: etat.audience.paysAutorises.includes(p.pays) };
      }),
    )}
  </div>`;
}

function zoneAlertes(etat) {
  if (!etat.alertes.length) {
    return `<div class="carte"><div class="carte-entete"><div class="carte-titre">Alertes & contrôles</div></div>
      <div class="flex gap-8 wrap">
        <span class="badge mint">Aucune anomalie ouverte</span>
        <span class="badge mint">Règles respectées</span>
        <span class="badge mint">Aucun DM envoyé</span>
        <span class="badge mint">Cibles ≥ 25 ans</span>
      </div></div>`;
  }
  return `<div class="carte">
    <div class="carte-entete"><div class="carte-titre">Alertes & contrôles</div>
      <div class="carte-actions"><a class="btn btn-petit btn-fantome" href="#/anomalies">Gérer</a></div></div>
    <div class="liste">
      ${etat.alertes
        .map(
          (a) => `<div class="ligne-liste">
          <span class="badge ${a.severite === 'Critique' ? 'rouge' : 'ambre'}">${echapper(a.severite)}</span>
          <div class="ligne-principal">
            <div class="ligne-titre" style="font-size:12.5px">${echapper(a.type)}</div>
            <div class="ligne-sous" style="white-space:normal">${echapper(a.message)}</div>
          </div>
          <span class="tiny muet">${heureFr(a.detectee_le)}</span>
        </div>`,
        )
        .join('')}
    </div>
  </div>`;
}

let apercuPublications = [];

function zoneCompte(etat) {
  const abonnes = nf(etat.kpis.abonnes);
  const suivis = nf(etat.kpis.suivis);
  const publications = nf(etat.kpis.publications);
  const vignettes = apercuPublications
    .filter((p) => p.image)
    .slice(0, 6)
    .map(
      (p) => `<a href="${p.image}" target="_blank" rel="noopener" style="display:block;aspect-ratio:1;overflow:hidden;background:var(--surface-2)">
        <img src="${p.image}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"/>
      </a>`,
    )
    .join('');
  return `<div class="carte">
    <div class="carte-entete"><div class="carte-titre">Aperçu du compte</div>
      <div class="carte-actions"><span class="badge mint">${etat.compte.statut}</span></div></div>
    <div class="flex gap-12" style="align-items:flex-start">
      <img class="avatar-rond avatar-grand" src="/api/compte/photo" alt="" onerror="this.style.display='none'"/>
      <div style="min-width:0;flex:1">
        <div style="font-weight:800;font-size:15px;letter-spacing:-.02em">${echapper(etat.compte.avatar.nomInstagram || etat.compte.username)}</div>
        <a class="mono tiny" href="#/parametres">@${echapper(etat.compte.username)}</a>
        <div class="flex gap-12 mt-8">
          <div class="mini-stat"><b>${publications}</b><span>publications</span></div>
          <div class="mini-stat"><b>${abonnes}</b><span>abonnés</span></div>
          <div class="mini-stat"><b>${suivis}</b><span>suivis</span></div>
        </div>
      </div>
    </div>
    <div class="small muet mt-12" style="white-space:pre-line;max-height:52px;overflow:hidden">${echapper(etat.compte.bio || '')}</div>
    <div class="mt-12" style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;border-radius:10px;overflow:hidden;border:1px solid var(--trait)">
      ${vignettes || '<div class="vide" style="grid-column:1/-1">Aucune publication pour l’instant.</div>'}
    </div>
    <div class="flex gap-8 wrap mt-12">
      <a class="btn btn-petit btn-fantome" href="#/drive">Drive</a>
      <a class="btn btn-petit btn-fantome" href="#/publications">Planning</a>
      <span class="badge gris" style="margin-left:auto">${etat.mode === 'graph' ? 'Graph API' : 'simulation'}</span>
    </div>
  </div>`;
}

function zoneMission(etat) {
  const p = etat.programme.objectifFinal;
  return `<div class="carte" style="border-color:var(--trait-fort)">
    <div class="carte-entete"><div class="carte-titre">Objectif final</div><span class="badge violet">30 jours</span></div>
    <p class="small" style="color:var(--encre-2);margin:0 0 12px">
      Développer une audience qualifiée et engagée sur Instagram, avec une audience ciblée
      (${p.ageMinimum} ans +, ${p.pays.length} zones) à travers un contrefort régulier, pour promouvoir l’avatar IA via un lien externe.
    </p>
    <div class="flex-col gap-8">
      <div class="flex entre small"><span class="muet">Cycle en cours</span><strong class="mono">J${etat.programme.numeroJour}/${etat.programme.joursTotal}</strong></div>
      <div class="progression"><span style="width:${etat.programme.progression}%"></span></div>
      <div class="flex entre small"><span class="muet">Cycle quotidien</span><strong class="mono">${p.heures}</strong></div>
      <div class="flex entre small"><span class="muet">Visionnage minimum</span><strong class="mono">${p.visionnageMin} min / jour</strong></div>
      <div class="flex entre small"><span class="muet">Lien promu</span><a class="mono tiny" href="${p.lienExterne}" target="_blank" rel="noopener">tavia.app/avatar/maya</a></div>
    </div>
  </div>`;
}

const ZONES = {
  hero: zoneHero,
  kpi: zoneKpi,
  compte: zoneCompte,
  chronologie: zoneChronologie,
  flux: zoneFlux,
  publications: zonePublications,
  interactions: zoneInteractions,
  alertes: zoneAlertes,
  mission: zoneMission,
};

function page(etat) {
  return `
  ${entete(
    'Tableau de bord',
    'Vue temps réel du compte Instagram piloté par l’avatar IA : cycle de 30 jours, deux sessions quotidiennes, publications et interactions tracées.',
    `<a class="btn btn-fantome" href="#/journal">Flux complet</a>
     <a class="btn btn-primaire" href="#/rapports">Rapports <span aria-hidden="true">→</span></a>`,
  )}
  <div data-zone="hero">${zoneHero(etat)}</div>
  <div data-zone="kpi">${zoneKpi(etat)}</div>
  <div class="grille g-sidebar mt-16">
    <div data-zone="chronologie">${zoneChronologie(etat)}</div>
    <div class="flex-col" style="gap:14px">
      <div data-zone="flux">${zoneFlux(etat)}</div>
      <div data-zone="alertes">${zoneAlertes(etat)}</div>
    </div>
  </div>
  <div class="grille g-2-1 mt-16">
    <div data-zone="publications">${zonePublications(etat)}</div>
    <div data-zone="interactions">${zoneInteractions(etat)}</div>
  </div>
  <div class="grille g3 mt-16">
    <div data-zone="compte">${zoneCompte(etat)}</div>
    <div data-zone="mission">${zoneMission(etat)}</div>
    <div class="carte">
      <div class="carte-entete"><div class="carte-titre">Règles actives</div><span class="badge mint">${10} / 10</span></div>
      <div class="flex-col gap-6">
        ${[
          'Aucun message privé envoyé',
          'Publication uniquement de 16 h à 00 h',
          'Cibles âgées de 25 ans minimum',
          'Pays hors zone filtrés avant interaction',
          '12 à 25 % de comptes de référence suivis',
        ].map((r) => `<div class="flex gap-8 small"><span style="color:var(--ok)">✓</span><span>${r}</span></div>`).join('')}
      </div>
      <div class="sep"></div>
      <a class="btn btn-fantome" href="#/programme">Voir les 10 règles du système</a>
    </div>
  </div>`;
}

export default {
  titre: 'Tableau de bord',
  async rendre(ctx) {
    if (!ctx.etat) return '<div class="vide">Connexion au moteur…</div>';
    try {
      const donnees = await ctx.api('/api/publications?statut=Publiee&limite=6');
      apercuPublications = donnees.publications || [];
    } catch {
      apercuPublications = [];
    }
    return page(ctx.etat);
  },
  monter(racine) {
    const console_ = racine.querySelector('#console-flux');
    if (console_) console_.scrollTop = 0;
  },
  maj(racine, ctx) {
    if (!ctx.etat) return;
    for (const [zone, fabricant] of Object.entries(ZONES)) {
      const noeud = racine.querySelector(`[data-zone="${zone}"]`);
      if (noeud) {
        const html = fabricant(ctx.etat);
        if (noeud.innerHTML !== html) noeud.innerHTML = html;
      }
    }
  },
};
