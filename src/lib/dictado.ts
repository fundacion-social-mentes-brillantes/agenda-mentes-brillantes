// Dictado del asistente: se graba con el micrófono del celular y el servidor lo pasa a texto
// (Azure Speech, español de Colombia). Sirve también en la app instalada en iPhone, donde el
// dictado del navegador (SpeechRecognition) no funciona. El audio no se guarda en ningún lado.

/** Un dictado no pasa de un minuto (un pedido largo cabe de sobra). */
export const MAX_SEGUNDOS_DICTADO = 60;

export function puedeGrabar(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** El formato que mejor graba cada navegador: Chrome/Android webm (opus); iPhone mp4 (aac). */
function formatoPreferido(): string | undefined {
  const opciones = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return opciones.find((tipo) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(tipo));
}

export interface Grabacion {
  /** Termina y entrega el audio (null si no se grabó nada). */
  detener: () => Promise<Blob | null>;
  /** Termina sin entregar nada y suelta el micrófono. */
  cancelar: () => void;
}

/** Pide el micrófono y empieza a grabar. Lanza el error del navegador si no lo dejan. */
export async function empezarGrabacion(): Promise<Grabacion> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const tipo = formatoPreferido();
  let rec: MediaRecorder;
  try {
    rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    throw error;
  }
  const partes: Blob[] = [];
  let cancelado = false;
  const soltar = () => stream.getTracks().forEach((t) => t.stop());
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) partes.push(e.data);
  };
  const terminado = new Promise<Blob | null>((ok) => {
    rec.onstop = () => {
      soltar();
      ok(partes.length ? new Blob(partes, { type: rec.mimeType || tipo || "audio/webm" }) : null);
    };
  });
  rec.start(250);
  return {
    detener: async () => {
      if (rec.state !== "inactive") rec.stop();
      const audio = await terminado;
      return cancelado ? null : audio;
    },
    cancelar: () => {
      cancelado = true;
      if (rec.state !== "inactive") rec.stop();
      else soltar();
    }
  };
}

/** El audio en base64 (sin el "data:..."), por pedazos para no reventar la pila en celulares. */
export async function audioABase64(audio: Blob): Promise<string> {
  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binario = "";
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) binario += String.fromCharCode(...bytes.subarray(i, i + paso));
  return btoa(binario);
}

/** Lo que se le dice a la persona según el error del navegador al pedir el micrófono. */
export function mensajeErrorMicrofono(error: unknown): string {
  const nombre = error instanceof Error || (error && typeof error === "object" && "name" in error) ? String((error as { name?: string }).name) : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "El micrófono está bloqueado para la agenda. Permítelo en los ajustes del navegador o del celular y vuelve a intentar.";
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No encontré un micrófono en este equipo.";
  if (nombre === "NotReadableError") return "Otra app está usando el micrófono. Ciérrala y vuelve a intentar.";
  return "No pude usar el micrófono. Puedes usar el micrófono 🎙️ del teclado.";
}
