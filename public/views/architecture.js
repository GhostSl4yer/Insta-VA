import { echapper, nf, badge } from '../lib/ui.js';
import { entete, carte, tableau, brancherActions } from './commun.js';

const COULEURS_TYPE = { classe: 'violet', extension: 'mint', enumeration: 'ambre' };

export default {
  titre: 'Architecture',
  async rendre(ctx) {
    const diagramme = await ctx.api('/api/diagramme');
    const { classes, relations, enumerations, extensions, flux, regles, etapes } = diagramme;

    const cartesClasses = classes
      .map(
        (classe) => `<div class="classe-carte">
          <h4>${echapper(classe.nom)} ${badge(classe.type === 'extension' ? 'extension' : 'classe', COULEURS_TYPE[classe.type] || 'violet')}</h4>
          <p>${echapper(classe.description)}</p>
          <div class="classe-attributs">${classe.attributs.map((a) => `<span>+ ${echapper(a)}</span>`).join('')}</div>
          <div class="classe-methodes">${classe.methodes.map((m) => `<span>+ ${echapper(m)}</span>`).join('')}</div>
          <div class="tiny muet mt-8 mono">${echapper(classe.fichier)}</div>
        </div>`,
      )
      .join('');

    const lignesRelations = relations.map(
      (r) => `<tr>
        <td><span class="code">${echapper(r.de)}</span></td>
        <td class="centre">${badge(r.type, 'violet')}</td>
        <td><span class="code">${echapper(r.vers)}</span></td>
        <td class="mono tiny muet centre">${echapper(r.cardinalite)}</td>
      </tr>`,
    );

    const lignesEnums = enumerations.map(
      (e) => `<div class="ligne-liste">
        <div class="ligne-principal"><div class="ligne-titre">${echapper(e.nom)}</div>
        <div class="flex wrap gap-4 mt-8">${e.valeurs.map((v) => `<span class="badge gris">${echapper(v)}</span>`).join('')}</div></div>
      </div>`,
    );

    return `${entete(
      'Architecture du système',
      'Correspondance entre les deux diagrammes fournis et le code de l’application — classes, relations, énumérations, règles et flux.',
      `<a class="btn btn-fantome" href="/api/export" target="_blank" rel="noopener">Exporter les données</a>
       <span class="badge mint">mode ${diagramme.mode}</span>`,
    )}

    <div class="grille g4">
      <div class="carte"><div class="kpi"><span class="kpi-label">Classes du diagramme</span><div class="kpi-valeur">${classes.filter((c) => c.type === 'classe').length}</div><div class="kpi-delta neutre">+ ${classes.filter((c) => c.type === 'extension').length} extensions</div></div></div>
      <div class="carte"><div class="kpi"><span class="kpi-label">Relations</span><div class="kpi-valeur">${relations.length}</div><div class="kpi-delta neutre">associations, compositions, dépendances</div></div></div>
      <div class="carte"><div class="kpi"><span class="kpi-label">Énumérations</span><div class="kpi-valeur">${enumerations.length}</div><div class="kpi-delta neutre">valeurs contrôlées côté serveur</div></div></div>
      <div class="carte"><div class="kpi"><span class="kpi-label">Règles du système</span><div class="kpi-valeur">${regles.length}</div><div class="kpi-delta neutre">vérifiées à chaque action</div></div></div>
    </div>

    ${carte(
      'Diagramme de classes → implémentation',
      `<div class="grille g3">${cartesClasses}</div>`,
      { sous: 'Chaque classe du diagramme possède un module dédié et des méthodes nommées comme sur le schéma' },
    )}

    <div class="grille g2 mt-16">
      ${carte('Relations', tableau([{ libelle: 'De' }, { libelle: 'Type', classe: 'centre' }, { libelle: 'Vers' }, { libelle: 'Cardinalité', classe: 'centre' }], lignesRelations), { sous: 'Reprises du diagramme de classes' })}
      ${carte(
        'Énumérations',
        `<div class="liste">${lignesEnums.join('')}</div>`,
        { sous: 'Les valeurs sont validées côté serveur avant écriture' },
      )}
    </div>

    <div class="grille g2 mt-16">
      ${carte(
        'Flux du système (8 étapes)',
        `<div class="liste">
          ${flux
            .map(
              (bloc) => `<div style="padding:6px 0;border-bottom:1px solid rgba(148,163,184,.07)">
                <div class="flex gap-8"><span class="badge violet">Jour ${bloc.jour}</span></div>
                <div class="flex-col gap-4 mt-8">${bloc.etapes.map((e) => `<div class="small" style="color:var(--texte-2)">• ${echapper(e)}</div>`).join('')}</div>
              </div>`,
            )
            .join('')}
        </div>`,
      )}
      ${carte(
        'Étapes d’une journée',
        `<div class="liste">${etapes.map(
          (e, index) => `<div class="ligne-liste"><span class="badge violet">${index + 1}</span>
            <div class="ligne-principal"><div class="ligne-titre" style="font-weight:500">${echapper(e)}</div></div></div>`,
        ).join('')}</div>`,
      )}
    </div>

    <div class="grille g2 mt-16">
      ${carte(
        'Règles du système',
        `<div>${regles.map((r) => `<div class="regle"><b>${echapper(r.id)}</b><span>${echapper(r.texte)}</span></div>`).join('')}</div>`,
      )}
      ${carte(
        'Extensions ajoutées',
        `<div class="flex-col gap-12">${extensions
          .map(
            (e) => `<div><div class="carte-titre">${echapper(e.nom)} ${badge('extension', 'mint')}</div>
              <div class="small muet">${echapper(e.description)}</div></div>`,
          )
          .join('')}</div>`,
      )}
    </div>

    ${carte(
      'Pourquoi ce mode de simulation ?',
      `<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <div><div class="carte-titre">Publication</div><p class="small muet" style="margin:4px 0 0">En mode <span class="code">simulation</span>, les publications sont exécutées localement avec un identifiant et un permalien simulés. En mode <span class="code">graph</span>, l’API Instagram Graph publie réellement (compte professionnel + token + médias HTTPS publics requis).</p></div>
        <div><div class="carte-titre">Likes & commentaires</div><p class="small muet" style="margin:4px 0 0">L’API Instagram ne permet pas de liker ou commenter automatiquement. Ces actions sont donc simulées de façon déterministe, comptabilisées, horodatées et filtrées par les règles R4/R7/R9.</p></div>
        <div><div class="carte-titre">Autonomie</div><p class="small muet" style="margin:4px 0 0">Le moteur tourne sans intervention : horloge 16 h → 00 h, cycle de 30 jours, relance automatique, rapports et notifications. Aucune dépendance externe n’est requise.</p></div>
      </div>`,
      { classe: 'mt-16' },
    )}
    `;
  },
  monter(racine, ctx) {
    // Rien à brancher : vue informative.
  },
};
