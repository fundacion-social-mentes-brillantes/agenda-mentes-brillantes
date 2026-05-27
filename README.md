# Agenda Mentes Brillantes

Agenda web interna para sesiones coach, tareas, recordatorios y actividades de Gimnasio Emocional Mentes Brillantes.

## Stack usado

- React
- Vite
- TypeScript
- Tailwind CSS
- Firebase
- Firebase Storage para imagenes opcionales de eventos

## Instalacion

Instala las dependencias con:

```bash
npm install
```

## Ejecucion local

Crea un archivo `.env.local` con las variables de Firebase y luego ejecuta:

```bash
npm run dev
```

## Variables de entorno

Usa `.env.example` como plantilla:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

En Vite, todas las variables que debe leer el navegador deben empezar por `VITE_`.

## Funcionalidades principales

- Inicio de sesion con Google y correo.
- Agenda general para sesiones coach, reuniones, tareas, recordatorios, familia, fundacion, salud, pagos y eventos personales.
- Temas visuales: `Noche Dorada` y `Pink Brillante`.
- Recordatorios visuales dentro del dashboard.
- Imagen opcional por evento usando Firebase Storage.
- Campos de valor total y valor abonado para eventos de tipo `Sesion Coach`.
- Logos reales de Gimnasio Emocional Mentes Brillantes en `public/brand/`.

## Build de produccion

```bash
npm run build
```

El resultado se genera en `dist`.

## Despliegue en Vercel

1. Importa el repositorio desde GitHub en Vercel.
2. Configura las variables de entorno de Firebase en el proyecto de Vercel.
3. Usa estos valores de build:

- Build command: `npm run build`
- Output directory: `dist`

El archivo `vercel.json` incluye la reescritura necesaria para que la app Vite funcione como SPA.

## Firebase Storage

Para subir imagenes a eventos, Firebase Storage debe estar activado en el proyecto `calendario-5ae30`. Revisa `docs/firebase-storage-rules.md` para una regla sugerida de acceso autenticado.

Las notificaciones push reales se implementaran en una fase posterior con Firebase Cloud Messaging, VAPID key y `firebase-messaging-sw.js`.

## Firestore

Firestore Database debe estar creado en el proyecto `calendario-5ae30`. Los eventos requieren reglas que permitan lectura y escritura a usuarios autenticados. Revisa `docs/firebase-firestore-rules.md` para una regla de prueba de primera version interna.

Si Firestore queda temporalmente sin conexion despues de crear un evento, la app muestra una advertencia y deja que Firebase sincronice automaticamente cuando recupere conexion.

## Si Google login falla

Revisa esta configuracion en Firebase:

- Firebase Authentication -> Settings -> Authorized domains.
- Debe estar autorizado: `agenda-mentes-brillantes.vercel.app`.
- Authentication -> Sign-in method -> Google debe estar habilitado.
- Firestore Database debe estar creado.
- Las reglas de Firestore deben permitir a usuarios autenticados leer/escribir su documento en `users/{uid}`.
- Las reglas de Firestore deben permitir eventos para usuarios autenticados en `events/{eventId}`.
- Storage solo es necesario si se van a subir imagenes opcionales a eventos.

Si Auth funciona pero Firestore esta temporalmente offline o bloqueado por reglas, la app permite entrar con un perfil local temporal y muestra una advertencia suave mientras intenta sincronizar.
