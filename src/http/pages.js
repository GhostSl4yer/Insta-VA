/**
 * Pages HTML rendues par le serveur (hors SPA) — autonomie complète :
 * aucun appel réseau, styles en ligne, même langage visuel que la console.
 */

const echapper = (texte) =>
  String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function pageConnexion({ erreur = '', suite = '/', restantes = null } = {}) {
  const messageErreur = erreur
    ? `<p class="erreur" role="alert">${echapper(erreur)}</p>`
    : '';
  const avertissement = restantes !== null && restantes <= 3
    ? `<p class="aide">${restantes} tentative(s) restante(s) avant blocage temporaire.</p>`
    : '';
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light dark"/>
  <title>Connexion — Insta-VA</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2317181a'/%3E%3Ctext x='32' y='42' font-family='Helvetica,Arial,sans-serif' font-size='24' fill='%23fafaf8' text-anchor='middle'%3EIV%3C/text%3E%3C/svg%3E"/>
  <style>
    :root { color-scheme: light; --fond:#fafaf8; --surface:#fff; --encre:#17181a; --encre-2:#3d4045;
      --muet:#6d7176; --trait:#e6e6e0; --trait-fort:#d3d3cb; --danger:#a13a3a; }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; --fond:#0f1011; --surface:#161718; --encre:#f1f1ed; --encre-2:#c6c8c4;
        --muet:#8d9195; --trait:#26282a; --trait-fort:#34373a; --danger:#e09090; }
    }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
      background:var(--fond); color:var(--encre);
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:14px; }
    main { width:100%; max-width:340px; }
    .marque { display:flex; align-items:center; gap:10px; margin-bottom:28px; }
    .logo { width:28px; height:28px; border-radius:6px; background:var(--encre); color:var(--fond);
      display:grid; place-items:center; font-size:11px; font-weight:600; }
    .nom { font-weight:600; font-size:14px; }
    .sous { font-size:10.5px; color:var(--muet); letter-spacing:.04em; text-transform:uppercase; }
    h1 { font-size:19px; font-weight:600; letter-spacing:-.02em; margin:0 0 6px; }
    p.intro { margin:0 0 24px; color:var(--muet); font-size:12.5px; }
    label { display:block; font-size:11.5px; font-weight:500; color:var(--muet); margin-bottom:6px; }
    input { width:100%; font:inherit; font-size:13px; padding:9px 11px; border-radius:6px;
      border:1px solid var(--trait-fort); background:var(--surface); color:var(--encre); outline:none; }
    input:focus { border-color:var(--encre); box-shadow:0 0 0 3px var(--trait); }
    button { width:100%; margin-top:16px; padding:9px 12px; font:inherit; font-size:13px; font-weight:500;
      border-radius:6px; border:1px solid var(--encre); background:var(--encre); color:var(--fond); cursor:pointer; }
    button:hover { opacity:.9; }
    .erreur { margin:0 0 16px; padding:8px 10px; border-radius:6px; font-size:12.5px;
      color:var(--danger); border:1px solid var(--trait-fort); }
    .aide { margin:10px 0 0; font-size:11.5px; color:var(--muet); }
    footer { margin-top:24px; font-size:11px; color:var(--muet); }
  </style>
</head>
<body>
  <main>
    <div class="marque">
      <div class="logo">IV</div>
      <div><div class="nom">Insta-VA</div><div class="sous">Console de production</div></div>
    </div>
    <h1>Connexion</h1>
    <p class="intro">Cette console pilote la publication du compte. L’accès est réservé au responsable.</p>
    ${messageErreur}
    <form method="post" action="/api/auth/connexion" autocomplete="on">
      <input type="hidden" name="suite" value="${echapper(suite)}"/>
      <label for="mot-de-passe">Mot de passe</label>
      <input id="mot-de-passe" name="motDePasse" type="password" required autofocus
             autocomplete="current-password" spellcheck="false"/>
      <button type="submit">Entrer</button>
      ${avertissement}
    </form>
    <footer>Insta-VA · accès protégé</footer>
  </main>
</body>
</html>`;
}

export function pageErreur({ statut = 500, titre = 'Erreur', message = '' } = {}) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${echapper(titre)} — Insta-VA</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
    font-family: ui-sans-serif, system-ui, sans-serif; background:#fafaf8; color:#17181a; }
  @media (prefers-color-scheme: dark) { body { background:#0f1011; color:#f1f1ed; } }
  main { max-width:420px; text-align:center; }
  .code { font-family: ui-monospace, monospace; font-size:13px; opacity:.6; letter-spacing:.1em; }
  h1 { font-size:20px; font-weight:600; margin:8px 0 6px; letter-spacing:-.02em; }
  p { font-size:13px; opacity:.7; margin:0 0 20px; }
  a { color:inherit; font-size:13px; }
</style></head>
<body><main>
  <div class="code">${echapper(statut)}</div>
  <h1>${echapper(titre)}</h1>
  <p>${echapper(message)}</p>
  <a href="/">Retour à la console</a>
</main></body></html>`;
}
