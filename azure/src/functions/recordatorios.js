// Despertador "recordatorios": cada 5 minutos le toca la puerta a la agenda
// para que revise si algún evento empieza pronto y mande el aviso al celular.
//
// Esta función NO sabe nada de eventos, ni de personas, ni de notificaciones.
// Lo único que hace es llamar a https://<la agenda>/api/push-tick con el
// secreto compartido. Toda la inteligencia (a quién avisar y qué decirle)
// vive en la agenda, no aquí.

const { app } = require("@azure/functions");

// Cuánto esperamos como máximo la respuesta de la agenda antes de rendirnos.
const TIEMPO_MAXIMO_MS = 60000; // 1 minuto

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

async function pedirleALaAgendaQueAvise(context) {
  const base = direccionDeLaAgenda();
  const secreto = process.env.PUSH_TICK_SECRET;

  // Si falta la configuración no tiene sentido intentarlo. Se registra el
  // problema y se sale sin lanzar error: lanzarlo haría que Azure reintentara
  // en bucle sin arreglar nada.
  if (!base || !secreto) {
    context.error(
      "[recordatorios] Faltan VERCEL_URL o PUSH_TICK_SECRET en la configuración de la Function App. Revisa el LEEME."
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
      body: JSON.stringify({ mode: "reminders" }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {
      // 401 = el secreto no coincide. 404 = la dirección está mal.
      // 500 = falló la agenda. En todos los casos: se anota y se espera al
      // siguiente turno dentro de 5 minutos.
      context.error(`[recordatorios] La agenda respondió ${respuesta.status}: ${texto.slice(0, 500)}`);
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
        `[recordatorios] revisados: ${resumen.revisados ?? 0}, ` +
          `enviados: ${resumen.enviados ?? 0}, ` +
          `fallidos: ${resumen.fallidos ?? 0}`
      );
      // PRIVACIDAD: el detalle solo se anota cuando algo falló, y en el canal de
      // errores. En los turnos normales no se escribe nada más en los registros.
      if ((resumen.fallidos ?? 0) > 0 && Array.isArray(resumen.detalle) && resumen.detalle.length > 0) {
        context.error(`[recordatorios] detalle: ${JSON.stringify(resumen.detalle).slice(0, 2000)}`);
      }
    } else {
      context.log(`[recordatorios] respuesta de la agenda: ${texto.slice(0, 500)}`);
    }
  } catch (error) {
    // Internet caído, agenda dormida o demasiado lenta. Se anota y ya.
    // NO se relanza el error a propósito, para no entrar en reintentos infinitos.
    const motivo =
      error?.name === "TimeoutError"
        ? "la agenda tardó más de un minuto en responder"
        : error?.message || String(error);
    context.error(`[recordatorios] No se pudo avisar a la agenda: ${motivo}`);
  }
}

app.timer("recordatorios", {
  // Formato NCRONTAB de Azure: segundo minuto hora día mes díaDeLaSemana.
  // '0 */5 * * * *' = en el segundo 0, cada 5 minutos, a toda hora, todos los días.
  schedule: "0 */5 * * * *",
  handler: async (temporizador, context) => {
    if (temporizador?.isPastDue) {
      context.log("[recordatorios] Este turno salió con retraso (la app estaba dormida).");
    }
    await pedirleALaAgendaQueAvise(context);
  }
});
