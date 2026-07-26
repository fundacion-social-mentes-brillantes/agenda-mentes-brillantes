import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { DocumentSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/*
 * Avisos push "de verdad" (llegan al celular aunque la app esté cerrada).
 *
 * Se usa Web Push estándar con llaves VAPID: el navegador crea una suscripción
 * y aquí la guardamos en el documento del miembro (workspaces/{ws}/members/{uid}).
 * Después el servidor lee esa suscripción y manda los avisos.
 *
 * Ojo con las reglas de seguridad: un miembro solo puede escribir en SU propio
 * documento y nunca debe tocar los campos "role" ni "uid".
 *
 * Ojo también con el modelo: se guarda UN SOLO endpoint por persona, así que
 * activar en el computador reemplaza el del celular. Aquí somos honestos con
 * eso en lugar de prometer varios aparatos.
 */

/** Agenda donde el servidor busca a quién avisar (equipo GEMB). */
export const AGENDA_AVISOS = "nybtxAzWmNO1ZjgRsFzu";

/** Respuesta de /api/push-key */
type RespuestaLlave = { publicKey?: string };

/** Estado actual de los avisos en este dispositivo. */
export type EstadoPush = {
  soportado: boolean;
  permiso: NotificationPermission | "unsupported";
  suscrito: boolean;
  /** Endpoint de la suscripción de ESTE navegador ('' si no hay). */
  endpoint: string;
};

/** Preferencias guardadas del miembro. */
export type PreferenciasPush = {
  notifyBefore: boolean;
  notifyDaily: boolean;
  suscrito: boolean;
  /** Endpoint guardado en la agenda: puede ser de OTRO aparato ('' si no hay). */
  endpoint: string;
};

const PREFERENCIAS_POR_DEFECTO: PreferenciasPush = {
  notifyBefore: false,
  notifyDaily: false,
  suscrito: false,
  endpoint: ""
};

/** Tiempo máximo que esperamos a una escritura antes de rendirnos (ms). */
const LIMITE_ESCRITURA_MS = 8000;

/** ¿Este navegador puede recibir avisos push? */
export function pushSoportado(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Detecta un iPhone/iPad donde la app NO está instalada en la pantalla de inicio. */
function esIphoneSinInstalar(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const navegador = navigator as Navigator & { standalone?: boolean };
  const esApple =
    /iPad|iPhone|iPod/.test(navegador.userAgent) ||
    (navegador.platform === "MacIntel" && navegador.maxTouchPoints > 1);
  if (!esApple) return false;

  const instalada =
    navegador.standalone === true ||
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
  return !instalada;
}

/**
 * Espera al service worker SIN quedarse colgado.
 *
 * navigator.serviceWorker.ready nunca falla: si el service worker no se registró
 * (modo desarrollo, pestaña privada, error de red) la promesa se queda pendiente
 * PARA SIEMPRE y los botones se quedan en "Activando..." sin salida. Con esta
 * carrera contra el reloj siempre hay respuesta: el registro o null.
 */
async function registroListo(msMax = 8000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const espera = new Promise<null>((r) => setTimeout(() => r(null), msMax));
  return Promise.race([navigator.serviceWorker.ready, espera]);
}

/**
 * Igual de importante con Firestore: la base usa caché local persistente, así que
 * updateDoc() NO falla sin internet, queda encolado y su promesa nunca termina.
 * Devuelve true si alcanzó a guardarse; false si venció el plazo (el cambio queda
 * encolado y se subirá solo cuando vuelva la conexión, no se pierde).
 */
async function escribirConLimite(escritura: Promise<void>, msMax = LIMITE_ESCRITURA_MS): Promise<boolean> {
  const espera = new Promise<false>((r) => setTimeout(() => r(false), msMax));
  return Promise.race([escritura.then(() => true), espera]);
}

/** Convierte la llave VAPID (base64 url-safe) al formato que pide el navegador. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(normal);
  const salida = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) {
    salida[i] = crudo.charCodeAt(i);
  }
  return salida;
}

/** Pide al servidor la llave pública VAPID. */
async function pedirLlavePublica(): Promise<string> {
  const respuesta = await fetch("/api/push-key");
  if (!respuesta.ok) throw new Error("El servidor no entregó la llave de avisos");
  const datos = (await respuesta.json()) as RespuestaLlave;
  const llave = (datos.publicKey || "").trim();
  if (!llave) throw new Error("El servidor no entregó la llave de avisos");
  return llave;
}

/** Referencia al documento del miembro dentro de la agenda. */
function refMiembro(workspaceId: string, uid: string) {
  return doc(db, "workspaces", workspaceId, "members", uid);
}

/** Datos de la suscripción que necesita el servidor para cifrar el mensaje. */
type DatosSuscripcion = { pushEndpoint: string; pushP256dh: string; pushAuth: string };

function leerSuscripcion(sub: PushSubscription): DatosSuscripcion | null {
  const datosSub = sub.toJSON();
  const pushEndpoint = datosSub.endpoint || sub.endpoint || "";
  const pushP256dh = datosSub.keys?.p256dh || "";
  const pushAuth = datosSub.keys?.auth || "";
  if (!pushEndpoint || !pushP256dh || !pushAuth) return null;
  return { pushEndpoint, pushP256dh, pushAuth };
}

/*
 * Recuerdo local: el último endpoint que ESTE navegador dejó guardado en la agenda.
 * Sirve para distinguir dos casos que se ven igual desde afuera:
 *  - el navegador renovó su suscripción por su cuenta (hay que actualizarla), y
 *  - los avisos se los llevó otro aparato (no hay que quitárselos a escondidas).
 */
function claveRecuerdo(workspaceId: string, uid: string): string {
  return `pushEndpointGuardado_${workspaceId}_${uid}`;
}

function recordarEndpoint(workspaceId: string, uid: string, endpoint: string) {
  try {
    if (endpoint) localStorage.setItem(claveRecuerdo(workspaceId, uid), endpoint);
    else localStorage.removeItem(claveRecuerdo(workspaceId, uid));
  } catch {
    /* sin almacenamiento: solo perdemos el arreglo automático */
  }
}

function endpointRecordado(workspaceId: string, uid: string): string {
  try {
    return localStorage.getItem(claveRecuerdo(workspaceId, uid)) || "";
  } catch {
    return "";
  }
}

/** Cuenta cómo están hoy los avisos en este dispositivo. */
export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSoportado()) {
    return { soportado: false, permiso: "unsupported", suscrito: false, endpoint: "" };
  }

  const permiso = Notification.permission;
  try {
    const reg = await registroListo(3000);
    // Sin service worker no podemos saber nada de la suscripción: mejor decir que no hay.
    if (!reg) return { soportado: true, permiso, suscrito: false, endpoint: "" };

    const sub = await reg.pushManager.getSubscription();
    return {
      soportado: true,
      permiso,
      suscrito: sub !== null,
      endpoint: sub ? sub.endpoint || "" : ""
    };
  } catch {
    // El service worker todavía no está listo: sabemos el permiso, no la suscripción.
    return { soportado: true, permiso, suscrito: false, endpoint: "" };
  }
}

/** Lee las preferencias que ya tenía el miembro, para no pisárselas al reactivar. */
async function prefsPrevias(workspaceId: string, uid: string): Promise<{ notifyBefore: boolean; notifyDaily: boolean }> {
  // Si el campo no existe todavía, los avisos arrancan encendidos (es lo que espera
  // quien acaba de tocar "Activar"). Si ya existe, se respeta lo que la persona eligió.
  const pordefecto = { notifyBefore: true, notifyDaily: true };
  try {
    const espera = new Promise<null>((r) => setTimeout(() => r(null), 5000));
    const snap = (await Promise.race([getDoc(refMiembro(workspaceId, uid)), espera])) as DocumentSnapshot | null;
    if (!snap || !snap.exists()) return pordefecto;

    const datos = snap.data();
    return {
      notifyBefore: typeof datos.notifyBefore === "boolean" ? datos.notifyBefore : true,
      notifyDaily: typeof datos.notifyDaily === "boolean" ? datos.notifyDaily : true
    };
  } catch {
    return pordefecto;
  }
}

/**
 * Enciende los avisos en este dispositivo y guarda la suscripción en Firestore.
 * Debe llamarse desde un toque del usuario (el navegador exige un gesto para
 * poder pedir el permiso de notificaciones).
 */
export async function activarPush(
  workspaceId: string,
  uid: string
): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSoportado()) {
    if (esIphoneSinInstalar()) {
      return { ok: false, motivo: "En iPhone debes instalar la app en la pantalla de inicio" };
    }
    return { ok: false, motivo: "Este navegador no puede recibir avisos" };
  }

  // 1) Permiso del navegador.
  let permiso: NotificationPermission;
  try {
    permiso = await Notification.requestPermission();
  } catch {
    return { ok: false, motivo: "El navegador bloqueó los avisos" };
  }
  if (permiso !== "granted") {
    if (esIphoneSinInstalar()) {
      return { ok: false, motivo: "En iPhone debes instalar la app en la pantalla de inicio" };
    }
    return { ok: false, motivo: "El navegador bloqueó los avisos" };
  }

  // 2) Suscripción con la llave del servidor.
  let sub: PushSubscription;
  try {
    const reg = await registroListo(8000);
    if (!reg) {
      return { ok: false, motivo: "Los avisos aún no están listos, vuelve a intentar en unos segundos" };
    }

    const llave = await pedirLlavePublica();
    const applicationServerKey = urlBase64ToUint8Array(llave);

    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    } catch {
      // Puede quedar una suscripción vieja hecha con otra llave: la borramos y reintentamos.
      const anterior = await reg.pushManager.getSubscription();
      if (anterior) await anterior.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }
  } catch {
    return { ok: false, motivo: "No pudimos activar los avisos en este dispositivo" };
  }

  // 3) Las claves que necesita el servidor para cifrar el mensaje.
  const datos = leerSuscripcion(sub);
  if (!datos) {
    return { ok: false, motivo: "El navegador entregó una suscripción incompleta" };
  }

  // 4) Guardamos en el documento del miembro (nunca tocamos role ni uid) conservando
  //    los interruptores que la persona ya había elegido.
  const previas = await prefsPrevias(workspaceId, uid);
  try {
    const guardado = await escribirConLimite(
      updateDoc(refMiembro(workspaceId, uid), {
        ...datos,
        notifyBefore: previas.notifyBefore,
        notifyDaily: previas.notifyDaily,
        pushUpdatedAt: serverTimestamp()
      })
    );
    if (!guardado) {
      return { ok: false, motivo: "Sin conexión: se guardará cuando vuelva el internet" };
    }
  } catch {
    return { ok: false, motivo: "No pudimos guardar tus avisos en la agenda" };
  }

  recordarEndpoint(workspaceId, uid, datos.pushEndpoint);
  return { ok: true };
}

/** Apaga los avisos: cancela la suscripción del navegador y limpia Firestore. */
export async function desactivarPush(
  workspaceId: string,
  uid: string
): Promise<{ ok: boolean; motivo?: string }> {
  if (pushSoportado()) {
    try {
      const reg = await registroListo(3000);
      // Si el service worker no responde igual limpiamos la agenda: sin suscripción
      // guardada el servidor deja de mandar avisos.
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) await sub.unsubscribe();
    } catch {
      /* si el navegador no deja cancelar, igual limpiamos la agenda */
    }
  }

  recordarEndpoint(workspaceId, uid, "");

  try {
    const guardado = await escribirConLimite(
      updateDoc(refMiembro(workspaceId, uid), {
        pushEndpoint: "",
        pushP256dh: "",
        pushAuth: "",
        notifyBefore: false,
        notifyDaily: false,
        pushUpdatedAt: serverTimestamp()
      })
    );
    if (!guardado) {
      return { ok: false, motivo: "Sin conexión: se guardará cuando vuelva el internet" };
    }
  } catch {
    return { ok: false, motivo: "No pudimos guardar el cambio en la agenda" };
  }

  return { ok: true };
}

/**
 * Repara en silencio la suscripción de este navegador.
 *
 * Cada tanto el navegador cambia la suscripción por su cuenta (caduca, se renueva,
 * se reinstala el service worker). Cuando eso pasa, lo guardado en la agenda queda
 * viejo y la persona se queda SIN avisos para siempre sin enterarse. Aquí, al
 * arrancar la app, comparamos y actualizamos.
 *
 * Solo se actualiza si lo guardado es el endpoint que este mismo navegador dejó la
 * última vez; si lo guardado es de OTRO aparato no se toca (los avisos son de un
 * solo aparato y quitárselos a escondidas sería una pelea sin fin entre equipos).
 * Cualquier error se ignora: se reintenta en el próximo arranque.
 */
export async function sincronizarPush(workspaceId: string, uid: string): Promise<void> {
  if (!workspaceId || !uid || !pushSoportado()) return;

  try {
    if (Notification.permission !== "granted") return;

    const reg = await registroListo(8000);
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const datos = leerSuscripcion(sub);
    if (!datos) return;

    const snap = await getDoc(refMiembro(workspaceId, uid));
    if (!snap.exists()) return;

    const valor = snap.data().pushEndpoint;
    const guardado = typeof valor === "string" ? valor : "";
    if (!guardado || guardado === datos.pushEndpoint) return;
    if (guardado !== endpointRecordado(workspaceId, uid)) return; // lo tiene otro aparato

    // Solo la suscripción: jamás notifyBefore, notifyDaily, role ni uid.
    await updateDoc(refMiembro(workspaceId, uid), {
      ...datos,
      pushUpdatedAt: serverTimestamp()
    });
    recordarEndpoint(workspaceId, uid, datos.pushEndpoint);
  } catch {
    /* silencioso: se vuelve a intentar la próxima vez que se abra la app */
  }
}

/** Guarda solo las preferencias que el usuario cambió (15 minutos antes / resumen). */
export async function guardarPreferencias(
  workspaceId: string,
  uid: string,
  prefs: { notifyBefore?: boolean; notifyDaily?: boolean }
): Promise<void> {
  const cambios: Record<string, unknown> = { pushUpdatedAt: serverTimestamp() };
  if (typeof prefs.notifyBefore === "boolean") cambios.notifyBefore = prefs.notifyBefore;
  if (typeof prefs.notifyDaily === "boolean") cambios.notifyDaily = prefs.notifyDaily;

  await updateDoc(refMiembro(workspaceId, uid), cambios);
}

/** Lee las preferencias guardadas. Si algo falla devuelve todo apagado, sin lanzar error. */
export async function leerPreferencias(workspaceId: string, uid: string): Promise<PreferenciasPush> {
  try {
    const snap = await getDoc(refMiembro(workspaceId, uid));
    if (!snap.exists()) return { ...PREFERENCIAS_POR_DEFECTO };

    const datos = snap.data();
    const endpoint = typeof datos.pushEndpoint === "string" ? datos.pushEndpoint : "";
    return {
      notifyBefore: datos.notifyBefore === true,
      notifyDaily: datos.notifyDaily === true,
      suscrito: endpoint.length > 0,
      endpoint
    };
  } catch {
    return { ...PREFERENCIAS_POR_DEFECTO };
  }
}
