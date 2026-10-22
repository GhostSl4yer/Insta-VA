/**
 * Concepts éditoriaux : chaque concept produit des Reels, Stories, publications « une »
 * et fournit accroche, légende, hashtags et musique tendance.
 */

export const THEMES = Object.freeze({
  fitness: { libelle: 'Fitness', couleur: '#FF5C7A', emoji: '🏋️' },
  nutrition: { libelle: 'Nutrition', couleur: '#42C58A', emoji: '🥗' },
  running: { libelle: 'Running', couleur: '#3D9BF5', emoji: '🏃' },
  bienetre: { libelle: 'Bien-être', couleur: '#9B7BF7', emoji: '🧘' },
  ia: { libelle: 'IA & productivité', couleur: '#F5A742', emoji: '🤖' },
});

export const PALETTES = Object.freeze({
  corail: { fond: ['#FF7A59', '#FF3D6E'], texte: '#FFF6F2', halo: '#FFB199', accent: '#2B1020' },
  menthe: { fond: ['#0E9F6E', '#0B6E5E'], texte: '#F0FFF9', halo: '#7CE3B8', accent: '#062B22' },
  nuit: { fond: ['#14213D', '#4B2E83'], texte: '#F4F1FF', halo: '#8E7DFF', accent: '#0A0F1E' },
  sable: { fond: ['#E8A25B', '#C96A3B'], texte: '#FFF9F0', halo: '#FFD9A8', accent: '#3A1C0C' },
  aurore: { fond: ['#6A5CFF', '#FF6FAE'], texte: '#FFFFFF', halo: '#FFD2E4', accent: '#1A1035' },
  graphite: { fond: ['#2B2F36', '#101317'], texte: '#F2F5F7', halo: '#5EC4FF', accent: '#05070A' },
});

export const MUSIQUES = Object.freeze([
  { titres: 'Golden Hour Drive', artiste: 'Neon Palm', genre: 'Lofi house', duree: '2:14' },
  { titres: 'Run It Back', artiste: 'KOLA', genre: 'Afro house', duree: '2:48' },
  { titres: 'Slow Rise', artiste: 'Mira Sol', genre: 'Ambient pop', duree: '3:02' },
  { titres: 'Power Hour', artiste: 'DJ Aria', genre: 'Phonk soft', duree: '2:06' },
  { titres: 'Sunset Sprint', artiste: 'The Paces', genre: 'Indie dance', duree: '2:31' },
  { titres: 'Steady State', artiste: 'Lumen', genre: 'Deep house', duree: '2:57' },
  { titres: 'Breathe Again', artiste: 'Yara', genre: 'R&B chill', duree: '3:11' },
  { titres: 'Morning Fuel', artiste: 'Kofi Beats', genre: 'Afrobeats', duree: '2:22' },
  { titres: 'No Excuses', artiste: 'Vanta', genre: 'Trap sportif', duree: '1:58' },
  { titres: 'Green Light', artiste: 'Onda', genre: 'Latin pop', duree: '2:35' },
  { titres: 'Quiet Power', artiste: 'Studio Sève', genre: 'Piano moderne', duree: '2:44' },
  { titres: 'Full Send', artiste: 'Rue 22', genre: 'House française', duree: '2:39' },
]);

export const HASHTAGS = Object.freeze({
  fitness: ['#fitness', '#fitnessmotivation', '#strengthtraining', '#homeworkout', '#fitfam', '#trainsmart', '#coachlife'],
  nutrition: ['#nutrition', '#highprotein', '#mealprep', '#healthyrecipes', '#eatclean', '#foodisfuel'],
  running: ['#running', '#runtok', '#marathontraining', '#5k', '#runnerlife', '#runclub'],
  bienetre: ['#wellness', '#mindset', '#morningroutine', '#sleepwell', '#selfcare', '#breathwork'],
  ia: ['#AI', '#avatarAI', '#productivity', '#futureofwork', '#tavia', '#digitaltwin'],
  local: ['#miami', '#miamifit', '#southbeach', '#miamilife'],
  marque: ['#mayarivera', '#coachmaya', '#tavia'],
});

export const CONCEPTS = Object.freeze([
  {
    id: 'matin-15min',
    theme: 'fitness',
    format: 'Reel',
    titre: 'La routine de 15 minutes qui change le matin',
    accroche: '15 minutes.\nPas d’excuse.',
    sousTitre: 'Routine matinale full body',
    caption:
      "Je testais cette routine depuis 3 semaines et mes matins ne ressemblent plus à rien de ce que je faisais avant.\n\n" +
      '15 minutes, 4 mouvements, zéro matériel (ou juste une chaise) :\n' +
      '1) Squat au poids du corps · 40 s\n' +
      '2) Pompe sur les genoux · 30 s\n' +
      '3) Fente arrière alternée · 40 s\n' +
      '4) Gainage + respiration · 45 s\n' +
      '3 tours. C’est tout.\n\n' +
      'Le vrai secret : la régularité, pas l’intensité. Tu commences demain avec moi ?',
    cta: 'Dis-moi « MATIN » en commentaire et je t’envoie la version PDF.',
    hashtagsTheme: 'fitness',
    durees: [18, 42],
  },
  {
    id: 'proteines-assiette',
    theme: 'nutrition',
    format: 'Reel',
    titre: '30 g de protéines dans une assiette simple',
    accroche: '30 g de protéines.\nEn 10 minutes.',
    sousTitre: 'Assiette express post-entraînement',
    caption:
      'Tout le monde parle de protéines, personne ne montre quoi mettre dans l’assiette.\n\n' +
      'Voilà ma base :\n' +
      '• 150 g de poulet mariné citron-paprika\n' +
      '• 200 g de riz basmati + 1 c. à soupe d’huile d’olive\n' +
      '• Légumes croquants + herbes fraîches\n' +
      '• 1 yaourt grec en dessert (10 g de protéines en plus)\n\n' +
      'Enregistre pour ta prochaine session de meal prep. 🍋',
    cta: 'Enregistre ce Reel et dis-moi ton aliment préféré post-training.',
    hashtagsTheme: 'nutrition',
    durees: [22, 48],
  },
  {
    id: 'course-negative-split',
    theme: 'running',
    format: 'Reel',
    titre: 'Le negative split expliqué simplement',
    accroche: 'Pars moins vite.\nArrive plus fort.',
    sousTitre: 'Le negative split en 20 secondes',
    caption:
      'Le negative split, c’est courir la seconde moitié plus vite que la première. Ça paraît simple… et pourtant, c’est là que la plupart des coureurs explosent.\n\n' +
      'Mon protocole pour un 5 km :\n' +
      '• 2 premiers km : respire par le nez, allète confortable\n' +
      '• km 3 : relance de 10 s toutes les 2 min\n' +
      '• km 4-5 : laisse les jambes parler\n\n' +
      'Testé sur mon dernier 10 km : 48:12, une meilleure sensation du début à la fin. 🏁',
    cta: 'Quel est ton prochain chrono cible ? Dis-le en commentaire.',
    hashtagsTheme: 'running',
    durees: [25, 55],
  },
  {
    id: 'respiration-478',
    theme: 'bienetre',
    format: 'Reel',
    titre: 'La respiration 4-7-8 avant de dormir',
    accroche: '4 · 7 · 8\nTa nuit change.',
    sousTitre: 'Rituel du soir en 3 minutes',
    caption:
      'Je m’endormais avec mon téléphone, je me réveillais avec mon anxiété. J’ai testé la respiration 4-7-8 pendant 10 jours.\n\n' +
      'Comment faire :\n' +
      '• Inspire 4 secondes\n' +
      '• Retiens 7 secondes\n' +
      '• Expire 8 secondes\n' +
      '• 4 cycles, deux fois par jour\n\n' +
      'Résultat chez moi : endormissement plus rapide, réveils nocturnes réduits. Ce n’est pas magique, c’est de l’entraînement. 🌙',
    cta: 'Sauvegarde pour ce soir, et raconte-moi ta nuit demain.',
    hashtagsTheme: 'bienetre',
    durees: [20, 40],
  },
  {
    id: 'avatar-ia-demo',
    theme: 'ia',
    format: 'Reel',
    titre: 'Mon double IA publie-t-il à ma place ?',
    accroche: 'Mon double IA.\nEn direct.',
    sousTitre: 'Découvre l’avatar derrière le compte',
    caption:
      'Je m’appelle Maya, je suis coach. Et depuis quelques semaines, mon avatar IA m’aide à publier, analyser et répondre — sans jamais inventer ma voix.\n\n' +
      'Ce que l’avatar fait :\n' +
      '• prépare les publications de 16 h à minuit\n' +
      '• analyse les performances pays par pays\n' +
      '• prépare mes rapports et priorise mes prochaines actions\n\n' +
      'Ce que je garde : mes mots, mes valeurs, mon lien de contact.\n\n' +
      'Le lien est en bio si tu veux tester le tien. 🤖',
    cta: 'Le lien de l’avatar est en bio — dis-moi ce que tu en penses.',
    hashtagsTheme: 'ia',
    durees: [30, 60],
  },
  {
    id: 'meal-prep-dimanche',
    theme: 'nutrition',
    format: 'Reel',
    titre: 'Meal prep de 45 minutes pour la semaine',
    accroche: '45 minutes.\n5 déjeuners.',
    sousTitre: 'Meal prep du dimanche',
    caption:
      'Le dimanche, c’est mon rituel : 45 minutes en cuisine et la semaine est réglée.\n\n' +
      'Au menu :\n' +
      '• Riz + poulet rôti citron-romarin\n' +
      '• Boulgour + légumes rôtis\n' +
      '• Œufs mollets + avocat + graines\n' +
      '• Sauce blanche protéinée (yaourt grec + citron + ail)\n\n' +
      'Astuce : tout cuire en même temps au four sur deux plaques. Zéro vaisselle en plus.',
    cta: 'Commente « PREP » si tu veux la liste de courses.',
    hashtagsTheme: 'nutrition',
    durees: [28, 60],
  },
  {
    id: 'force-progressive',
    theme: 'fitness',
    format: 'Reel',
    titre: '3 semaines pour progresser sans salle',
    accroche: 'Plus fort.\nSans salle.',
    sousTitre: 'Progression en 3 semaines',
    caption:
      'Tu n’as pas besoin d’une salle pour progresser. Tu as besoin d’un plan et d’un carnet.\n\n' +
      'Semaine 1 : 30 s par mouvement, 3 tours\n' +
      'Semaine 2 : 40 s par mouvement, 3 tours\n' +
      'Semaine 3 : 45 s par mouvement, 4 tours\n\n' +
      'Mouvements : squat, pompe, fente, gainage, pont fessier, superman.\n' +
      'La clé, c’est de noter ce que tu fais. Ce qui se mesure progresse.',
    cta: 'Enregistre et note ta semaine 1.',
    hashtagsTheme: 'fitness',
    durees: [20, 45],
  },
  {
    id: 'sommeil-recuperation',
    theme: 'bienetre',
    format: 'Reel',
    titre: 'Ton corps progresse quand tu dors',
    accroche: 'Le progrès\nse joue la nuit.',
    sousTitre: 'Récupération & sommeil profond',
    caption:
      'On parle beaucoup de séances, jamais de récupération. Pourtant, c’est là que le corps s’adapte.\n\n' +
      'Mes 3 non-négociables :\n' +
      '• Dernier écran 45 min avant le lit\n' +
      '• Chambre à 18 °C, noire\n' +
      '• Même heure de réveil, même le week-end\n\n' +
      'Ajoute 10 minutes de respiration et tu as une récupération qui travaille pour toi.',
    cta: 'Quelle est ton heure de coucher idéale ?',
    hashtagsTheme: 'bienetre',
    durees: [22, 50],
  },
  {
    id: '5k-debutant',
    theme: 'running',
    format: 'Reel',
    titre: 'De 0 à 5 km en 6 semaines',
    accroche: 'Premier 5 km.\nEn 6 semaines.',
    sousTitre: 'Plan marche/course',
    caption:
      'Tu veux courir 5 km sans t’arrêter ? Voici le plan que je donne à mes débutants.\n\n' +
      'Semaines 1-2 : 1 min course / 2 min marche × 8\n' +
      'Semaines 3-4 : 3 min course / 1 min marche × 6\n' +
      'Semaine 5 : 8 min course / 1 min marche × 4\n' +
      'Semaine 6 : 5 km d’une traite (sans regarder l’allure)\n\n' +
      '3 séances par semaine, jamais deux jours de suite au début. La marche n’est pas un échec : c’est la stratégie.',
    cta: 'Tague un ami qui veut s’y mettre.',
    hashtagsTheme: 'running',
    durees: [26, 58],
  },
  {
    id: 'hydratation-electrolytes',
    theme: 'nutrition',
    format: 'UnePleine',
    titre: 'Electrolytes : le détail qui change tout',
    accroche: 'Bois.\nMieux.',
    sousTitre: 'Hydratation & électrolytes',
    caption:
      'Boire 2 L d’eau ne suffit pas si tu transpires beaucoup.\n\n' +
      'Ma règle :\n' +
      '• 500 ml au réveil\n' +
      '• 1 pincée de sel + jus de citron avant la séance\n' +
      '• 150 ml toutes les 20 min pendant l’effort\n' +
      '• Eau + repas salé après\n\n' +
      'Pas besoin de potions hors de prix. L’essentiel : eau, sodium, potassium, régularité.',
    cta: 'Commente 💧 si tu bois assez aujourd’hui.',
    hashtagsTheme: 'nutrition',
    durees: [20, 40],
  },
  {
    id: 'temoignage-12semaines',
    theme: 'fitness',
    format: 'UnePleine',
    titre: '12 semaines de constance, pas de magie',
    accroche: '12 semaines.\nZéro magie.',
    sousTitre: 'La constance bat l’intensité',
    caption:
      'Ce n’est pas une transformation spectaculaire. C’est juste 12 semaines de constance :\n\n' +
      '• 3 séances par semaine\n' +
      '• 2 g de protéines par kilo de poids de corps\n' +
      '• 7 h de sommeil minimum\n' +
      '• 1 séance de marche active\n\n' +
      'Le résultat ne vient pas d’un programme secret, mais de la répétition. Toujours.',
    cta: 'Quel est ton objectif à 12 semaines ?',
    hashtagsTheme: 'fitness',
    durees: [24, 50],
  },
  {
    id: 'focus-deep-work',
    theme: 'ia',
    format: 'UnePleine',
    titre: 'Le deep work appliqué à ton entraînement',
    accroche: '90 minutes.\nZéro distraction.',
    sousTitre: 'Focus & performance',
    caption:
      'J’applique la même règle à ma séance qu’à mon travail : 90 minutes sans téléphone.\n\n' +
      'Pourquoi ? La récupération mentale et la qualité de mouvement augmentent quand tu ne sautes pas d’une notification à l’autre.\n\n' +
      'Essaie : mode avion, playlist fixe, un objectif par séance. La différence se sent dès la deuxième semaine.',
    cta: 'Tu testes demain ? Dis-moi.',
    hashtagsTheme: 'ia',
    durees: [18, 40],
  },
  {
    id: 'etirements-5min',
    theme: 'bienetre',
    format: 'Story',
    titre: '5 étirements de 30 secondes',
    accroche: '30 s par zone.\n5 zones.',
    sousTitre: 'Étirements express du soir',
    caption:
      'La routine du soir quand j’ai passé 8 h assise :\n' +
      '• Ischio-jambiers · 30 s\n' +
      '• Psoas · 30 s\n' +
      '• Haut du dos · 30 s\n' +
      '• Ouverture de poitrine · 30 s\n' +
      '• Nuque · 30 s\n\n' +
      'Respiration lente, jamais dans la douleur.',
    cta: 'Fais un selfie après — tu verras ta posture changer.',
    hashtagsTheme: 'bienetre',
    durees: [12, 26],
  },
  {
    id: 'recette-bowl',
    theme: 'nutrition',
    format: 'Story',
    titre: 'Le bowl de 10 minutes',
    accroche: '10 minutes.\nUn bowl complet.',
    sousTitre: 'Déjeuner express',
    caption:
      'Base : quinoa cuit + épinards.\n' +
      'Protéine : thon, pois chiches ou poulet.\n' +
      'Croustillant : chou rouge, graines.\n' +
      'Sauce : yaourt grec, citron, tahini, poivre.\n\n' +
      'C’est tout. Rapide, coloré, rassasiant.',
    cta: 'Quelle base tu préfères : riz, quinoa ou pâtes complètes ?',
    hashtagsTheme: 'nutrition',
    durees: [10, 24],
  },
  {
    id: 'sortie-longue',
    theme: 'running',
    format: 'Story',
    titre: 'Le long run du dimanche',
    accroche: 'Dimanche.\nSortie longue.',
    sousTitre: 'Prépa du semi',
    caption:
      'Le dimanche, c’est sortie longue : 75 minutes en endurance fondamentale, allure conversationnelle.\n\n' +
      'Checklist :\n' +
      '• 500 ml d’eau avant\n' +
      '• 1 gel toutes les 45 min\n' +
      '• Retour au calme 10 min\n\n' +
      'La régularité du dimanche fait la différence le jour de la course.',
    cta: 'Tu cours combien de km le dimanche ?',
    hashtagsTheme: 'running',
    durees: [15, 32],
  },
  {
    id: 'astuce-proteine-vege',
    theme: 'nutrition',
    format: 'Story',
    titre: 'Protéines végétales : le trio gagnant',
    accroche: 'Sans viande.\nAvec protéines.',
    sousTitre: 'Trio veggie 30 g',
    caption:
      'Lentilles + riz = profil complet.\n' +
      'Tofu ferme + sésame = calcium & protéines.\n' +
      'Pois chiches + yaourt grec = crémeux et riche.\n\n' +
      'Astuce : associe toujours une légumineuse et une céréale.',
    cta: 'Commente ton assiette veggie préférée.',
    hashtagsTheme: 'nutrition',
    durees: [12, 28],
  },
  {
    id: 'check-in-mensuel',
    theme: 'bienetre',
    format: 'Story',
    titre: 'Check-in de fin de mois',
    accroche: 'Le bilan\ndu mois.',
    sousTitre: 'Mesure, ajuste, recommence',
    caption:
      'Trois questions chaque fin de mois :\n' +
      '1) Qu’est-ce qui a marché ?\n' +
      '2) Qu’est-ce que je garde ?\n' +
      '3) Qu’est-ce que j’allège ?\n\n' +
      'Un objectif sans bilan, c’est une intention. Avec bilan, c’est un système.',
    cta: 'Réponds en story : c’est quoi ton détail de ce mois ?',
    hashtagsTheme: 'bienetre',
    durees: [14, 30],
  },
  {
    id: 'mobilité-bureau',
    theme: 'fitness',
    format: 'Story',
    titre: '3 minutes de mobilité au bureau',
    accroche: 'Assis depuis 8 h ?\n3 minutes.',
    sousTitre: 'Mobilité express au bureau',
    caption:
      'Les 4 mouvements que je fais entre deux réunions :\n' +
      '• Rotation thoracique · 10 par côté\n' +
      '• Étirement psoas debout · 30 s par côté\n' +
      '• Ouverture de poitrine contre le mur · 30 s\n' +
      '• Fentes avec rotation · 8 par côté\n\n' +
      'Ton dos te remerciera ce soir.',
    cta: 'Fais-les maintenant, sérieusement.',
    hashtagsTheme: 'fitness',
    durees: [10, 22],
  },
  {
    id: 'coulisses-avatar',
    theme: 'ia',
    format: 'Story',
    titre: 'Coulisses : comment mon avatar prépare la journée',
    accroche: '16 h.\nLa journée commence.',
    sousTitre: 'Coulisses de l’avatar IA',
    caption:
      '16 h : le compte passe en mode création.\n' +
      'Stories planifiées, Reel du jour, interactions préparées.\n\n' +
      'Tout est orchestré par mon avatar IA, à partir de mes contenus et de mes règles. Aucun message privé n’est envoyé : uniquement des commentaires et des likes sur les publications pertinentes.\n\n' +
      'La transparence fait partie du système.',
    cta: 'Questions sur le fonctionnement ? Pose-les en commentaire.',
    hashtagsTheme: 'ia',
    durees: [16, 34],
  },
  {
    id: 'portrait-coach',
    theme: 'fitness',
    format: 'PhotoProfil',
    titre: 'Portrait de l’avatar',
    accroche: 'Maya\nRivera',
    sousTitre: 'Coach · Miami',
    caption: 'Photo de profil générée pour l’avatar IA.',
    cta: '',
    hashtagsTheme: 'fitness',
    durees: [0, 0],
  },
]);

export const NOMS_PLUS_POPULAIRES = Object.freeze([
  'Maya Rivera',
  'Maya Rivera · Coach',
  'Maya | Coach fitness',
  'Maya Rivera 🌿',
]);
