// Función de servidor (Vercel): el REPARTIDOR de las notificaciones push.
//
// Lo llama un temporizador de Azure cada pocos minutos (nunca el navegador).
// Dos modos:
//   - "reminders": avisa 15 minutos antes de cada evento de la agenda del equipo.
//   - "daily":     manda una sola vez el resumen del día (lo dispara Azure a las 7:00
//                  hora de Colombia; aquí NO se decide la hora, solo se arma el texto).
//
// Se usa WEB PUSH ESTÁNDAR con VAPID (no Firebase Cloud Messaging), y se lee
// Firestore por REST con el token de un miembro de GEMB, igual que el resto del
// backend (api/_lib/firestore.js). Aquí NO se usa firebase-admin.
//
// Nada de este archivo devuelve ni escribe en el log tokens, llaves ni endpoints.

import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";
import {
  refreshIdToken,
  UserFirestore,
  decodeDoc,
  Ts,
  FIREBASE_PROJECT_ID
} from "./_lib/firestore.js";

// Agenda del equipo GEMB (se puede cambiar por variable de entorno si algún día hace falta).
// Vercel corta las funciones a los 10 segundos por defecto; repartir varios avisos
// puede tardar más, así que se pide un límite mayor (Azure espera hasta 60 s).
export const config = { maxDuration: 60 };

const WORKSPACE_ID = process.env.PUSH_WORKSPACE_ID || "nybtxAzWmNO1ZjgRsFzu";
// Colombia no tiene horario de verano: siempre UTC-5.
const TZ = process.env.AGENDA_TZ_OFFSET || "-05:00";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Ventana del recordatorio: se avisa de TODO lo que empiece dentro de los próximos
// 18 minutos y que no se haya avisado ya. Así, si una revisión se pierde (la función
// estaba dormida, hubo un error de red), la siguiente lo recupera: el aviso llega un
// poco más tarde, pero llega. Que no se repita depende del control de duplicados.
const VENTANA_MIN = 18;
const MAX_CLAVES = 400; // avisos recordados en la ficha de control (es compartida).
const HORAS_MEMORIA = 2; // se olvidan los recordatorios de hace más de 2 horas.
const MAX_DETALLE = 40; // líneas de explicación que se devuelven como mucho.
const MAX_EVENTOS = 2000; // tope de seguridad al leer la agenda.

// ------------------------------------------------------------------
// Utilidades pequeñas
// ------------------------------------------------------------------

/** El cuerpo puede llegar ya interpretado, como texto o como Buffer; se normaliza a objeto. */
function parseBody(body) {
  // Un Buffer pasa por "object" y se colaría sin interpretar: se convierte primero.
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

/** Compara dos secretos sin delatar cuánto coincide (comparación de tiempo constante). */
function mismoSecreto(recibido, esperado) {
  const a = Buffer.from(String(recibido || ""), "utf8");
  const b = Buffer.from(String(esperado || ""), "utf8");
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Hora de Colombia en formato de 12 horas, ej. "04:00 p. m.". */
function hora12(fecha) {
  const texto = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(fecha);
  // Algunos sistemas usan espacios raros (finos o duros); se dejan normales.
  return texto.replace(/[\u202f\u00a0]/g, " ").trim();
}

/** Hora de Colombia en formato de 24 horas, ej. "16:00". */
function hora24(fecha) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(fecha);
}

/** Fecha de Colombia como "AAAA-MM-DD". */
function fechaBogota(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(fecha);
}

/** Recorta un texto largo para que quepa cómodo en la notificación. */
function recortar(texto, largo) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= largo) return limpio;
  return `${limpio.slice(0, largo - 1)}…`;
}

// (Antes había un ayudante que ponía el nombre del miembro en la respuesta.
// Se eliminó a propósito: en las sesiones coach el título del evento y el nombre
// de la persona son datos sensibles y no deben salir en registros ni respuestas.)

// ------------------------------------------------------------------
// Lectura de Firestore
// ------------------------------------------------------------------

/**
 * Lee los documentos de miembros de la agenda del equipo.
 * "members" es una SUBCOLECCIÓN, así que se pide por REST directamente
 * (runQuery no aplica bien aquí). Se decodifica con la misma utilidad del proyecto.
 */
async function leerMiembros(idToken) {
  const salida = [];
  let pageToken = "";
  // Como mucho 5 páginas de 100: de sobra para el equipo, y evita bucles infinitos.
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const url =
      `${FIRESTORE_BASE}/workspaces/${encodeURIComponent(WORKSPACE_ID)}/members?pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      const error = new Error(`No se pudieron leer los miembros de la agenda (${res.status}). ${detalle.slice(0, 200)}`);
      error.status = res.status;
      throw error;
    }
    const data = await res.json();
    for (const documento of data.documents || []) salida.push(decodeDoc(documento));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return salida;
}

/** ¿Este documento es un evento que merece aviso? (descarta personas, todo el día y hechos). */
function esEventoAvisable(documento) {
  const d = documento?.data || {};
  if (d.recordType === "client") return false; // no es un evento: es una persona
  if (d.allDay === true) return false; // los de "todo el día" no tienen hora que avisar
  if (d.done === true) return false; // ya está hecho
  if (!d.startAt) return false;
  return !Number.isNaN(new Date(d.startAt).getTime());
}

/**
 * Devuelve los eventos de la agenda del equipo cuya hora de inicio cae dentro
 * de la ventana [desde, hasta], ya limpios y ordenados.
 *
 * Primero se intenta la consulta barata (filtro por fecha en el servidor). Si el
 * proyecto no tiene el índice compuesto (workspaceId + startAt), Firestore
 * responde con error y se cae a traer la agenda y filtrar aquí. En los dos
 * caminos el resultado final es exactamente el mismo.
 */
async function leerEventosEnVentana(fs, desde, hasta) {
  const filtroAgenda = {
    fieldFilter: {
      field: { fieldPath: "workspaceId" },
      op: "EQUAL",
      value: { stringValue: WORKSPACE_ID }
    }
  };

  let documentos = [];
  try {
    documentos = await fs.runQuery({
      from: [{ collectionId: "events" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            filtroAgenda,
            {
              fieldFilter: {
                field: { fieldPath: "startAt" },
                op: "GREATER_THAN_OR_EQUAL",
                value: { timestampValue: desde.toISOString() }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: "startAt" },
                op: "LESS_THAN_OR_EQUAL",
                value: { timestampValue: hasta.toISOString() }
              }
            }
          ]
        }
      },
      orderBy: [{ field: { fieldPath: "startAt" }, direction: "ASCENDING" }],
      limit: 300
    });
  } catch (error) {
    console.warn("[push-tick] consulta por fecha no disponible, se filtra en memoria:", String(error?.message || "").slice(0, 160));
    documentos = await fs.runQuery({
      from: [{ collectionId: "events" }],
      where: filtroAgenda,
      limit: MAX_EVENTOS
    });
  }

  return documentos
    .filter(esEventoAvisable)
    .map((doc) => ({
      id: doc.id,
      titulo: String(doc.data.title || "").trim() || "Evento sin título",
      inicio: new Date(doc.data.startAt)
    }))
    .filter((ev) => ev.inicio >= desde && ev.inicio <= hasta)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

// ------------------------------------------------------------------
// Armado de los mensajes
// ------------------------------------------------------------------

/** Texto del resumen de la mañana a partir de los eventos del día. */
function textoResumenDelDia(eventos) {
  if (eventos.length === 0) return "Hoy no tienes nada agendado.";
  const primeros = eventos
    .slice(0, 3)
    .map((ev) => `${recortar(ev.titulo, 40)} ${hora24(ev.inicio)}`)
    .join(" · ");
  const restantes = eventos.length - Math.min(3, eventos.length);
  const cuantas = eventos.length === 1 ? "1 cosa" : `${eventos.length} cosas`; // que suene bien en español
  return `Hoy tienes ${cuantas}: ${primeros}${restantes > 0 ? ` y ${restantes} más.` : ""}`;
}

/** ¿El miembro tiene una suscripción de push completa y utilizable? */
function tieneSuscripcion(miembro) {
  const d = miembro?.data || {};
  return Boolean(d.pushEndpoint && d.pushP256dh && d.pushAuth);
}

/** Convierte los campos planos del miembro en la suscripción que espera web-push. */
function suscripcionDe(miembro) {
  const d = miembro.data;
  return { endpoint: d.pushEndpoint, keys: { p256dh: d.pushP256dh, auth: d.pushAuth } };
}

// ------------------------------------------------------------------
// Endpoint
// ------------------------------------------------------------------

export default async function handler(req, res) {
  // 1. Solo POST y solo con el secreto compartido con Azure.
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const secreto = process.env.PUSH_TICK_SECRET;
  if (!secreto) {
    res.status(500).json({ error: "Falta configurar PUSH_TICK_SECRET en el servidor." });
    return;
  }
  if (!mismoSecreto(req.headers["x-push-secret"], secreto)) {
    res.status(401).json({ error: "no autorizado" });
    return;
  }

  // Llaves de las notificaciones: sin ellas no se puede enviar nada.
  const vapidPublica = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY;
  const vapidSujeto = process.env.VAPID_SUBJECT;
  if (!vapidPublica || !vapidPrivada || !vapidSujeto) {
    res.status(500).json({
      error: "Faltan las llaves de notificaciones en el servidor (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT)."
    });
    return;
  }
  if (!process.env.PUSH_REFRESH_TOKEN) {
    res.status(500).json({ error: "Falta configurar PUSH_REFRESH_TOKEN en el servidor (sin él no se puede leer la agenda)." });
    return;
  }
  try {
    webpush.setVapidDetails(vapidSujeto, vapidPublica, vapidPrivada);
  } catch (error) {
    console.error("[push-tick] llaves VAPID inválidas", String(error?.message || "").slice(0, 160));
    res.status(500).json({ error: "Las llaves de notificaciones del servidor no son válidas. VAPID_SUBJECT debe ser 'mailto:...'." });
    return;
  }

  const body = parseBody(req.body);
  // Se valida en vez de adivinar: si el modo llega mal escrito, antes se trataba como
  // "reminders" en silencio y el resumen de la mañana no salía sin que nadie lo notara.
  const mode = body.mode;
  if (mode !== "daily" && mode !== "reminders") {
    res.status(400).json({ ok: false, error: "El modo debe ser 'reminders' o 'daily'." });
    return;
  }
  const resumen = { ok: true, mode, revisados: 0, enviados: 0, fallidos: 0, detalle: [] };
  const anotar = (texto) => {
    if (resumen.detalle.length < MAX_DETALLE) resumen.detalle.push(texto);
  };

  try {
    // 2. Sesión de Firebase fresca (el idToken dura una hora, así que se pide siempre).
    const sesion = await refreshIdToken(process.env.PUSH_REFRESH_TOKEN);
    const fs = new UserFirestore(sesion.idToken);

    // 3. Miembros de la agenda del equipo con notificaciones activadas.
    const miembros = await leerMiembros(sesion.idToken);
    const campoQuiere = mode === "daily" ? "notifyDaily" : "notifyBefore";
    const destinatarios = miembros.filter((m) => m.data?.[campoQuiere] === true && tieneSuscripcion(m));
    anotar(`${miembros.length} miembro(s) en la agenda, ${destinatarios.length} con este aviso activado.`);

    // 4. Eventos según el modo.
    const ahora = new Date();
    let eventos = [];
    let hoy = fechaBogota(ahora);

    if (mode === "daily") {
      // Todo el día de hoy en hora de Colombia.
      const desde = new Date(`${hoy}T00:00:00${TZ}`);
      const hasta = new Date(`${hoy}T23:59:59${TZ}`);
      eventos = await leerEventosEnVentana(fs, desde, hasta);
      anotar(`${eventos.length} evento(s) para hoy ${hoy}.`);
    } else {
      // Todo lo que empiece de aquí a 18 minutos y que aún no se haya avisado.
      const hasta = new Date(ahora.getTime() + VENTANA_MIN * 60000);
      eventos = await leerEventosEnVentana(fs, ahora, hasta);
      anotar(`${eventos.length} evento(s) empiezan dentro de ${VENTANA_MIN} minutos o menos.`);
    }

    // 5. Lista de avisos a repartir (miembro + mensaje + clave anti-duplicados).
    const avisos = [];
    if (mode === "daily") {
      const cuerpo = textoResumenDelDia(eventos);
      for (const miembro of destinatarios) {
        avisos.push({
          miembro,
          clave: `daily:${hoy}`,
          ttl: 4 * 60 * 60, // si el celular está apagado, el resumen sirve unas horas
          payload: { title: "☀️ Tu día de hoy", body: cuerpo, tag: `resumen-${hoy}`, url: "/" }
        });
      }
    } else {
      for (const evento of eventos) {
        // Cuánto falta de verdad: la revisión corre cada 5 minutos y puede recuperar
        // avisos atrasados, así que el texto se calcula en vez de decir "15 minutos".
        const faltan = Math.round((evento.inicio.getTime() - ahora.getTime()) / 60000);
        const cuando =
          faltan >= 2 ? `Empieza a las ${hora12(evento.inicio)} (en unos ${faltan} minutos).` : `Empieza a las ${hora12(evento.inicio)} (ya casi).`;
        for (const miembro of destinatarios) {
          avisos.push({
            miembro,
            clave: `${evento.id}:${evento.inicio.getTime()}`,
            ttl: 15 * 60, // pasados 15 minutos el recordatorio ya no tiene sentido
            payload: {
              title: `⏰ ${recortar(evento.titulo, 80)}`,
              body: cuando,
              tag: `ev-${evento.id}`,
              url: "/"
            }
          });
        }
      }
    }

    // 6. Control de duplicados.
    // IMPORTANTE: las reglas de seguridad solo dejan que cada quien escriba en SU
    // PROPIA ficha de miembro. Como aquí el servidor actúa con la sesión de UNA sola
    // persona, el registro de "esto ya lo avisé" se guarda entero en la ficha de ESE
    // usuario (el enviador), con claves compuestas "uidDestino|aviso".
    const uidEnviador = sesion.uid || "";
    const fichaControl = miembros.find((m) => m.id === uidEnviador) || null;
    if (!fichaControl) {
      anotar("Aviso: la cuenta del servidor no aparece como miembro; no se podrá evitar repetir avisos.");
    }

    const limiteMemoria = ahora.getTime() - HORAS_MEMORIA * 3600000;
    const inicioHoyMs = Date.parse(`${hoy}T00:00:00${TZ}`);
    // Se olvidan las claves viejas para que la lista no crezca sin control.
    const sigueVigente = (clave) => {
      if (clave.startsWith("muerto|")) return true; // caduca sola al cambiar el endpoint
      const parte = clave.split("|")[1] || "";
      if (parte.startsWith("daily:")) {
        const dia = Date.parse(`${parte.slice(6)}T00:00:00${TZ}`);
        return Number.isFinite(dia) ? dia >= inicioHoyMs - 2 * 86400000 : false;
      }
      const ms = Number(parte.split(":")[1]);
      return Number.isFinite(ms) ? ms >= limiteMemoria : false;
    };

    const previas = Array.isArray(fichaControl?.data?.pushSent) ? fichaControl.data.pushSent.map(String) : [];
    const memoria = new Set(previas.filter(sigueVigente));
    const claveDe = (aviso) => `${aviso.miembro.id}|${aviso.clave}`;
    // Marca de "esta suscripción ya no responde": incluye el final del endpoint, así
    // que si la persona vuelve a activar los avisos (endpoint nuevo) deja de aplicar.
    const marcaMuerta = (miembro) => `muerto|${miembro.id}|${String(miembro.data?.pushEndpoint || "").slice(-24)}`;

    // 7. Reparto por lotes. Un fallo de un aviso NUNCA tumba a los demás.
    const porEnviar = avisos.filter((aviso) => {
      resumen.revisados++;
      if (memoria.has(claveDe(aviso))) return false; // ya se avisó
      if (memoria.has(marcaMuerta(aviso.miembro))) return false; // suscripción rota conocida
      return true;
    });

    const nuevasClaves = [];
    let limpiarPropia = false;
    let muertasAjenas = 0;

    const enviarUno = async (aviso) => {
      try {
        await webpush.sendNotification(suscripcionDe(aviso.miembro), JSON.stringify(aviso.payload), { TTL: aviso.ttl });
        resumen.enviados++;
        nuevasClaves.push(claveDe(aviso));
      } catch (error) {
        const codigo = Number(error?.statusCode) || 0;
        if (codigo === 404 || codigo === 410) {
          // El navegador ya no existe (app desinstalada o permiso revocado).
          if (aviso.miembro.id === uidEnviador) limpiarPropia = true;
          else muertasAjenas++;
          nuevasClaves.push(marcaMuerta(aviso.miembro));
        } else {
          resumen.fallidos++;
          console.error("[push-tick] fallo al enviar", codigo || "sin código");
        }
      }
    };

    for (let i = 0; i < porEnviar.length; i += 5) {
      const lote = porEnviar.slice(i, i + 5);
      // allSettled: si uno falla, los demás del lote siguen su curso.
      await Promise.allSettled(lote.map(enviarUno));
    }
    // Nota: en "detalle" solo van números e identificadores. Nunca títulos de eventos
    // ni nombres, porque en las sesiones coach el título ES el nombre de la persona.
    anotar(`${resumen.enviados} aviso(s) enviados, ${resumen.fallidos} fallido(s).`);
    if (muertasAjenas > 0) {
      anotar(`${muertasAjenas} persona(s) deben volver a activar los avisos en su aparato.`);
    }

    // 8. Se guarda TODO el control en una sola escritura, en la ficha del enviador.
    // updateMask toca solo campos de push: nunca "role" ni "uid" (las reglas lo rechazan).
    if (fichaControl && (nuevasClaves.length || limpiarPropia)) {
      const cambios = { pushUpdatedAt: new Ts(new Date()) };
      cambios.pushSent = [...memoria, ...nuevasClaves].slice(-MAX_CLAVES);
      if (limpiarPropia) {
        cambios.pushEndpoint = "";
        cambios.pushP256dh = "";
        cambios.pushAuth = "";
      }
      try {
        await fs.patchDoc(`workspaces/${WORKSPACE_ID}/members/${uidEnviador}`, cambios);
      } catch (error) {
        anotar("No se pudo guardar el control de duplicados; algún aviso podría repetirse.");
        console.error("[push-tick] no se pudo guardar la ficha de control", error?.status || "");
      }
    }

    res.status(200).json(resumen);
  } catch (error) {
    // Falla gorda (no hay sesión, Firestore caído...): se responde claro y sin secretos.
    console.error("[push-tick] fallo general", String(error?.message || "").slice(0, 200));
    res.status(500).json({
      ok: false,
      mode,
      revisados: resumen.revisados,
      enviados: resumen.enviados,
      fallidos: resumen.fallidos,
      detalle: [...resumen.detalle, "El proceso se detuvo por un error del servidor."],
      error: "No se pudo repartir los avisos en este momento."
    });
  }
}
