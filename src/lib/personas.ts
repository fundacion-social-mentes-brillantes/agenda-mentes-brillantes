// Personas de las sesiones coach: son las mismas del ERP y se cruzan SOLO por el código
// (clientCode en la agenda = asistentes.codigo en el ERP). Si dos apps le dan el mismo
// número a personas distintas, al pasar una sesión al ERP se descuenta del paquete de
// quien NO es. Aquí están las comprobaciones para que eso no pase.
import { consultarEstadoErp } from "../services/erpService";
import type { Client } from "../types/client";

/** Palabras del nombre sin tildes ni mayúsculas (aquí y no en clientsService, que importa este archivo). */
function palabras(nombre: string): string[] {
  return (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Distancia de edición: cuántas letras hay que cambiar, poner, quitar o voltear para pasar
 * de una palabra a la otra ("Jhon" / "John" es 1).
 */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * ¿Es la misma persona escrita un poco distinto? ("Catalina Gómez" y "catalina gomez ruiz";
 * no "Catalina Gómez" y "Catalina Ruiz").
 */
export function mismoNombre(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.length || !pb.length) return false;
  const [corta, larga] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return corta.every((p, i) => larga[i] === p);
}

/**
 * Personas con un nombre parecido al que se dictó o escribió: el mismo primer nombre, o
 * una o dos letras de diferencia ("Katalina" / "Catalina", "Jhon" / "John").
 */
export function personasParecidas(nombre: string, lista: Client[], maximo = 5): Client[] {
  const buscado = palabras(nombre);
  if (!buscado.length) return [];
  const completo = buscado.join(" ");
  return lista
    .filter((c) => {
      const suyo = palabras(c.name);
      if (!suyo.length) return false;
      if (suyo[0] === buscado[0]) return true;
      const tope = Math.max(1, Math.floor(Math.min(completo.length, suyo.join(" ").length) / 6));
      if (distancia(completo, suyo.join(" ")) <= tope) return true;
      return buscado[0].length >= 4 && distancia(buscado[0], suyo[0]) <= 1;
    })
    .slice(0, maximo);
}

/**
 * Antes de crear una persona en la agenda con el código `codigo`: si en el ERP ese código ya
 * es de OTRA persona, devuelve el aviso (y no se debe crear). Si el ERP no responde, no se
 * bloquea la agenda (devuelve null), igual que el resto de la integración.
 */
export async function choqueConErp(codigo: number, nombre: string): Promise<string | null> {
  const estado = (await consultarEstadoErp([codigo]))?.get(codigo);
  if (!estado?.existe || !estado.nombre || mismoNombre(estado.nombre, nombre)) return null;
  return `En el ERP el código #${codigo} ya es de "${estado.nombre}". Para no cruzar las cuentas, crea primero a "${nombre}" en el ERP y luego agrégala aquí con el mismo código que le dé el ERP.`;
}
