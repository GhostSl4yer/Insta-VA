import { echapper, nf, badge, drapeau, nomPays, heureFr, vide, toast } from '../lib/ui.js';
import { entete, carte, kpi, barreProgression, brancherActions } from './commun.js';

const STATUTS = { ARepondre: ['À répondre', 'ambre'], Repondu: ['Répondu', 'mint'], Echec: ['Échec', 'rouge'] };

/* Trafic externe : le seul indicateur qui ne vienne pas d'Instagram. */
export default {
  titre: 'Lien & commentaires',
  async rendre(ctx) {
    const [{ liens, statistiques, urlPublique }, { reponses, statistiques: statsReponses, actif }] = await Promise.all([
      ctx.api('/api/liens'),
      ctx.api('/api/commentaires?limite=150'),
    ]);

    const base = (urlPublique || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');
    // `statistiques.parLien` porte les clics de la fenêtre (30 j) par code de lien.
    const clicsParLien = Object.fromEntries(statistiques.parLien.map((l) => [l.code, l.clics]));
    const actifs = liens.filter((l) => l.actif);
    const principal = actifs.slice().sort((a, b) => (clicsParLien[b.code] || 0) - (clicsParLien[a.code] || 0))[0] || null;
    const maxPays = Math.max(1, ...statistiques.parPays.map((p) => p.clics));

    const lignesLiens = liens
      .map(
        (l) => `<tr>
        <td style="min-width:190px">
          <div style="font-weight:600;font-size:12.5px">${echapper(l.libelle || 'Lien de suivi')}</div>
          <div class="tiny muet mono">${echapper(l.url)}</div>
        </td>
        <td class="mono tiny">${echapper(`${base}/l/${l.code}`)}</td>
        <td class="droite mono">${nf(l.clics)}</td>
        <td class="droite mono">${nf(clicsParLien[l.code] || 0)}</td>
        <td>${l.actif ? badge('Actif', 'mint') : badge('Désactivé', 'gris')}</td>
        <td class="serre droite">
          <button class="btn btn-petit btn-fantome" data-action="copier" data-code="${echapper(l.code)}">Copier</button>
          ${l.actif ? `<button class="btn btn-petit btn-fantome" data-action="desactiver" data-id="${echapper(l.id)}">Désactiver</button>` : ''}
        </td>
      </tr>`,
      )
      .join('');

    const lignesReponses = reponses
      .map(
        (r) => `<tr>
        <td style="min-width:120px"><div style="font-weight:600;font-size:12.5px">@${echapper(r.auteur || 'inconnu')}</div>
          <div class="tiny muet">${heureFr(r.dateCommentaire, { avecDate: true })}</div></td>
        <td style="max-width:360px"><div class="small">${echapper(r.texteRecu)}</div>
          ${r.reponse ? `<div class="tiny muet" style="margin-top:4px">↳ ${echapper(r.reponse)}</div>` : ''}</td>
        <td>${badge(r.langue === 'en' ? 'EN' : 'FR', 'gris')} ${badge(r.intention || 'neutre', 'bleu')}</td>
        <td>${badge(...(STATUTS[r.statut] || [r.statut || '—', 'gris']))}</td>
        <td class="serre droite">
          ${
            r.statut === 'ARepondre'
              ? `<button class="btn btn-petit btn-fantome" data-action="repondre" data-id="${echapper(r.id)}">Répondre</button>`
              : ''
          }
        </td>
      </tr>`,
      )
      .join('');

    const corpsFormulaire = `<div class="field"><label>Adresse de destination</label>
        <input class="input" id="lien-url" placeholder="https://…" autocomplete="off" />
        <span class="aide">Adresse réellement visitée après le clic. Seuls http et https sont acceptés.</span></div>
      <div class="field" style="margin-top:10px"><label>Libellé interne</label>
        <input class="input" id="lien-libelle" placeholder="Bio, Story, Reel…" maxlength="60" /></div>
      <div class="flex gap-8" style="margin-top:12px">
        <button class="btn btn-primaire" data-action="creer">Créer le lien</button>
        <span class="tiny muet" style="align-self:center">Le code court est généré une fois, jamais réutilisé.</span>
      </div>`;

    const corpsLiens = liens.length
      ? `<div class="tableau-zone"><table class="tableau">
          <thead><tr><th>Libellé</th><th>Adresse courte</th><th class="droite">Total</th><th class="droite">30 j</th><th>État</th><th></th></tr></thead>
          <tbody>${lignesLiens}</tbody>
        </table></div>`
      : vide('Aucun lien', 'Créez un lien puis placez-le en bio pour mesurer le trafic externe.');

    const corpsReponses = reponses.length
      ? `<div class="tableau-zone"><table class="tableau">
          <thead><tr><th>Commentaire</th><th>Contenu</th><th>Analyse</th><th>Statut</th><th></th></tr></thead>
          <tbody>${lignesReponses}</tbody>
        </table></div>`
      : vide(
          actif ? 'Aucun commentaire reçu' : 'Réponses désactivées',
          actif
            ? `La collecte passe toutes les ${nf(Math.max(5, 20))} minutes pendant la journée active (16 h → 00 h).`
            : 'Activez INSTAVA_REPONSES_COMMENTAIRES pour collecter et répondre automatiquement aux commentaires.',
        );

    const corpsPays = statistiques.parPays.length
      ? statistiques.parPays
          .map(
            (p) => `<div style="margin-bottom:10px">
              <div class="flex tiny" style="margin-bottom:4px;justify-content:space-between"><span>${drapeau(p.pays)} ${echapper(nomPays(p.pays))}</span><span class="mono muet">${nf(p.clics)}</span></div>
              ${barreProgression((p.clics / maxPays) * 100, { couleur: 'mint' })}
            </div>`,
          )
          .join('')
      : '<div class="tiny muet">Aucun clic enregistré pour l’instant.</div>';

    const corpsVolume = `<div class="flex-col" style="gap:10px">
        ${kpi('Clics · 30 jours', nf(statistiques.total), 'toutes sources')}
        ${barreProgression(statistiques.moyenneJour ? Math.min(100, (statistiques.aujourdhui / statistiques.moyenneJour) * 100) : 0, {
          couleur: 'mint',
        })}
        <div class="tiny muet">Aujourd’hui ${nf(statistiques.aujourdhui)} · moyenne ${nf(statistiques.moyenneJour, 1)} / jour</div>
      </div>`;

    const corpsPrincipal = principal
      ? `<div class="mono small" style="word-break:break-all">${echapper(`${base}/l/${principal.code}`)}</div>
         <div class="tiny muet" style="margin-top:6px">Lien conseillé pour la bio · ${nf(clicsParLien[principal.code] || 0)} clic(s) sur 30 jours</div>
         <div class="tiny muet" style="margin-top:10px">La redirection n’enregistre ni adresse IP ni identifiant : seuls le jour, le pays et le code du lien sont conservés.</div>`
      : '<div class="tiny muet">Créez un lien pour obtenir une adresse courte.</div>';

    return `${entete(
      'Lien & commentaires',
      'Le lien en bio mesure le trafic externe (clics réels). Les réponses aux commentaires reçus sont la seule interaction sortante autorisée par l’API Instagram.',
      '<a class="btn btn-fantome" href="#/statistiques">Voir les statistiques</a>',
    )}

    <div class="grille g4">
      ${kpi('Clics aujourd’hui', nf(statistiques.aujourdhui), 'trafic externe')}
      ${kpi('Clics · 7 jours', nf(statistiques.septJours), 'fenêtre glissante')}
      ${kpi('Clics · 30 jours', nf(statistiques.total), `${nf(actifs.length)} lien(s) actif(s)`)}
      ${kpi('Réponses publiées', nf(statsReponses.repondues), `${nf(statsReponses.aRepondre)} en attente`)}
    </div>

    <div class="grille g-sidebar" style="margin-top:18px">
      <div class="flex-col" style="gap:18px">
        ${carte('Nouveau lien de suivi', corpsFormulaire, { sous: 'redirection mesurée' })}
        ${carte('Liens de suivi', corpsLiens, { sous: `${nf(liens.length)} lien(s)` })}
        ${carte('Commentaires reçus', corpsReponses, {
          sous: actif ? `taux de réponse ${nf(statsReponses.taux)} %` : 'désactivé',
          actions:
            actif && statsReponses.aRepondre
              ? '<button class="btn btn-primaire btn-petit" data-action="repondre-tout">Répondre à tout</button>'
              : '',
        })}
      </div>

      <div class="flex-col" style="gap:18px">
        ${carte('Volume', corpsVolume, { sous: 'fenêtre glissante' })}
        ${carte('Provenance', corpsPays, { sous: 'pays des visiteurs' })}
        ${carte('Lien en bio', corpsPrincipal, { sous: 'recommandé' })}
      </div>
    </div>`;
  },

  monter(racine, ctx) {
    const valeur = (id) => racine.querySelector(`#${id}`)?.value?.trim() || '';
    brancherActions(racine, ctx, {
      async creer() {
        const url = valeur('lien-url');
        const libelle = valeur('lien-libelle');
        if (!url) {
          toast('Renseignez l’adresse de destination.', { type: 'erreur' });
          return;
        }
        try {
          await ctx.api('/api/liens', { method: 'POST', corps: { url, libelle } });
          toast('Lien créé.', { type: 'succes' });
          await ctx.rafraichir();
        } catch (erreur) {
          toast(erreur.message || 'Création impossible.', { type: 'erreur' });
        }
      },
      async copier(bouton) {
        const url = `${location.origin}/l/${bouton.dataset.code}`;
        try {
          await navigator.clipboard.writeText(url);
          toast('Adresse copiée.', { type: 'succes' });
        } catch {
          toast(url);
        }
      },
      async desactiver(bouton) {
        await ctx.api(`/api/liens/${bouton.dataset.id}`, { method: 'DELETE' });
        toast('Lien désactivé : les clics ne sont plus comptés.');
        await ctx.rafraichir();
      },
      async repondre(bouton) {
        try {
          await ctx.api(`/api/commentaires/${bouton.dataset.id}/repondre`, { method: 'POST', corps: {} });
          toast('Réponse publiée.', { type: 'succes' });
          await ctx.rafraichir();
        } catch (erreur) {
          toast(erreur.message || 'Réponse impossible.', { type: 'erreur' });
        }
      },
      async 'repondre-tout'() {
        const enAttente = [...racine.querySelectorAll('[data-action="repondre"]')];
        let faites = 0;
        for (const bouton of enAttente) {
          try {
            await ctx.api(`/api/commentaires/${bouton.dataset.id}/repondre`, { method: 'POST', corps: {} });
            faites += 1;
          } catch {
            /* un échec isolé ne bloque pas les autres */
          }
        }
        toast(`${faites} réponse(s) publiée(s).`, { type: faites ? 'succes' : 'erreur' });
        await ctx.rafraichir();
      },
    });
  },
};
