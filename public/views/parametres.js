import { echapper, nf, badge, dateFr } from '../lib/ui.js';
import { entete, carte, kpi, brancherActions } from './commun.js';

const PAYS = [
  { cle: 'USA', libelle: 'États-Unis', drapeau: '🇺🇸' },
  { cle: 'France', libelle: 'France', drapeau: '🇫🇷' },
  { cle: 'RoyaumeUni', libelle: 'Royaume-Uni', drapeau: '🇬🇧' },
  { cle: 'Allemagne', libelle: 'Allemagne', drapeau: '🇩🇪' },
  { cle: 'Pologne', libelle: 'Pologne', drapeau: '🇵🇱' },
  { cle: 'AutresPays', libelle: 'Autres pays (liste fournie)', drapeau: '🌍' },
];

export default {
  titre: 'Paramètres',
  async rendre(ctx) {
    const etat = ctx.etat;
    const { compte, agent, statistiques } = await ctx.api('/api/compte');
    const { parametres } = await ctx.api('/api/audience');

    return `${entete(
      'Paramètres',
      'La configuration initiale est manuelle et réalisée une seule fois (R1). Ensuite, le moteur travaille seul.',
      `<button class="btn btn-fantome" data-action="archiver">Archiver les données</button>
       <button class="btn btn-primaire" data-action="enregistrer-tout">Enregistrer</button>`,
    )}

    <div class="grille g-sidebar">
      ${carte(
        'Profil du compte Instagram',
        `<div class="flex gap-16 mb-0" style="margin-bottom:14px;flex-wrap:wrap">
          <img class="avatar-rond avatar-grand" src="/api/compte/photo" alt="" onerror="this.style.display='none'"/>
          <div style="flex:1;min-width:220px">
            <div class="flex gap-8 wrap">${badge(compte.statut, compte.configurationOk ? 'mint' : 'ambre')}<span class="badge gris">${echapper(compte.mode)}</span><span class="badge violet">${compte.ageMinimum} ans +</span></div>
            <div class="small muet mt-8">Créé le ${dateFr(compte.dateCreation.slice(0, 10))} · cycle ${compte.cycleActuel || 0} · ${nf(statistiques.publications || 0)} publication(s)</div>
          </div>
        </div>
        <div class="grille g2">
          <div class="field"><label>Nom d’utilisateur</label><input class="input" id="champ-username" value="${echapper(compte.username)}" /></div>
          <div class="field"><label>Nom affiché</label><input class="input" id="champ-nom" value="${echapper(compte.nomComplet || '')}" /></div>
          <div class="field" style="grid-column:1/-1"><label>Bio</label><textarea class="textarea" id="champ-bio" maxlength="220">${echapper(compte.bio || '')}</textarea><span class="aide">220 caractères max · le lien est ajouté en bio</span></div>
          <div class="field"><label>Lien en bio</label><input class="input" id="champ-lien" value="${echapper(compte.lienBio || '')}" /></div>
          <div class="field"><label>Localisation</label><input class="input" id="champ-localisation" value="${echapper(compte.localisation || '')}" /></div>
          <div class="field"><label>Âge minimum de l’audience</label><input class="input" type="number" id="champ-age" min="25" value="${compte.ageMinimum}" /><span class="aide">Plancher imposé : 25 ans (R9)</span></div>
          <div class="field"><label>Genre ciblé</label>
            <select class="select" id="champ-genre">${['NonPrecise', 'Femme', 'Homme', 'NonBinaire'].map((g) => `<option value="${g}" ${compte.gender === g ? 'selected' : ''}>${g === 'NonPrecise' ? 'Non précisé' : g}</option>`).join('')}</select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Mot de passe Instagram (chiffré, jamais utilisé pour se connecter)</label><input class="input" type="password" id="champ-mdp" placeholder="••••••••" autocomplete="new-password" /><span class="aide">Stocké chiffré (AES-256-GCM) pour respecter le diagramme de classes ; aucune connexion automatisée n’est effectuée.</span></div>
        </div>`,
        { sous: 'R1 · configuration manuelle unique' },
      )}

      <div class="flex-col" style="gap:14px">
        ${carte(
          'Paramètres d’audience',
          `<div class="flex-col gap-4">
            ${PAYS.map(
              (p) => `<label class="flex gap-8 small" style="cursor:pointer;padding:5px 0">
                <input type="checkbox" class="pays-case" value="${p.cle}" ${parametres.paysAutorises.includes(p.cle) ? 'checked' : ''} style="accent-color:#8b5cf6"/>
                <span>${p.drapeau} ${p.libelle}</span>
              </label>`,
            ).join('')}
          </div>
          <div class="sep"></div>
          <div class="field"><label>Âge minimum</label><input class="input" type="number" id="champ-age-audience" min="25" value="${parametres.ageMinimum}" /></div>
          <div class="field mt-8"><label>Genre</label>
            <select class="select" id="champ-genre-audience">${['NonPrecise', 'Femme', 'Homme', 'NonBinaire'].map((g) => `<option value="${g}" ${parametres.genre === g ? 'selected' : ''}>${g === 'NonPrecise' ? 'Tous' : g}</option>`).join('')}</select>
          </div>
          <div class="small muet mt-12">Toute cible hors pays autorisé ou âgée de moins de 25 ans est rejetée avant interaction.</div>`,
          { sous: 'R7 & R9 · appliqués à chaque cible' },
        )}
        ${carte(
          'Responsable',
          `<div class="flex gap-12 mb-0" style="margin-bottom:12px">
            <div style="width:42px;height:42px;border-radius:12px;background:var(--degrade);display:grid;place-items:center;font-weight:800">${echapper((agent.prenom || '')[0] || 'R')}</div>
            <div><div style="font-weight:700">${echapper(`${agent.prenom} ${agent.nom}`.trim())}</div><div class="small muet">${echapper(agent.role)}</div></div>
          </div>
          <div class="flex-col gap-8">
            <div class="field"><label>Prénom</label><input class="input" id="champ-prenom-agent" value="${echapper(agent.prenom || '')}" /></div>
            <div class="field"><label>Email</label><input class="input" type="email" id="champ-email-agent" value="${echapper(agent.email || '')}" /></div>
          </div>`,
        )}
      </div>
    </div>

    <div class="grille g3 mt-16">
      ${kpi('Mode Instagram', etat.mode === 'graph' ? 'Graph API' : 'Simulation', etat.mode === 'graph' ? 'publication réelle' : '100 % autonome, sans identifiants')}
      ${kpi('Fuseau horaire', etat.fuseau, 'fenêtre 16 h → 00 h')}
      ${kpi('Vitesse de l’horloge', `${etat.horloge.vitesse} min/s`, 'réglable dans la barre du haut')}
    </div>

    ${carte(
      'Contrôle du moteur',
      `<div class="grille g4">
        <div>
          <div class="carte-titre">État</div>
          <div class="small muet">${etat.horloge.etat === 'en_cours' ? 'Le moteur exécute le cycle.' : etat.horloge.etat === 'en_pause' ? 'Le moteur est en pause.' : 'Le moteur est arrêté.'}</div>
          <div class="flex gap-6 mt-12">
            ${etat.horloge.etat === 'en_cours'
              ? `<button class="btn btn-petit btn-fantome" data-action="pause">Mettre en pause</button>`
              : `<button class="btn btn-petit btn-primaire" data-action="reprendre">Reprendre</button>`}
            <button class="btn btn-petit btn-danger" data-action="arreter">Arrêter</button>
          </div>
        </div>
        <div>
          <div class="carte-titre">Cycle</div>
          <div class="small muet">Jour ${etat.programme.numeroJour}/${etat.programme.joursTotal} · cycle ${etat.programme.cycleNumero}</div>
          <div class="flex gap-6 mt-12"><button class="btn btn-petit btn-fantome" data-action="reinitialiser">Réinitialiser</button></div>
        </div>
        <div>
          <div class="carte-titre">Horloge</div>
          <div class="small muet">${etat.horloge.heure} · ${etat.horloge.etat}</div>
          <div class="flex gap-6 mt-12"><button class="btn btn-petit btn-fantome" data-action="avancer">+30 min</button><button class="btn btn-petit btn-fantome" data-action="fin-jour">Fin de journée</button></div>
        </div>
        <div>
          <div class="carte-titre">Données</div>
          <div class="small muet">${nf(etat.kpis.publications)} publications · ${nf(etat.kpis.interactions)} interactions</div>
          <div class="flex gap-6 mt-12"><a class="btn btn-petit btn-fantome" href="/api/export" target="_blank" rel="noopener">Export JSON</a></div>
        </div>
      </div>`,
      { sous: 'Le moteur démarre automatiquement au lancement du serveur (option ANNUAIRE : cf. .env)' },
    )}

    ${carte(
      'Sécurité & conformité',
      `<div class="grille g2">
        <div class="flex-col gap-6 small">
          <div class="flex entre"><span class="muet">Messages privés envoyés</span>${badge('0', 'mint')}</div>
          <div class="flex entre"><span class="muet">Publications hors 16 h → 00 h</span>${badge('0', 'mint')}</div>
          <div class="flex entre"><span class="muet">Cibles hors zone traitées</span>${badge('0', 'mint')}</div>
          <div class="flex entre"><span class="muet">Cibles mineures traitées</span>${badge('0', 'mint')}</div>
        </div>
        <div class="flex-col gap-6 small">
          <div class="flex entre"><span class="muet">Mot de passe stocké</span>${badge('Chiffré AES-256-GCM', 'violet')}</div>
          <div class="flex entre"><span class="muet">Collecte externe</span>${badge('Aucune (mode simulation)', 'violet')}</div>
          <div class="flex entre"><span class="muet">Données</span><span class="mono tiny">data/insta-va.sqlite</span></div>
          <div class="flex entre"><span class="muet">Fuseau du compte</span><span class="mono tiny">${etat.fuseau}</span></div>
        </div>
      </div>`,
      { classe: 'mt-16' },
    )}
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async 'enregistrer-tout'() {
        const valeur = (id) => racine.querySelector(`#${id}`)?.value ?? '';
        const pays = [...racine.querySelectorAll('.pays-case:checked')].map((c) => c.value);
        try {
          await ctx.api('/api/compte', {
            method: 'PUT',
            corps: {
              username: valeur('champ-username'),
              nomComplet: valeur('champ-nom'),
              bio: valeur('champ-bio'),
              lienBio: valeur('champ-lien'),
              localisation: valeur('champ-localisation'),
              ageMinimum: Number(valeur('champ-age')),
              gender: valeur('champ-genre'),
              motDePasse: valeur('champ-mdp') || undefined,
            },
          });
          await ctx.api('/api/audience', {
            method: 'PUT',
            corps: {
              paysAutorises: pays,
              ageMinimum: Number(valeur('champ-age-audience')),
              genre: valeur('champ-genre-audience'),
            },
          });
          await ctx.api('/api/agent', {
            method: 'PUT',
            corps: { prenom: valeur('champ-prenom-agent'), email: valeur('champ-email-agent') },
          });
          ctx.toast('Configuration enregistrée. Le moteur utilisera ces paramètres dès la prochaine action.', { type: 'succes', titre: 'Paramètres' });
          await ctx.rafraichir();
        } catch (erreur) {
          ctx.toast(erreur.message, { type: 'erreur' });
        }
      },
      async archiver() {
        const ok = await ctx.confirmer('Archiver les données du cycle et repasser les contenus en privé ?', { libelle: 'Archiver' });
        if (!ok) return;
        await ctx.api('/api/compte/archiver', { method: 'POST' });
        ctx.toast('Données archivées.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async pause() {
        await ctx.api('/api/controle/pause', { method: 'POST' });
        await ctx.rafraichir();
      },
      async reprendre() {
        await ctx.api('/api/controle/reprendre', { method: 'POST' });
        await ctx.rafraichir();
      },
      async arreter() {
        const ok = await ctx.confirmer('Arrêter complètement le moteur ? Vous pourrez le relancer à tout moment.', { danger: true, libelle: 'Arrêter' });
        if (!ok) return;
        await ctx.api('/api/controle/arreter', { method: 'POST' });
        ctx.toast('Moteur arrêté.', { type: 'alerte' });
        await ctx.rafraichir();
      },
      async reinitialiser() {
        const ok = await ctx.confirmer('Réinitialiser le cycle (jour 1) en conservant l’historique ?', { danger: true, libelle: 'Réinitialiser' });
        if (!ok) return;
        await ctx.api('/api/compte/reinitialiser-cycle', { corps: { conserverHistorique: true } });
        ctx.toast('Cycle réinitialisé.', { type: 'succes' });
        await ctx.rafraichir();
      },
      async avancer() {
        await ctx.api('/api/controle/avancer', { corps: { minutes: 30 } });
        await ctx.rafraichir();
      },
      async 'fin-jour'() {
        await ctx.api('/api/controle/fin-jour', { method: 'POST' });
        await ctx.rafraichir();
      },
    });
  },
};
