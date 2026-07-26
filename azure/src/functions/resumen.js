// Despertador "resumen": una vez al día, a las 7:02 de la mañana hora de
// Colombia, le pide a la agenda que le mande a cada persona la lista de lo
// que tiene ese día.
//
// OJO CON LA HORA: las Function Apps de Azure trabajan en UTC. Colombia es
// UTC-5 fijo (aquí no se cambia la hora en invierno ni en verano), así que
// las 7:02 de la mañana en Colombia son las 12:02 en UTC. Por eso el horario
// dice 12 y no 7. Si alguna vez el país cambiara de huso, hay que ajustar
// este número (hora Colombia + 5 = hora UTC).
//
// Igual que "recordatorios", esta función solo toca la puerta: no sabe nada
// de eventos ni de personas. Todo lo decide la agenda.

const { app } = require("@azure/functions");

// El resumen del día revisa más eventos que el recordatorio, así que le damos
// un poco más de aire.
const TIEMPO_MAXIMO_MS = 90000; // 1 minuto y medio

// La dirección de la agenda puede escribirse con o sin "https://" y con o sin
// barra al final. Aquí la dejamos siempre igual para no equivocarnos.
//
// SIEMPRE https: el secreto compartido viaja en una cabecera, y con "http://"
// iría en texto plano por internet. Si alguien escribe "http://", lo corregimos.
function direccionDeLaAgenda() {
  const base = String(process.env.VERCEL_URL || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return /^https:\/\//i.test(base) ? base : `https://${base.replace(/^http:\/\//i, "")}`;
}

async function pedirleALaAgendaElResumen(context) {
  const base = direccionDeLaAgenda();
  const secreto = process.env.PUSH_TICK_SECRET;

  // Si falta la configuración no tiene sentido intentarlo. Se registra el
  // problema y se sale sin lanzar error: lanzarlo haría que Azure reintentara
  // en bucle sin arreglar nada.
  if (!base || !secreto) {
    context.error(
      "[resumen] Faltan VERCEL_URL o PUSH_TICK_SECRET en la configuración de la Function App. Revisa el LEEME."
    );
    return;
  }

  try {
    const respuesta = await fetch(`${base}/api/push-tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-push-secret": secreto
      },
      body: JSON.stringify({ mode: "daily" }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {
      // 401 = el secreto no coincide. 404 = la dirección está mal.
      // 500 = falló la agenda. Se anota y se espera al día siguiente.
      context.error(`[resumen] La agenda respondió ${respuesta.status}: ${texto.slice(0, 500)}`);
      return;
    }

    let resumen = null;
    try {
      resumen = JSON.parse(texto);
    } catch {
      resumen = null;
    }

    if (resumen) {
      context.log(
        `[resumen] revisados: ${resumen.revisados ?? 0}, ` +
          `enviados: ${resumen.enviados ?? 0}, ` +
          `fallidos: ${resumen.fallidos ?? 0}`
      );
      // PRIVACIDAD: el detalle solo se anota cuando algo falló, y en el canal de
      // errores. En los turnos normales no se escribe nada más en los registros.
      if ((resumen.fallidos ?? 0) > 0 && Array.isArray(resumen.detalle) && resumen.detalle.length > 0) {
        context.error(`[resumen] detalle: ${JSON.stringify(resumen.detalle).slice(0, 2000)}`);
      }
    } else {
      context.log(`[resumen] respuesta de la agenda: ${texto.slice(0, 500)}`);
    }
  } catch (error) {
    // Internet caído, agenda dormida o demasiado lenta. Se anota y ya.
    // NO se relanza el error a propósito, para no entrar en reintentos infinitos.
    const motivo =
      error?.name === "TimeoutError"
        ? "la agenda tardó más de minuto y medio en responder"
        : error?.message || String(error);
    context.error(`[resumen] No se pudo pedir el resumen del día: ${motivo}`);
  }
}

app.timer("resumen", {
  // Formato NCRONTAB de Azure: segundo minuto hora día mes díaDeLaSemana.
  // '0 2 12 * * *' = todos los días a las 12:02 UTC = 7:02 de la mañana en Colombia.
  // Van dos minutos corridos a propósito: así no coincide con el turno de
  // "recordatorios" de las 12:00 y los dos no escriben el mismo documento a la vez.
  schedule: "0 2 12 * * *",
  handler: async (temporizador, context) => {
    // Si la Function App estuvo dormida, Azure ejecuta el turno perdido cuando
    // despierta, a cualquier hora. Un resumen del día a las 2 de la madrugada no
    // sirve de nada Y ADEMÁS dejaría el día marcado como enviado, así que el envío
    // bueno de las 7:02 se saltaría. Mejor no mandar nada y esperar al día siguiente.
    if (temporizador?.isPastDue) {
      context.log(
        "[resumen] Turno atrasado: NO se manda el resumen fuera de hora; se espera al día siguiente."
      );
      return;
    }
    await pedirleALaAgendaElResumen(context);
  }
});
