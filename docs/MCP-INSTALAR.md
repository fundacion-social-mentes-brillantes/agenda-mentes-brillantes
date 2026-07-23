# Conectar la Agenda a Claude y a ChatGPT (MCP)

Este servidor deja que Claude o ChatGPT usen **tu** agenda (ver, crear, mover,
borrar eventos y sesiones coach). Cada persona entra con **su propia cuenta de
Google** —la misma del app— y solo ve/gestiona las agendas donde es miembro.

**Dirección del conector (MCP):**

```
https://agenda-mentes-brillantes.vercel.app/api/mcp
```

No hace falta ninguna clave ni contraseña extra: al conectarlo te pedirá
"Continuar con Google" una sola vez.

---

## En Claude (web o escritorio)

Requiere plan Pro, Max, Team o Enterprise.

1. Abre Claude → tu foto/nombre → **Settings** (Ajustes).
2. Ve a **Connectors** (Conectores) → **Add custom connector** (Agregar conector personalizado).
3. En **URL del servidor MCP**, pega:
   `https://agenda-mentes-brillantes.vercel.app/api/mcp`
4. Dale **Add / Connect**. Se abrirá una ventana **"Continuar con Google"** →
   inicia sesión con tu cuenta (la misma de la agenda).
5. Listo. Ya puedes pedirle a Claude cosas como:
   - "¿Qué tengo en la agenda hoy?"
   - "Agenda una sesión coach con Catalina el martes a las 3."
   - "Mueve la cita del jueves para el viernes."

> En equipos: el dueño de la organización puede agregarlo una vez en
> **Organization settings → Connectors** y cada quien pulsa **Connect** para
> entrar con su propia cuenta.

---

## En ChatGPT

Requiere plan Plus, Pro, Business, Enterprise o Edu, con **Developer Mode**.

1. Abre ChatGPT → **Settings** → **Connectors**.
2. Activa **Developer mode** (si no aparece la opción de crear conector).
3. **Create** (Crear) un conector nuevo.
4. Pega la URL: `https://agenda-mentes-brillantes.vercel.app/api/mcp`
5. En autenticación elige **OAuth**. Te llevará a **"Continuar con Google"**.
6. Inicia sesión y listo.

---

## Preguntas frecuentes

- **¿Es seguro?** Sí. Cada persona entra con su Google y solo accede a las
  agendas donde ya es miembro (las mismas reglas del app). Nadie ve datos de
  otra agenda.
- **¿Tiene costo?** No. El login es gratis y el servidor va hospedado junto al
  app.
- **¿Se me caduca la sesión?** El conector la renueva solo. Si algún día pide
  reconectar, vuelve a pulsar "Continuar con Google".
- **¿Qué puede hacer?** Ver agendas y eventos, ver "hoy", crear/editar/borrar
  eventos, y sesiones coach: ver personas, crear persona y agendar sesiones.

---

## Para el administrador (técnico)

- Endpoint MCP: `/api/mcp` (Streamable HTTP, JSON-RPC, sin estado).
- OAuth 2.1 con PKCE y registro dinámico (DCR):
  - `/.well-known/oauth-protected-resource`
  - `/.well-known/oauth-authorization-server`
  - `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/complete`, `/api/oauth/token`
- Identidad: login con Google del proyecto Firebase `calendario-5ae30`
  (dominio `agenda-mentes-brillantes.vercel.app` ya autorizado). No usa service
  account: cada operación corre con el idToken del usuario contra Firestore REST,
  autorizada por `firestore.rules`.
- Secreto de firma: variable `OAUTH_SECRET` en Vercel (opcional; por defecto usa
  `DEEPSEEK_API_KEY`). Para reforzar, define `OAUTH_SECRET` con un valor aleatorio
  largo en el proyecto de Vercel.
