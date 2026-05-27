# Agenda Mentes Brillantes

Agenda web interna para sesiones coach, tareas, recordatorios y actividades de Gimnasio Emocional Mentes Brillantes.

## Stack usado

- React
- Vite
- TypeScript
- Tailwind CSS
- Firebase

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
