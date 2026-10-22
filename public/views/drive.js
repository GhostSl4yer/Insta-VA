import { echapper, nf, badge, badgeType, dateFr, vide, heureFr, minutesEnTexte } from '../lib/ui.js';
import { entete, carte, kpi, selecteur, brancherActions, brancherFiltres, tableau } from './commun.js';

const THEMES = [
  { valeur: '', libelle: 'Tous les thèmes' },
  { valeur: 'fitness', libelle: '🏋️ Fitness' },
  { valeur: 'nutrition', libelle: '🥗 Nutrition' },
  { valeur: 'running', libelle: '🏃 Running' },
  { valeur: 'bienetre', libelle: '🧘 Bien-être' },
  { valeur: 'ia', libelle: '🤖 IA' },
];

const TYPES = [
  { valeur: '', libelle: 'Tous les formats' },
  { valeur: 'Reel', libelle: 'Reels' },
  { valeur: 'Story', libelle: 'Stories' },
  { valeur: 'UnePleine', libelle: 'Unes' },
  { valeur: 'PhotoProfil', libelle: 'Profil' },
];

const STATUTS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'Planifie', libelle: 'Planifiés' },
  { valeur: 'Telecharge', libelle: 'Téléchargés' },
  { valeur: 'Publie', libelle: 'Publiés' },
  { valeur: 'Archive', libelle: 'Archivés' },
];

export default {
  titre: 'Drive',
  async rendre(ctx) {
    const params = new URLSearchParams({
      type: ctx.params.type || '',
      theme: ctx.params.theme || '',
      statut: ctx.params.statut || '',
      recherche: ctx.params.recherche || '',
      limite: '120',
    });
    const { contenus, statistiques } = await ctx.api(`/api/contenus?${params}`);
    const octets = statistiques.octets;
    const taille = octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;

    const galerie = contenus.length
      ? `<div class="galerie">${contenus
          .map(
            (c) => `<article class="vignette" data-action="detail" data-id="${c.id}">
              <div class="vignette-image">
                ${c.image ? `<img loading="lazy" src="${c.image}" alt="${echapper(c.themeLibelle)}" />` : ''}
                ${badgeType(c.type)}
                <span class="statut">${badge(c.statut)}</span>
              </div>
              <div class="vignette-meta">
                <div class="vignette-titre">${echapper((c.description || '').split('\n')[0].slice(0, 64))}</div>
                <div class="vignette-sous"><span>${c.emoji} ${echapper(c.themeLibelle)}</span>${c.jourPrevu ? `<span>· ${dateFr(c.jourPrevu, { court: true })}</span>` : ''}</div>
              </div>
            </article>`,
          )
          .join('')}</div>`
      : vide('Aucun contenu', 'Modifiez les filtres ou lancez une synchronisation.');

    return `${entete(
      'Drive de contenus',
      'Chaque contenu est généré (visuel + légende) ou importé, puis publié automatiquement entre 16 h et 00 h.',
      `<button class="btn btn-fantome" data-action="synchroniser">Synchroniser</button>
       <button class="btn btn-primaire" data-action="upload">Ajouter un média</button>`,
    )}

    <div class="grille g4">
      ${kpi('Contenus', nf(statistiques.total), `${nf(statistiques.parType.Reel || 0)} Reels · ${nf(statistiques.parType.Story || 0)} Stories`)}
      ${kpi('En attente', nf((statistiques.parStatut.Planifie || 0) + (statistiques.parStatut.Telecharge || 0)), 'prêts pour publication', { progression: statistiques.total ? (((statistiques.parStatut.Planifie || 0) + (statistiques.parStatut.Telecharge || 0)) / statistiques.total) * 100 : 0 })}
      ${kpi('Publiés', nf(statistiques.parStatut.Publie || 0), 'sortis vers Instagram', { progression: statistiques.total ? ((statistiques.parStatut.Publie || 0) / statistiques.total) * 100 : 0, couleur: 'mint' })}
      ${kpi('Stockage', taille, `${nf(statistiques.fichiers)} fichier(s) · ${statistiques.googleDriveActif ? 'Google Drive' : 'Drive local'}`)}
    </div>

    ${carte(
      'Bibliothèque',
      `<div class="filtres mb-0" style="margin-bottom:14px">
        ${selecteur('type', TYPES, ctx.params.type || '', { libelle: 'Format' })}
        ${selecteur('theme', THEMES, ctx.params.theme || '', { libelle: 'Thème' })}
        ${selecteur('statut', STATUTS, ctx.params.statut || '', { libelle: 'Statut' })}
        <input class="input" style="min-width:220px" placeholder="Rechercher un contenu…" data-filtre-recherche="recherche" value="${echapper(ctx.params.recherche || '')}" />
        <span class="small muet">${nf(contenus.length)} résultat(s)</span>
      </div>
      ${galerie}`,
      { sous: `Dossier ${statistiques.dossier}` },
    )}

    <div class="grille g2 mt-16">
      ${carte(
        'Répartition par thème',
        `<div class="flex-col gap-8">${Object.entries(statistiques.parTheme)
          .sort((a, b) => b[1] - a[1])
          .map(([theme, n]) => {
            const emoji = { fitness: '🏋️', nutrition: '🥗', running: '🏃', bienetre: '🧘', ia: '🤖' }[theme] || '✨';
            const libelle = { fitness: 'Fitness', nutrition: 'Nutrition', running: 'Running', bienetre: 'Bien-être', ia: 'IA & productivité' }[theme] || theme;
            const max = Math.max(...Object.values(statistiques.parTheme), 1);
            return `<div class="flex gap-8"><span class="small" style="flex:0 0 140px">${emoji} ${libelle}</span>
              <div class="progression" style="flex:1;height:8px"><span style="width:${(n / max) * 100}%"></span></div>
              <span class="mono tiny" style="flex:0 0 34px;text-align:right">${n}</span></div>`;
          })
          .join('')}</div>`,
      )}
      ${carte(
        'Cycle de vie d’un contenu',
        `<div class="flex-col gap-8 small">
          <div class="flex gap-8"><span class="badge bleu">1</span><span>Génération du visuel et de la légende dans le Drive.</span></div>
          <div class="flex gap-8"><span class="badge violet">2</span><span>Téléchargement et vérification de la qualité (R5).</span></div>
          <div class="flex gap-8"><span class="badge ambre">3</span><span>Planification dans la fenêtre 16 h → 00 h.</span></div>
          <div class="flex gap-8"><span class="badge mint">4</span><span>Publication, collecte des réactions, puis archivage.</span></div>
          <div class="sep"></div>
          <div class="small muet">Un contenu déjà publié ne peut pas être supprimé : il est archivé afin de conserver l’historique.</div>
        </div>`,
      )}
    </div>
    `;
  },
  monter(racine, ctx) {
    brancherFiltres(racine, ctx, () => ctx.rafraichir());

    brancherActions(racine, ctx, {
      async detail(bouton) {
        const { contenu } = await ctx.api(`/api/contenus/${bouton.dataset.id}`);
        const actions = [
          contenu.statut !== 'Publie' ? `<button class="btn btn-fantome" data-action="telecharger" data-id="${contenu.id}">Marquer téléchargé</button>` : '',
          contenu.statut !== 'Publie' && contenu.statut !== 'Archive' ? `<button class="btn btn-fantome" data-action="archiver" data-id="${contenu.id}">Archiver</button>` : '',
          contenu.statut !== 'Publie' ? `<button class="btn btn-danger" data-action="supprimer" data-id="${contenu.id}">Supprimer</button>` : '',
        ].join('');
        const voile = ctx.modale({
          titre: `${contenu.themeLibelle} · ${contenu.type}`,
          corps: `<div class="modale-grille">
            <div>
              <div class="apercu-media"><img src="${contenu.image}" alt="aperçu" /></div>
              <div class="flex gap-8 wrap mt-12">${badgeType(contenu.type)} ${badge(contenu.statut)} ${badge(contenu.themeLibelle, 'gris')}</div>
              <div class="small muet mt-8">Ajouté le ${heureFr(contenu.dateAjout, { avecDate: true })}${contenu.jourPrevu ? ` · prévu le ${dateFr(contenu.jourPrevu)}` : ''}</div>
              <div class="small muet mono tiny mt-8">${echapper(contenu.cheminPublic || '')}</div>
            </div>
            <div>
              <div class="carte-titre" style="margin-bottom:8px">Légende & description</div>
              <div class="small" style="white-space:pre-wrap;max-height:420px;overflow:auto;background:var(--surface-2);border:1px solid var(--trait);border-radius:6px;padding:12px">${echapper(contenu.description || '')}</div>
            </div>
          </div>`,
          pied: `<button class="btn btn-fantome" data-fermer>Fermer</button>${actions}`,
          largeur: 900,
        });
        voile.querySelectorAll('[data-action]').forEach((element) => {
          element.addEventListener('click', async () => {
            const id = element.dataset.id;
            try {
              if (element.dataset.action === 'telecharger') await ctx.api(`/api/contenus/${id}/telecharger`, { method: 'POST' });
              if (element.dataset.action === 'archiver') await ctx.api(`/api/contenus/${id}/archiver`, { method: 'POST' });
              if (element.dataset.action === 'supprimer') await ctx.api(`/api/contenus/${id}`, { method: 'DELETE' });
              ctx.toast('Contenu mis à jour.', { type: 'succes' });
              ctx.fermerModale();
              await ctx.rafraichir();
            } catch (erreur) {
              ctx.toast(erreur.message, { type: 'erreur' });
            }
          });
        });
      },
      async synchroniser() {
        const resultat = await ctx.api('/api/contenus/synchroniser', { method: 'POST' });
        ctx.toast(`${resultat.importes} contenu(s) importé(s) · ${resultat.total} au total.`, { type: 'succes', titre: 'Drive synchronisé' });
        await ctx.rafraichir();
      },
      async upload() {
        const voile = ctx.modale({
          titre: 'Ajouter un média au Drive',
          corps: `<div class="dropzone" id="zone-depot">
              <div style="font-size:26px;margin-bottom:6px">⬆️</div>
              <b>Glissez un fichier ici</b> ou cliquez pour choisir<br>
              <span class="tiny">Vidéo (mp4, mov, webm) ou image (jpg, png, webp, svg) · 25 Mo max</span>
              <input type="file" id="champ-fichier" accept="video/*,image/*" style="display:none" />
            </div>
            <div class="grille g2 mt-16">
              <div class="field"><label>Format</label><select class="select" id="type-media"><option value="Reel">Reel</option><option value="Story">Story</option><option value="UnePleine">Une</option></select></div>
              <div class="field"><label>Thème</label><select class="select" id="theme-media">${THEMES.filter((t) => t.valeur).map((t) => `<option value="${t.valeur}">${t.libelle}</option>`).join('')}</select></div>
              <div class="field" style="grid-column:1/-1"><label>Description / légende</label><textarea class="textarea" id="description-media" placeholder="Décrivez le contenu (utilisé comme légende)"></textarea></div>
            </div>
            <div id="apercu-fichier" class="mt-12"></div>`,
          pied: `<button class="btn btn-fantome" data-fermer>Annuler</button><button class="btn btn-primaire" data-envoyer>Ajouter au Drive</button>`,
          largeur: 640,
        });
        const zone = voile.querySelector('#zone-depot');
        const champ = voile.querySelector('#champ-fichier');
        let fichier = null;
        const choisir = (f) => {
          if (!f) return;
          fichier = f;
          voile.querySelector('#apercu-fichier').innerHTML = `<div class="badge mint">${echapper(f.name)} · ${(f.size / 1024).toFixed(0)} Ko</div>`;
          zone.classList.add('survol');
        };
        zone.addEventListener('click', () => champ.click());
        champ.addEventListener('change', () => choisir(champ.files[0]));
        zone.addEventListener('dragover', (evenement) => {
          evenement.preventDefault();
          zone.classList.add('survol');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('survol'));
        zone.addEventListener('drop', (evenement) => {
          evenement.preventDefault();
          choisir(evenement.dataTransfer.files[0]);
        });
        voile.querySelector('[data-envoyer]').addEventListener('click', async (evenement) => {
          if (!fichier) {
            ctx.toast('Choisissez d’abord un fichier.', { type: 'alerte' });
            return;
          }
          const bouton = evenement.currentTarget;
          bouton.disabled = true;
          try {
            const base64 = await lireFichierBase64(fichier);
            await ctx.api('/api/contenus/upload', {
              corps: {
                nomFichier: fichier.name,
                mime: fichier.type,
                donneesBase64: base64,
                type: voile.querySelector('#type-media').value,
                theme: voile.querySelector('#theme-media').value,
                description: voile.querySelector('#description-media').value,
              },
            });
            ctx.toast('Média ajouté au Drive.', { type: 'succes' });
            ctx.fermerModale();
            await ctx.rafraichir();
          } catch (erreur) {
            ctx.toast(erreur.message, { type: 'erreur' });
          } finally {
            bouton.disabled = false;
          }
        });
      },
    });
  },
};

function lireFichierBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'));
    lecteur.readAsDataURL(fichier);
  });
}
