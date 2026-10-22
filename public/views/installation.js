import { echapper, nf } from '../lib/ui.js';
import { entete } from './commun.js';

/**
 * Mise en service de la production.
 *
 * Chaque bloc enregistre une donnée fournie par le responsable. Tant que
 * l'ensemble n'est pas complet, le moteur ne démarre pas : rien n'est inventé.
 */

const PAYS = [
  { cle: 'USA', libelle: 'États-Unis' },
  { cle: 'France', libelle: 'France' },
  { cle: 'RoyaumeUni', libelle: 'Royaume-Uni' },
  { cle: 'Allemagne', libelle: 'Allemagne' },
  { cle: 'Pologne', libelle: 'Pologne' },
  { cle: 'AutresPays', libelle: 'Autres pays autorisés' },
];

const TYPES = [
  { cle: 'Reel', libelle: 'Reel (vidéo)' },
  { cle: 'Story', libelle: 'Story (image)' },
  { cle: 'UnePleine', libelle: 'Une pleine (image)' },
  { cle: 'PhotoProfil', libelle: 'Photo de profil' },
];

let etatLocal = null;

function bloc(numero, titre, sous, etape, contenu) {
  const fait = etape?.fait;
  return `<section class="carte" data-etape="${etape?.cle || ''}">
    <div class="carte-entete">
      <div class="carte-titre">
        <span class="etape-num ${fait ? 'fait' : ''}">${fait ? '✓' : numero}</span>
        ${echapper(titre)}
      </div>
      <div class="carte-actions">
        <span class="badge ${fait ? 'mint' : 'gris'}">${fait ? 'Fourni' : 'À fournir'}</span>
      </div>
    </div>
    <div class="carte-sous" style="margin:-8px 0 14px">${echapper(sous)}</div>
    ${contenu}
  </section>`;
}

function champ(nom, libelle, valeur = '', { type = 'text', aide = '', requis = false, placeholder = '' } = {}) {
  return `<label class="field">
    <span>${echapper(libelle)}${requis ? ' *' : ''}</span>
    <input class="input" name="${nom}" type="${type}" value="${echapper(valeur)}"
      placeholder="${echapper(placeholder)}" ${requis ? 'required' : ''} autocomplete="off"/>
    ${aide ? `<span class="aide">${echapper(aide)}</span>` : ''}
  </label>`;
}

function page(etat) {
  const configuration = etat.configuration || { etapes: [], complete: false };
  const etapes = Object.fromEntries((configuration.etapes || []).map((e) => [e.cle, e]));
  const compte = etat.compte || {};
  const avatar = compte.avatar || {};
  const agent = etat.agent || {};
  const audience = etat.audience || {};
  const paysActifs = audience.paysAutorises || ['USA', 'France', 'RoyaumeUni', 'Allemagne', 'Pologne', 'AutresPays'];
  const contenus = configuration.compteurs?.contenus ?? 0;
  const complete = configuration.complete;

  const banniere = complete
    ? `<div class="carte" style="border-color:var(--trait-fort)">
        <div class="flex entre wrap">
          <div>
            <div class="carte-titre">Configuration complète</div>
            <div class="carte-sous">Le moteur peut démarrer. Les données affichées proviennent désormais de vos contenus.</div>
          </div>
          <div class="flex gap-8">
            ${etat.horloge?.etat === 'en_cours' ? '<span class="badge mint">Moteur en cours</span>' : '<button class="btn btn-primaire" data-demarrer>Démarrer le moteur</button>'}
            <a class="btn btn-fantome" href="#/">Tableau de bord</a>
          </div>
        </div>
      </div>`
    : `<div class="carte" style="border-color:var(--trait-fort)">
        <div class="carte-titre">${configuration.manquants?.length || 0} élément(s) à fournir</div>
        <div class="carte-sous">Le moteur reste à l’arrêt tant que la configuration n’est pas complète.
        Aucune donnée de démonstration n’est créée en production.</div>
      </div>`;

  return `${entete('Mise en service', 'Renseignez les données réelles du compte. Chaque bloc est enregistré séparément.')}
  ${banniere}

  <div class="grille g2 mt-16">
    ${bloc(1, 'Responsable', 'La personne qui exploite la console et reçoit les alertes.', etapes.agent, `
      <form data-form="agent" class="flex-col gap-12">
        <div class="grille g2">
          ${champ('prenom', 'Prénom', agent.prenom || '', { requis: true })}
          ${champ('nom', 'Nom', agent.nom || '', { requis: true })}
        </div>
        ${champ('email', 'Adresse e-mail', agent.email || '', { type: 'email', aide: 'Utilisée pour les rapports et alertes.' })}
        <div><button class="btn btn-primaire" type="submit">Enregistrer le responsable</button></div>
      </form>`)}

    ${bloc(2, 'Compte Instagram', 'Le compte réel qui sera piloté. Aucun compte de démonstration n’est créé.', etapes.compte, `
      <form data-form="compte" class="flex-col gap-12">
        ${champ('username', 'Nom d’utilisateur', compte.username || '', { requis: true, placeholder: 'mon.compte' })}
        ${champ('nomComplet', 'Nom affiché', avatar.nomInstagram || compte.nomComplet || '', { requis: true })}
        ${champ('lienBio', 'Lien de la bio', compte.lienBio || '', { placeholder: 'https://…' })}
        ${champ('localisation', 'Localisation', compte.localisation || '', { placeholder: 'Ville, pays' })}
        <label class="field">
          <span>Bio</span>
          <textarea class="textarea" name="bio" maxlength="500" placeholder="Présentation du compte…">${echapper(compte.bio || '')}</textarea>
        </label>
        <div><button class="btn btn-primaire" type="submit">Enregistrer le compte</button></div>
      </form>`)}

    ${bloc(3, 'Audience', 'Règles de ciblage appliquées par le moteur.', etapes.audience, `
      <form data-form="audience" class="flex-col gap-12">
        <div class="grille g2">
          <label class="field"><span>Âge minimum</span>
            <input class="input" name="ageMinimum" type="number" min="25" max="99" value="${Number(audience.ageMinimum) || 25}"/>
            <span class="aide">Plancher imposé : 25 ans.</span>
          </label>
          <label class="field"><span>Genre ciblé</span>
            <select class="select" name="genre">
              ${['NonPrecise', 'Femme', 'Homme', 'Autre']
                .map((g) => `<option value="${g}" ${audience.genre === g ? 'selected' : ''}>${g === 'NonPrecise' ? 'Indifférent' : g}</option>`)
                .join('')}
            </select>
          </label>
        </div>
        <div class="field"><span>Pays autorisés</span>
          <div class="flex wrap gap-12">
            ${PAYS.map((p) => `<label class="toggle"><input type="checkbox" name="pays" value="${p.cle}" ${paysActifs.includes(p.cle) ? 'checked' : ''}/> ${echapper(p.libelle)}</label>`).join('')}
          </div>
        </div>
        <div><button class="btn btn-primaire" type="submit">Enregistrer l’audience</button></div>
      </form>`)}

    ${bloc(4, 'Identifiants Instagram Graph', 'Nécessaires pour publier réellement. Le jeton est chiffré avant stockage.', etapes.identifiants, `
      <form data-form="graph" class="flex-col gap-12">
        ${champ('userId', 'Identifiant du compte (IG_USER_ID)', '', { placeholder: '17841400000000000' })}
        ${champ('token', 'Jeton d’accès (long-lived)', '', { type: 'password', aide: 'Stocké chiffré (AES-256-GCM), jamais réaffiché en clair.' })}
        <div class="small muet">${echapper(etapes.identifiants?.detail || '')}</div>
        <div><button class="btn btn-primaire" type="submit">Enregistrer les identifiants</button></div>
      </form>`)}

    ${bloc(5, 'Contenus', `Médias réels publiés par le moteur. Actuellement : ${nf(contenus)} contenu(s).`, etapes.contenus, `
      <form data-form="contenus" class="flex-col gap-12">
        <div class="grille g2">
          <label class="field"><span>Type de contenu</span>
            <select class="select" name="type">${TYPES.map((t) => `<option value="${t.cle}">${t.libelle}</option>`).join('')}</select>
          </label>
          ${champ('description', 'Légende (optionnel)', '')}
        </div>
        <label class="field"><span>Fichiers</span>
          <input class="input" name="fichiers" type="file" multiple accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"/>
          <span class="aide">MP4, MOV, WebM, JPG, PNG, WebP · 25 Mo maximum par fichier.</span>
        </label>
        <div class="progression" data-progression style="display:none"><span></span></div>
        <div class="small muet" data-journal></div>
        <div><button class="btn btn-primaire" type="submit">Importer les contenus</button></div>
      </form>`)}

    ${bloc(6, 'Validation', 'Vérifie que toutes les données sont fournies, puis autorise le démarrage.', { cle: 'final', fait: complete }, `
      <div class="flex-col gap-12">
        <div class="liste">
          ${(configuration.etapes || [])
            .map(
              (e) => `<div class="ligne-liste">
                <div class="ligne-principal">
                  <div class="ligne-titre">${echapper(e.libelle)}</div>
                  <div class="ligne-sous">${echapper(e.detail || '')}</div>
                </div>
                <span class="badge ${e.fait ? 'mint' : 'gris'}">${e.fait ? 'OK' : 'Manquant'}</span>
              </div>`,
            )
            .join('')}
        </div>
        <div class="flex gap-8 wrap">
          <button class="btn btn-primaire" data-finaliser ${complete ? '' : 'disabled'}>Valider et démarrer</button>
          <span class="small muet">${complete ? 'Toutes les données sont fournies.' : 'Complétez les blocs ci-dessus.'}</span>
        </div>
      </div>`)}
  </div>`;
}

async function recharger(ctx) {
  etatLocal = await ctx.api('/api/configuration');
  ctx.etat.configuration = etatLocal;
  const racine = document.getElementById('vue');
  if (racine) racine.innerHTML = page({ ...ctx.etat, configuration: etatLocal });
  return etatLocal;
}

function message(racine, texte, type = 'info') {
  const zone = racine.querySelector('[data-journal]');
  if (zone) {
    zone.textContent = texte;
    zone.style.color = type === 'erreur' ? 'var(--danger)' : 'var(--success, var(--encre))';
  }
}

async function lireFichier(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => rejeter(new Error('Lecture du fichier impossible'));
    lecteur.readAsDataURL(fichier);
  });
}

export default {
  titre: 'Mise en service',
  async rendre(ctx) {
    if (!ctx.etat) return '<div class="vide">Connexion au moteur…</div>';
    return page(ctx.etat);
  },
  async monter(racine, ctx) {
    const rafraichir = async () => {
      await ctx.rafraichir();
    };

    racine.querySelectorAll('form[data-form]').forEach((formulaire) => {
      formulaire.addEventListener('submit', async (evenement) => {
        evenement.preventDefault();
        const bouton = formulaire.querySelector('button[type="submit"]');
        const type = formulaire.dataset.form;
        bouton.disabled = true;
        try {
          const donnees = Object.fromEntries(new FormData(formulaire).entries());
          if (type === 'agent') {
            await ctx.api('/api/configuration/agent', { corps: donnees });
          } else if (type === 'compte') {
            await ctx.api('/api/configuration/compte', { corps: donnees });
          } else if (type === 'audience') {
            const pays = [...formulaire.querySelectorAll('input[name="pays"]:checked')].map((c) => c.value);
            await ctx.api('/api/audience', {
              corps: { ageMinimum: Number(donnees.ageMinimum), genre: donnees.genre, paysAutorises: pays },
              method: 'PUT',
            });
          } else if (type === 'graph') {
            await ctx.api('/api/configuration/graph', { corps: { userId: donnees.userId, token: donnees.token } });
          } else if (type === 'contenus') {
            const fichiers = [...(formulaire.querySelector('[name="fichiers"]')?.files || [])];
            if (!fichiers.length) throw new Error('Sélectionnez au moins un fichier.');
            const progression = formulaire.querySelector('[data-progression] span');
            const barre = formulaire.querySelector('[data-progression]');
            if (barre) barre.style.display = '';
            let faits = 0;
            for (const fichier of fichiers) {
              if (fichier.size > 25 * 1024 * 1024) throw new Error(`${fichier.name} dépasse 25 Mo.`);
              message(racine, `Import de ${fichier.name}…`);
              const donneesBase64 = await lireFichier(fichier);
              await ctx.api('/api/contenus/upload', {
                corps: {
                  nomFichier: fichier.name,
                  mime: fichier.type,
                  donneesBase64,
                  type: donnees.type,
                  description: donnees.description || '',
                },
              });
              faits += 1;
              if (progression) progression.style.width = `${Math.round((faits / fichiers.length) * 100)}%`;
            }
            message(racine, `${faits} fichier(s) importé(s).`);
          }
          ctx.toast('Enregistré.', { type: 'succes' });
          await rafraichir();
        } catch (erreur) {
          message(racine, erreur.message, 'erreur');
          ctx.toast(erreur.message, { type: 'erreur' });
        } finally {
          bouton.disabled = false;
        }
      });
    });

    racine.querySelector('[data-finaliser]')?.addEventListener('click', async (evenement) => {
      const bouton = evenement.currentTarget;
      bouton.disabled = true;
      try {
        await ctx.api('/api/configuration/finaliser', { corps: {} });
        ctx.toast('Configuration validée, moteur démarré.', { type: 'succes', titre: 'Mise en service' });
        await ctx.rafraichir();
        window.location.hash = '#/';
      } catch (erreur) {
        ctx.toast(erreur.message, { type: 'erreur' });
        bouton.disabled = false;
      }
    });
  },
};
