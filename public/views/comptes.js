import { echapper, nf, badge, toast } from '../lib/ui.js';
import { entete, carte, kpi, brancherActions } from './commun.js';

/**
 * Gestion des comptes Instagram (jusqu'à ~50).
 *
 * Chaque ligne regroupe les variables réellement nécessaires au compte :
 * identifiant, jeton Graph (chiffré côté serveur), lien du dossier Drive
 * partagé, fuseau et heure de début. L'import CSV/JSON permet de charger la
 * liste d'un coup ; le formulaire sert aux corrections.
 */

const VIDE = {
  username: '',
  nomComplet: '',
  bio: '',
  igUserId: '',
  jeton: '',
  driveUrl: '',
  fuseau: 'Africa/Porto-Novo',
  heureDebut: '16:00',
  notes: '',
  actif: true,
};

const COULEUR_STATUT = { Actif: 'mint', EnAttente: 'ambre', Suspendu: 'gris', Erreur: 'rouge' };

export default {
  titre: 'Comptes Instagram',
  async rendre(ctx) {
    const { comptes, actifs } = await ctx.api('/api/comptes');
    const courant = ctx.etat?.compte || null;
    const enAttente = comptes.filter((c) => c.statut !== 'Actif').length;

    const lignes = comptes.length
      ? comptes
          .map(
            (c) => `<tr ${c.id === courant?.id ? 'class="ligne-active"' : ''}>
        <td><div style="font-weight:600">@${echapper(c.username)}</div>
          <div class="tiny muet">${echapper(c.nomComplet || '—')}</div></td>
        <td>${badge(c.statut, COULEUR_STATUT[c.statut] || 'gris')}</td>
        <td class="mono tiny">${echapper(c.igUserId || '—')}</td>
        <td class="tiny">${c.driveFolderId ? `<span class="mono">${echapper(c.driveFolderId.slice(0, 10))}…</span>` : '<span class="muet">manquant</span>'}</td>
        <td class="tiny">${echapper(c.fuseau)} · ${echapper(c.heureDebut)}</td>
        <td class="serre droite">
          <button class="btn btn-petit btn-fantome" data-action="modifier" data-id="${echapper(c.id)}">Modifier</button>
          ${c.id === courant?.id ? '' : `<button class="btn btn-petit btn-fantome" data-action="selectionner" data-id="${echapper(c.id)}">Ouvrir</button>`}
          <button class="btn btn-petit btn-fantome" data-action="supprimer" data-id="${echapper(c.id)}">Supprimer</button>
        </td>
      </tr>`,
          )
          .join('')
      : '';

    return `${entete(
      'Comptes Instagram',
      'Un seul moteur pilote tous les comptes : chaque compte a ses identifiants, son dossier Drive partagé et ses données cloisonnées.',
      `<button class="btn btn-fantome" data-action="import">Importer une liste</button>
       <button class="btn btn-primaire" data-action="nouveau">Nouveau compte</button>`,
    )}

    <div class="grille g4">
      ${kpi('Comptes', nf(comptes.length), `${nf(actifs)} actif(s)`)}
      ${kpi('À compléter', nf(enAttente), 'variables manquantes')}
      ${kpi('Compte ouvert', courant ? `@${echapper(courant.username)}` : '—', 'session courante')}
      ${kpi('Isolation', '1 base', 'données cloisonnées par compte')}
    </div>

    <div class="grille g-sidebar" style="margin-top:18px">
      <div class="flex-col" style="gap:18px">
        ${carte(
          comptes.length
            ? `<div class="tableau-zone"><table class="tableau">
                <thead><tr><th>Compte</th><th>État</th><th>IG user id</th><th>Drive</th><th>Cycle</th><th></th></tr></thead>
                <tbody>${lignes}</tbody>
              </table></div>`
            : '<div class="vide"><b>Aucun compte</b>Créez le premier compte ou importez une liste CSV/JSON.</div>',
          { titre: 'Parc de comptes', sous: `${nf(comptes.length)} compte(s)` },
        )}
        ${carte(
          `<textarea class="textarea" id="import-zone" rows="7" placeholder="username,ig_user_id,jeton,drive_url,fuseau,heure_debut&#10;studio.awa,17841400000000001,EAAB…,https://drive.google.com/drive/folders/…,Africa/Porto-Novo,16:00"></textarea>
           <div class="tiny muet" style="margin-top:8px">CSV avec en-tête ou JSON (tableau d'objets). Un compte existant est mis à jour, pas dupliqué.</div>
           <div class="flex gap-8" style="margin-top:10px">
             <button class="btn btn-primaire" data-action="importer">Importer</button>
             <button class="btn btn-fantome" data-action="fermer-import">Fermer</button>
           </div>`,
          { titre: 'Import en masse', sous: '50 comptes en un copier-coller', zone: 'import', classe: 'masque' },
        )}
      </div>

      <div class="flex-col" style="gap:18px">
        ${carte(
          `<div class="field"><label>Nom d’utilisateur</label><input class="input" id="c-username" value="" placeholder="studio.awa" /></div>
           <div class="field"><label>Nom affiché</label><input class="input" id="c-nom" value="" /></div>
           <div class="field"><label>Bio</label><textarea class="textarea" id="c-bio" rows="3" maxlength="220"></textarea></div>
           <div class="field"><label>IG_USER_ID</label><input class="input" id="c-ig" inputmode="numeric" /></div>
           <div class="field"><label>Jeton d’accès</label><input class="input" id="c-jeton" type="password" placeholder="laisser vide pour conserver" autocomplete="new-password" /></div>
           <div class="field"><label>Dossier Drive partagé</label><input class="input" id="c-drive" placeholder="https://drive.google.com/drive/folders/…" /></div>
           <div class="field"><label>Fuseau horaire</label><input class="input" id="c-fuseau" value="Africa/Porto-Novo" /></div>
           <div class="field"><label>Heure de début</label><input class="input" id="c-heure" value="16:00" /></div>
           <div class="field"><label>Notes</label><input class="input" id="c-notes" /></div>
           <label class="flex gap-8 small"><input type="checkbox" id="c-actif" checked /> Compte actif</label>
           <div class="flex gap-8" style="margin-top:12px">
             <button class="btn btn-primaire" data-action="enregistrer">Enregistrer</button>
             <button class="btn btn-fantome" data-action="tester">Tester les identifiants</button>
           </div>
           <div class="tiny muet" style="margin-top:8px" id="form-aide">Sélectionnez « Modifier » sur une ligne pour charger ses variables.</div>`,
          { titre: 'Variables du compte', sous: 'une fenêtre par compte', zone: 'form' },
        )}
      </div>
    </div>`;
  },

  monter(racine, ctx) {
    let courantId = ctx.etat?.compte?.id || null;
    const champ = (id) => racine.querySelector(`#${id}`);
    const valeur = (id) => champ(id)?.value?.trim() || '';

    const remplir = (compte) => {
      courantId = compte.id;
      champ('c-username').value = compte.username || '';
      champ('c-nom').value = compte.nomComplet || '';
      champ('c-bio').value = compte.bio || '';
      champ('c-ig').value = compte.igUserId || '';
      champ('c-jeton').value = '';
      champ('c-drive').value = compte.driveUrl || '';
      champ('c-fuseau').value = compte.fuseau || 'Africa/Porto-Novo';
      champ('c-heure').value = compte.heureDebut || '16:00';
      champ('c-notes').value = compte.notes || '';
      champ('c-actif').checked = Boolean(compte.actif);
      const aide = racine.querySelector('#form-aide');
      if (aide) aide.textContent = `Édition de @${compte.username}. Laissez le jeton vide pour conserver l’existant.`;
    };

    brancherActions(racine, ctx, {
      nouveau() {
        courantId = null;
        for (const id of ['c-username', 'c-nom', 'c-bio', 'c-ig', 'c-jeton', 'c-drive', 'c-notes']) champ(id).value = '';
        champ('c-fuseau').value = 'Africa/Porto-Novo';
        champ('c-heure').value = '16:00';
        champ('c-actif').checked = true;
        const aide = racine.querySelector('#form-aide');
        if (aide) aide.textContent = 'Nouveau compte : renseignez au minimum le nom d’utilisateur.';
      },
      async modifier(bouton) {
        const { comptes } = await ctx.api('/api/comptes');
        const compte = comptes.find((c) => c.id === bouton.dataset.id);
        if (compte) remplir(compte);
      },
      async enregistrer() {
        const corps = {
          username: valeur('c-username'),
          nomComplet: valeur('c-nom'),
          bio: valeur('c-bio'),
          igUserId: valeur('c-ig'),
          jeton: valeur('c-jeton') || undefined,
          driveUrl: valeur('c-drive'),
          fuseau: valeur('c-fuseau'),
          heureDebut: valeur('c-heure'),
          notes: valeur('c-notes'),
          actif: champ('c-actif').checked,
        };
        try {
          if (courantId) await ctx.api(`/api/comptes/${courantId}`, { method: 'PUT', corps });
          else {
            const { compte } = await ctx.api('/api/comptes', { method: 'POST', corps });
            courantId = compte.id;
          }
          toast('Compte enregistré.', { type: 'succes' });
          await ctx.rafraichir();
        } catch (erreur) {
          toast(erreur.message || 'Enregistrement impossible.', { type: 'erreur' });
        }
      },
      async tester() {
        if (!courantId) {
          toast('Enregistrez le compte avant de tester.', { type: 'erreur' });
          return;
        }
        try {
          const { compte } = await ctx.api(`/api/comptes/${courantId}/tester`, { method: 'POST', corps: {} });
          toast(`Identifiants valides pour @${compte.username}.`, { type: 'succes' });
        } catch (erreur) {
          toast(erreur.message || 'Test impossible.', { type: 'erreur' });
        }
      },
      async selectionner(bouton) {
        await ctx.api(`/api/comptes/${bouton.dataset.id}/selectionner`, { method: 'POST', corps: {} });
        toast('Compte ouvert.');
        await ctx.rafraichir();
        location.reload();
      },
      async supprimer(bouton) {
        const compte = bouton.closest('tr')?.querySelector('td')?.textContent?.trim() || 'ce compte';
        if (!confirm(`Supprimer ${compte} et toutes ses données ? Cette action est définitive.`)) return;
        await ctx.api(`/api/comptes/${bouton.dataset.id}`, { method: 'DELETE' });
        toast('Compte supprimé.');
        await ctx.rafraichir();
      },
      import() {
        racine.querySelector('[data-zone="import"]')?.classList.remove('masque');
      },
      'fermer-import'() {
        racine.querySelector('[data-zone="import"]')?.classList.add('masque');
      },
      async importer() {
        const contenu = racine.querySelector('#import-zone')?.value || '';
        if (!contenu.trim()) {
          toast('Collez une liste CSV ou JSON.', { type: 'erreur' });
          return;
        }
        try {
          const resultat = await ctx.api('/api/comptes/import', { method: 'POST', corps: { contenu } });
          toast(`${resultat.crees.length} créé(s), ${resultat.maj.length} mis à jour, ${resultat.erreurs.length} erreur(s).`, {
            type: resultat.erreurs.length ? 'info' : 'succes',
          });
          await ctx.rafraichir();
        } catch (erreur) {
          toast(erreur.message || 'Import impossible.', { type: 'erreur' });
        }
      },
    });
  },
};
