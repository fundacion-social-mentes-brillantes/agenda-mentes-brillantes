# Guía rápida — Qué debes hacer tú

Esta versión mejoró la app en 4 cosas: formulario más simple (con imágenes y documentos),
agendas personales + compartidas con invitación, instalación como app (PWA) y un servidor MCP
para manejarla desde Claude, Codex o ChatGPT.

El código ya está listo. Para que todo funcione, hay unos pasos que solo tú puedes hacer porque
necesitan tu cuenta de Firebase. Son una sola vez.

---

## 1. Publicar las reglas de seguridad en Firebase (¡importante!)

Sin esto, las agendas compartidas y los archivos no funcionan, y los datos no quedan protegidos.

**Firestore:**
1. Entra a https://console.firebase.google.com → tu proyecto (`calendario-5ae30`).
2. Menú izquierdo: **Firestore Database → Reglas**.
3. Borra lo que haya y pega el contenido del archivo [`firestore.rules`](firestore.rules).
4. Clic en **Publicar**.

**Storage (para imágenes y documentos):**
1. Menú izquierdo: **Storage**. Si nunca lo activaste, dale **Comenzar** y acepta.
2. Pestaña **Reglas**.
3. Borra lo que haya y pega el contenido de [`storage.rules`](storage.rules).
4. Clic en **Publicar**.

> Nota: las reglas de Storage usan una comprobación en Firestore (`firestore.exists`). Es una función
> estándar de Firebase y ya viene activa. Si por algún motivo diera error al publicar, en
> [`docs/firebase-storage-rules.md`](docs/firebase-storage-rules.md) hay una versión alternativa.

---

## 2. Desplegar la nueva versión web

La app está en Vercel conectada a GitHub. Cuando se suban estos cambios a GitHub, Vercel
redespliega solo. **No hay variables de entorno nuevas** que configurar; las de Firebase siguen igual.

Si me pides que los suba, yo hago el commit y el push. Si prefieres hacerlo tú, desde la carpeta del
proyecto:

```bash
git add -A
git commit -m "Mejora profunda: formulario simple, agendas compartidas, PWA y MCP"
git push
```

Vercel detecta el push y publica en 1–2 minutos.

---

## 3. Instalar la app en el celular o el computador

Una vez desplegado, entra a https://agenda-mentes-brillantes.vercel.app y sigue
[`docs/INSTALACION-APP.md`](docs/INSTALACION-APP.md). Resumen:

- **Android (Chrome):** menú ⋮ → **Instalar aplicación**.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.
- **Computador (Chrome/Edge):** ícono de instalar en la barra de direcciones.

---

## 4. Compartir agendas con otras personas

Ya no entra cualquiera a tu agenda. Cada quien ve solo lo suyo y lo que le compartan.
Cómo invitar está en [`docs/COLABORACION.md`](docs/COLABORACION.md). Resumen:

1. Abre **Agendas** (menú lateral).
2. **Crear agenda compartida** (ej. "Sesiones mamá").
3. Copia el **enlace de invitación** y mándalo por WhatsApp.
4. Quien lo abra e inicie sesión queda dentro. Puedes quitar personas o regenerar el enlace cuando quieras.

Tus eventos actuales se mueven solos a tu agenda **"Mi agenda"** la primera vez que entres.

---

## 5. Conectar el asistente (MCP) para manejar la agenda con IA

Guía completa en [`docs/MCP.md`](docs/MCP.md). En resumen necesitas:

1. Una **llave de servicio** de Firebase (un archivo JSON) — la guía te dice dónde descargarla.
2. Tu **UID** de usuario (de Firebase Authentication).
3. Pegar un bloque de configuración en Claude o Codex (local), y opcionalmente publicar el servidor
   para ChatGPT (nube).

Después podrás decirle a la IA cosas como *"agéndame una sesión el martes a las 3 pm"* y lo crea en tu agenda.
