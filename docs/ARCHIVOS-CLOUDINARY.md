# Adjuntar imágenes y documentos con Cloudinary (gratis, sin tarjeta)

La app guarda los archivos de los eventos en **Cloudinary** (plan gratuito, 25 GB, sin tarjeta de crédito).
No necesitas activar Firebase Storage.

Es una configuración de una sola vez. Toma unos 5 minutos.

---

## Paso 1 — Crear la cuenta gratuita

1. Entra a https://cloudinary.com/users/register_free y crea una cuenta (puedes entrar con Google).
2. Al terminar, en el **Dashboard** verás un dato llamado **"Cloud name"** (nombre de tu nube),
   por ejemplo `dxxxxxx`. **Cópialo**, lo usaremos como `VITE_CLOUDINARY_CLOUD_NAME`.

## Paso 2 — Crear un "upload preset" sin firma

Esto permite que la app suba archivos sin exponer claves secretas.

1. En Cloudinary, ve al engranaje **Settings** (Configuración) → pestaña **Upload**.
2. Baja hasta **Upload presets** → **Add upload preset**.
3. En **Signing Mode** elige **Unsigned** (sin firma). ¡Importante!
4. (Opcional) En **Folder** puedes escribir `agenda`.
5. Guarda. Copia el **nombre del preset** que quedó (por ejemplo `agenda_unsigned`).
   Ese es tu `VITE_CLOUDINARY_UPLOAD_PRESET`.

## Paso 3 — Poner esos dos datos en Vercel

Para que la app publicada (la que usas en el celular) pueda subir archivos:

1. Entra a https://vercel.com → tu proyecto **agenda-mentes-brillantes**.
2. **Settings → Environment Variables**.
3. Agrega dos variables (entorno: Production y Preview):
   - `VITE_CLOUDINARY_CLOUD_NAME` = tu cloud name (paso 1).
   - `VITE_CLOUDINARY_UPLOAD_PRESET` = el nombre del preset (paso 2).
4. Ve a la pestaña **Deployments** → en el último, menú **⋯ → Redeploy** (para que tome las variables).

Cuando termine el redeploy, en "Nuevo evento" ya aparecerá la opción **"Toca para agregar archivos"**
y podrás subir imágenes y documentos.

> Para desarrollo en tu computador, pon esas mismas dos líneas en el archivo `.env.local`.

---

## Notas

- Tipos permitidos: imágenes (JPG, PNG, WEBP, GIF), PDF, Word, Excel, PowerPoint, texto, CSV, ZIP. Hasta 15 MB cada uno.
- Al **quitar** un archivo de un evento se borra la referencia en la agenda; el archivo en sí permanece en
  Cloudinary (el plan gratuito tiene espacio de sobra). No requiere acción tuya.
- Los enlaces de los archivos son públicos pero con direcciones imposibles de adivinar. Para una agenda
  interna es adecuado. Si en el futuro necesitas control de acceso estricto por miembro, se puede migrar a
  un almacenamiento con reglas (Firebase Storage en plan Blaze).
