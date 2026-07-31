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
3. **NO agregues `DEEPSEEK_MODEL`.** El modelo se elige desde el propio bot, con las
   pastillas **Rápido** (`deepseek-v4-flash`, responde al instante) e **Inteligente**
   (`deepseek-v4-pro`, piensa más y cuesta ~3 veces más).
   Esa variable existe solo como salida de emergencia por si DeepSeek cambia los nombres
   de sus modelos: **si está definida, manda sobre la elección del usuario y el selector
   deja de servir.** Si ya la tienes puesta, bórrala en Vercel (Settings → Environment
   Variables → los tres puntos → Remove) y vuelve a desplegar.
4. Ve a **Deployments** → en el último, menú **⋯ → Redeploy** (para que tome la variable).

Listo: el botón 🤖 ya responderá usando tu agenda.

## Notas
- El asistente solo funciona con la sesión iniciada (la función valida tu usuario de Firebase).
- Lee los eventos de la agenda que tengas seleccionada en ese momento.
- Necesitas saldo en tu cuenta de DeepSeek (cada pregunta consume un poco).
