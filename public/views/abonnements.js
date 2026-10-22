import { echapper, nf, badge, drapeau, nomPays, tempsRelatif, vide } from '../lib/ui.js';
import { entete, carte, kpi, brancherActions, pastilleAvatar, tableau } from './commun.js';

export default {
  titre: 'Abonnements',
  async rendre(ctx) {
    const { abonnements } = await ctx.api('/api/abonnements');
    const references = abonnements.filter((a) => a.estReference);
    const ratioRef = abonnements.length ? (references.length / abonnements.length) * 100 : 0;
    const conformeR6 = ratioRef >= 12 && ratioRef <= 25;

    const lignes = abonnements.map(
      (a) => `<tr>
        <td><div class="flex gap-8">${pastilleAvatar(a.username, 30)}
          <div><div style="font-weight:600;font-size:12.5px">@${echapper(a.username)}</div>
          <div class="tiny muet">${echapper(a.categorie || '')} · ${nf(a.nombreAbonnes)} abonnés</div></div></div></td>
        <td class="serre">${drapeau(a.pays)} ${echapper(nomPays(a.pays))}</td>
        <td>${a.estReference ? badge('Compte de référence', 'rose') : badge('Audience', 'violet')}</td>
        <td>${badge(a.abonnement)}</td>
        <td class="serre mono tiny muet">${tempsRelatif(a.dateSuivi)}</td>
        <td>${a.suivi ? badge('Suivi actif', 'mint') : badge('Inactif', 'gris')}</td>
        <td class="droite"><button class="btn btn-petit btn-fantome" data-action="statut" data-id="${a.id}">Vérifier</button></td>
      </tr>`,
    );

    return `${entete(
      'Abonnements & comptes suivis',
      'Le bot suit des comptes qualifiés et, en priorité, des comptes de référence de la niche (R6 : 12 à 25 % du volume).',
      `<a class="btn btn-primaire" href="#/cibles">Trouver de nouvelles cibles</a>`,
    )}

    <div class="grille g4">
      ${kpi('Abonnements actifs', nf(abonnements.length), 'comptes suivis par l’avatar')}
      ${kpi('Comptes de référence', nf(references.length), `${ratioRef.toFixed(0)} % du volume (R6)`)}
      ${kpi('Conformité R6', conformeR6 ? 'Conforme' : 'À ajuster', `${ratioRef.toFixed(1)} % — cible 12 à 25 %`, { progression: Math.min(100, ratioRef * 4), couleur: conformeR6 ? 'mint' : 'ambre' })}
      ${kpi('Catégories', new Set(abonnements.map((a) => a.categorie)).size, 'niches couvertes')}
    </div>

    ${carte(
      'Comptes suivis',
      `${tableau(
        [
          { libelle: 'Compte' },
          { libelle: 'Pays' },
          { libelle: 'Rôle' },
          { libelle: 'Type d’abonnement' },
          { libelle: 'Depuis' },
          { libelle: 'Statut' },
          { libelle: '', classe: 'droite' },
        ],
        lignes,
      )}`,
      { sous: `${nf(abonnements.length)} abonnement(s) — aucun message privé n’est envoyé à ces comptes` },
    )}

    <div class="grille g2 mt-16">
      ${carte(
        'Pourquoi suivre les comptes de référence ?',
        `<div class="flex-col gap-8 small" style="color:var(--encre-2)">
          <p style="margin:0">Le diagramme impose de suivre les comptes de référence <strong>et leurs abonnés</strong> : c’est le levier principal de découverte pour un compte qui démarre.</p>
          <div class="flex gap-8"><span class="badge mint">1</span><span>Le bot identifie les comptes de référence de la niche (fitness, nutrition, running, bien-être, IA).</span></div>
          <div class="flex gap-8"><span class="badge mint">2</span><span>Il suit le compte de référence et les profils qualifiés qui interagissent avec lui.</span></div>
          <div class="flex gap-8"><span class="badge mint">3</span><span>Il vérifie ensuite le statut de l’abonnement (réciprocité, désabonnement) et l’enregistre.</span></div>
          <div class="flex gap-8"><span class="badge mint">4</span><span>Chaque suivi est plafonné à 1 par cible et historisé pour éviter le spam.</span></div>
        </div>`,
      )}
      ${carte(
        'Contrôles de conformité',
        `<div class="flex-col gap-8">
          <div class="flex entre small"><span class="muet">Comptes de référence / total</span><strong class="mono">${ratioRef.toFixed(1)} %</strong></div>
          <div class="progression ${conformeR6 ? 'mint' : 'ambre'}"><span style="width:${Math.min(100, ratioRef * 4)}%"></span></div>
          <div class="flex entre small"><span class="muet">Cible R6</span><span class="mono">12 % → 25 %</span></div>
          <div class="sep"></div>
          <div class="flex entre small"><span class="muet">Messages privés envoyés</span>${badge('0', 'mint')}</div>
          <div class="flex entre small"><span class="muet">Suivis hors zone</span>${badge('0', 'mint')}</div>
          <div class="flex entre small"><span class="muet">Suivis de comptes &lt; 25 ans</span>${badge('0', 'mint')}</div>
        </div>`,
      )}
    </div>
    `;
  },
  monter(racine, ctx) {
    brancherActions(racine, ctx, {
      async statut(bouton) {
        const resultat = await ctx.api(`/api/abonnements/${bouton.dataset.id}/statut`);
        ctx.modale({
          titre: 'Statut de l’abonnement',
          corps: `<div class="flex-col gap-8 small">
            <div class="flex entre"><span class="muet">Abonnement</span><strong>${echapper(resultat.abonnement)}</strong></div>
            <div class="flex entre"><span class="muet">Actif</span>${resultat.actif ? badge('Oui', 'mint') : badge('Non', 'gris')}</div>
            <div class="flex entre"><span class="muet">Suivi confirmé</span>${resultat.suivi ? badge('Oui', 'mint') : badge('Non', 'ambre')}</div>
          </div>`,
          largeur: 460,
        });
      },
    });
  },
};
