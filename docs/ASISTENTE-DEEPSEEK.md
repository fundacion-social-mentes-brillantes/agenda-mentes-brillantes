# Asistente con DeepSeek

La app tiene un **asistente inteligente** (botón flotante 🤖 abajo a la derecha) que lee tu agenda y
responde preguntas: cuántas sesiones tuvo una persona y en qué fechas, qué tienes esta semana, cuándo se
creó un evento, sumar pagos, etc.

La clave de DeepSeek **NO va en el navegador** (DeepSeek lo prohíbe). Vive en una función del servidor
(`api/assistant.js`) y se configura como variable de entorno en Vercel.

## Configurarlo (una sola vez)

1. Entra a https://vercel.com → proyecto **agenda-mentes-brillantes** → **Settings → Environment Variables**.
2. Agrega una variable:
   - **Name:** `DEEPSEEK_API_KEY`
   - **Value:** tu clave de DeepSeek completa (la que empieza por `sk-...`). 
     Si guardaste la clave "agenda", úsala. Si no la guardaste (DeepSeek solo la muestra al crearla),
     crea una nueva en https://platform.deepseek.com/api_keys y usa esa.
   - **Environments:** marca Production y Preview.
3. (Opcional) Si quieres fijar el modelo, agrega `DEEPSEEK_MODEL` = `deepseek-chat` (es el valor por defecto).
4. Ve a **Deployments** → en el último, menú **⋯ → Redeploy** (para que tome la variable).

Listo: el botón 🤖 ya responderá usando tu agenda.

## Notas
- El asistente solo funciona con la sesión iniciada (la función valida tu usuario de Firebase).
- Lee los eventos de la agenda que tengas seleccionada en ese momento.
- Necesitas saldo en tu cuenta de DeepSeek (cada pregunta consume un poco).
