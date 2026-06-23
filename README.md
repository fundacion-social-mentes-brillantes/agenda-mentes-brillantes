# Agenda Mentes Brillantes

Agenda del Gimnasio Emocional Mentes Brillantes para sesiones, reuniones y recordatorios.
Funciona en **web, Android e iPhone** (instalable como app), con **agendas personales y compartidas**,
y se puede manejar desde un asistente de IA (Claude, Codex o ChatGPT) gracias a un **servidor MCP**.

> ¿Qué tengo que hacer para dejarlo andando? Lee **[GUIA-RAPIDA.md](GUIA-RAPIDA.md)**.

## Funcionalidades

- Inicio de sesión con Google y correo.
- **Agenda personal** privada + **agendas compartidas** con invitación por enlace (ver [docs/COLABORACION.md](docs/COLABORACION.md)).
- Formulario de evento simple: título, fecha, horas, modalidad (presencial/virtual), recordatorio, color,
  pagos (valor total y abonado) e **imágenes y documentos** adjuntos.
- Calendario mensual, lista general y panel "Hoy", todo en tiempo real.
- Temas visuales: **Noche Dorada** y **Pink Brillante**.
- **Instalable como app (PWA)** en web, Android e iOS, con funcionamiento offline básico y auto‑actualización.
- **Servidor MCP** para crear/ver/editar eventos desde un LLM (ver [docs/MCP.md](docs/MCP.md)).

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS v4
- Firebase (Authentication, Firestore, Storage)
- vite-plugin-pwa (service worker + manifest)
- Servidor MCP en Node + firebase-admin (carpeta [`mcp-server/`](mcp-server))

## Desarrollo

```bash
npm install
npm run dev
```

Crea un `.env.local` con las variables de Firebase (usa [.env.example](.env.example) como plantilla).
Todas deben empezar por `VITE_`.

## Build de producción

```bash
npm run build   # genera dist/ con la PWA
```

## Despliegue (Vercel)

1. El repositorio está conectado a Vercel; cada push a GitHub redespliega.
2. Variables de entorno de Firebase configuradas en Vercel (las mismas de siempre).
3. Build command `npm run build`, output `dist`.
4. `vercel.json` incluye el rewrite de SPA y los headers para el service worker y el manifest.

## Archivos adjuntos

Las imágenes y documentos se suben a **Cloudinary** (plan gratuito, sin tarjeta) en vez de Firebase Storage,
para mantener el proyecto sin costo. Configuración en [docs/ARCHIVOS-CLOUDINARY.md](docs/ARCHIVOS-CLOUDINARY.md)
(variables `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_UPLOAD_PRESET`). `storage.rules` se conserva por si
algún día se usa Firebase Storage (plan Blaze), pero no es necesario.

## Seguridad (Firebase)

Publica las reglas de [`firestore.rules`](firestore.rules) en Firebase Console (Firestore → Reglas).
Detalles en [docs/firebase-firestore-rules.md](docs/firebase-firestore-rules.md).

## Documentación

- [GUIA-RAPIDA.md](GUIA-RAPIDA.md) — pasos que debe hacer el dueño del proyecto.
- [docs/INSTALACION-APP.md](docs/INSTALACION-APP.md) — instalar en celular y computador.
- [docs/COLABORACION.md](docs/COLABORACION.md) — agendas compartidas e invitaciones.
- [docs/ARCHIVOS-CLOUDINARY.md](docs/ARCHIVOS-CLOUDINARY.md) — adjuntar imágenes y documentos (gratis).
- [docs/MCP.md](docs/MCP.md) — conectar Claude, Codex o ChatGPT.
