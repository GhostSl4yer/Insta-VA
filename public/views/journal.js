import { echapper, nf, heureFr, badge, dateFr } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherFiltres } from './commun.js';

const NIVEAUX = [
  { valeur: '', libelle: 'Tous niveaux' },
  { valeur: 'info', libelle: 'Info' },
  { valeur: 'alerte', libelle: 'Alerte' },
  { valeur: 'erreur', libelle: 'Erreur' },
];

const CATEGORIES = [
  { valeur: '', libelle: 'Toutes catégories' },
  ...['systeme', 'cycle', 'compte', 'audience', 'cibles', 'drive', 'publication', 'interaction', 'rapport', 'anomalie', 'session'].map((c) => ({ valeur: c, libelle: c })),
];

let derniereActu = 0;

export default {
  titre: 'Journal',
  async rendre(ctx) {
    const params = new URLSearchParams({
      niveau: ctx.params.niveau || '',
      categorie: ctx.params.categorie || '',
      recherche: ctx.params.recherche || '',
      limite: '300',
    });
    const { evenements } = await ctx.api(`/api/journal?${params}`);
    const parNiveau = evenements.reduce((acc, e) => ({ ...acc, [e.niveau]: (acc[e.niveau] || 0) + 1 }), {});

    const lignes = evenements
      .map(
        (e) => `<div class="console-ligne ${e.niveau}">
          <span class="console-heure">${heureFr(e.ts)}</span>
          <span class="console-cat">${echapper(e.categorie)}</span>
          <span class="console-msg">${echapper(e.message)}</span>
        </div>`,
      )
      .join('');

    return `${entete(
      'Journal du moteur',
      'Traçabilité complète : chaque décision (publication, interaction, filtrage, rapport) est horodatée et consultable.',
      `<button class="btn btn-fantome" data-action="aujourdhui">Aujourd’hui</button>
       <a class="btn btn-primaire" href="/api/export" target="_blank" rel="noopener">Exporter les données</a>`,
    )}

    <div class="grille g4">
      ${kpi('Événements', nf(evenements.length), 'affichés (max 300)')}
      ${kpi('Infos', nf(parNiveau.info || 0), 'fonctionnement normal')}
      ${kpi('Alertes', nf(parNiveau.alerte || 0), 'à surveiller')}
      ${kpi('Erreurs', nf(parNiveau.erreur || 0), 'actions en échec')}
    </div>

    ${carte(
      'Flux d’événements',
      `<div class="filtres" style="margin-bottom:14px">
        ${selecteur('niveau', NIVEAUX, ctx.params.niveau || '')}
        ${selecteur('categorie', CATEGORIES, ctx.params.categorie || '')}
        <input class="input" style="min-width:240px" placeholder="Rechercher dans le journal…" data-filtre-recherche="recherche" value="${echapper(ctx.params.recherche || '')}"/>
        <span class="small muet">${nf(evenements.length)} événement(s)</span>
      </div>
      <div class="console" style="max-height:620px" id="journal-console">${lignes || '<div class="vide">Aucun événement pour ces filtres.</div>'}</div>`,
      { sous: 'Le moteur journalise aussi les cibles ignorées (hors zone, âge < 25 ans)' },
    )}

    ${carte(
      'Catégories d’événements',
      `<div class="flex wrap gap-8">${CATEGORIES.filter((c) => c.valeur)
        .map((c) => `<button class="badge ${ctx.params.categorie === c.valeur ? 'violet' : 'gris'}" data-action="categorie" data-categorie="${c.valeur}" style="cursor:pointer">${c.libelle}</button>`)
        .join('')}</div>`,
      { classe: 'mt-16' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());
    racine.addEventListener('click', async (evenement) => {
      const bouton = evenement.target.closest('[data-action="categorie"]');
      if (bouton) {
        ctx.params.categorie = bouton.dataset.categorie;
        await ctx.rafraichir();
      }
      if (evenement.target.closest('[data-action="aujourdhui"]')) {
        ctx.params.jour = ctx.etat.horloge.date;
        await ctx.rafraichir();
      }
    });
    const console_ = racine.querySelector('#journal-console');
    if (console_) console_.scrollTop = 0;
  },
  maj(racine, ctx) {
    if (!racine.dataset.pret || Date.now() - derniereActu < 5000) return;
    derniereActu = Date.now();
    const params = new URLSearchParams({
      niveau: ctx.params.niveau || '',
      categorie: ctx.params.categorie || '',
      recherche: ctx.params.recherche || '',
      limite: '300',
    });
    ctx
      .api(`/api/journal?${params}`)
      .then(({ evenements }) => {
        const console_ = racine.querySelector('#journal-console');
        if (!console_) return;
        const lignes = evenements
          .map(
            (e) => `<div class="console-ligne ${e.niveau}">
              <span class="console-heure">${heureFr(e.ts)}</span>
              <span class="console-cat">${echapper(e.categorie)}</span>
              <span class="console-msg">${echapper(e.message)}</span>
            </div>`,
          )
          .join('');
        console_.innerHTML = lignes || '<div class="vide">Aucun événement pour ces filtres.</div>';
      })
      .catch(() => {});
  },
};
