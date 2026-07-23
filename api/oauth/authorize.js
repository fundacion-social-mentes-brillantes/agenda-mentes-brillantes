// Endpoint de autorización OAuth (GET): sirve una página donde el usuario inicia
// sesión con Google usando el MISMO Firebase de la app (dominio ya autorizado).
// Al autenticarse, la página manda el idToken+refreshToken a /api/oauth/complete
// y este responde con la URL de retorno (con el "code") a Claude/ChatGPT.

import { readClientId } from "./_tokens.js";

const FB = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "calendario-5ae30.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "calendario-5ae30",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "calendario-5ae30.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "227981818970",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:227981818970:web:fd88da79566a4264892c63"
};

// Inyección segura en <script>: JSON con < escapado.
function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function errorPage(res, message) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(400).send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0a0f1c;color:#fff7e6;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:24px"><h2>No se pudo iniciar la conexión</h2><p style="color:#b8c0d4">${message}</p></div></body>`);
}

export default function handler(req, res) {
  if (req.method !== "GET") { res.status(405).send("Método no permitido"); return; }

  const q = req.query || {};
  const clientId = q.client_id;
  const redirectUri = q.redirect_uri;
  const state = q.state || "";
  const codeChallenge = q.code_challenge || "";
  const responseType = q.response_type || "code";

  if (responseType !== "code") return errorPage(res, "response_type no soportado.");
  const client = readClientId(clientId);
  if (!client) return errorPage(res, "Aplicación no reconocida (client_id).");
  if (!Array.isArray(client.ru) || !client.ru.includes(redirectUri)) {
    return errorPage(res, "La dirección de retorno no está autorizada.");
  }

  const P = { client_id: clientId, redirect_uri: redirectUri, state, code_challenge: codeChallenge };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar Agenda Mentes Brillantes</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin:0; min-height:100vh;
    display:grid; place-items:center;
    background: radial-gradient(120% 78% at 50% -12%, rgba(215,180,106,.2), transparent 55%), linear-gradient(160deg,#05070e,#0a1020 55%,#0b1120); color:#fff7e6; }
  .card { width:min(92vw,400px); background:linear-gradient(158deg,rgba(30,40,68,.82),rgba(11,16,30,.86));
    border:1px solid rgba(215,180,106,.26); border-radius:24px; padding:32px 26px; text-align:center;
    box-shadow:0 26px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06); }
  h1 { font-size:1.15rem; margin:14px 0 4px; }
  p { color:#b8c0d4; font-size:.9rem; line-height:1.5; margin:0 0 22px; }
  .logo { width:64px;height:64px;border-radius:18px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,.4); }
  button { width:100%; border:0; border-radius:14px; padding:14px; font-size:.95rem; font-weight:800; cursor:pointer;
    background:#fff; color:#3c4043; display:flex; align-items:center; justify-content:center; gap:10px; }
  button:disabled { opacity:.6; cursor:default; }
  .g { width:18px; height:18px; }
  #status { margin-top:16px; font-size:.85rem; color:#d7b46a; min-height:1.2em; }
</style></head>
<body>
  <div class="card">
    <img class="logo" src="/icons/icon-192.png" alt="Agenda Mentes Brillantes" onerror="this.style.display='none'">
    <h1>Conectar tu Agenda</h1>
    <p>Inicia sesión con tu cuenta de Google para que Claude o ChatGPT puedan usar tu agenda de forma segura.</p>
    <button id="go">
      <svg class="g" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.9 37.6 46.5 31.6 46.5 24.5z"/><path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.7 2.2-6.4 0-11.7-3.7-13.6-9.9l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/></svg>
      Continuar con Google
    </button>
    <div id="status"></div>
  </div>

<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script>
  var P = ${safeJson(P)};
  var CFG = ${safeJson(FB)};
  var st = document.getElementById('status');
  var btn = document.getElementById('go');
  function status(m){ st.textContent = m || ''; }
  // Instancia de Firebase AISLADA (nombre propio) para NO tocar la sesión del app
  // que el usuario pueda tener abierta en el mismo navegador/origen.
  var fbApp = firebase.initializeApp(CFG, 'mcpOAuth');
  var auth = firebase.auth(fbApp);
  auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(function(){});
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  async function finish(user){
    try{
      status('Conectando tu agenda...');
      btn.disabled = true;
      var idToken = await user.getIdToken();
      var refreshToken = user.refreshToken;
      var r = await fetch('/api/oauth/complete', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ client_id:P.client_id, redirect_uri:P.redirect_uri, code_challenge:P.code_challenge, state:P.state, idToken:idToken, refreshToken:refreshToken }) });
      var j = await r.json();
      if (j && j.redirect) { window.location.href = j.redirect; }
      else { status('Error: ' + ((j && (j.error_description||j.error)) || 'no se pudo conectar')); btn.disabled=false; }
    }catch(e){ status('Error: ' + (e.message||e.code||e)); btn.disabled=false; }
  }

  // Si volvimos de un redirect de Google, continuar automáticamente.
  auth.getRedirectResult().then(function(res){ if(res && res.user){ finish(res.user); } }).catch(function(){});

  btn.onclick = async function(){
    status('');
    try{
      var res = await auth.signInWithPopup(provider);
      await finish(res.user);
    }catch(e){
      if (e && (e.code==='auth/popup-blocked' || e.code==='auth/cancelled-popup-request' || e.code==='auth/operation-not-supported-in-this-environment' || e.code==='auth/popup-closed-by-user')) {
        status('Abriendo Google...');
        auth.signInWithRedirect(provider);
      } else {
        status('Error: ' + (e.message||e.code||e));
      }
    }
  };
</script>
</body></html>`);
}
