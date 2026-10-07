import { lazy, type ComponentType } from "react";

// Cada pagina se baja aparte la primera vez que se abre. Si mientras la agenda
// estaba abierta se publico una version nueva, la pieza vieja ya no existe en
// el servidor y la importacion falla: sin esto la pantalla quedaba en blanco.
// Se recarga UNA vez para traer la version nueva; si vuelve a fallar enseguida,
// el problema es otro y no se insiste (evita un bucle de recargas).

const CLAVE = "agenda_recarga_por_version";
const VENTANA_MS = 10_000;

type Almacen = Pick<Storage, "getItem" | "setItem">;

/** Dice si toca recargar (y deja anotado cuando), o false si ya se intento hace poco. */
export function debeRecargar(ahora: number, almacen: Almacen | null): boolean {
  try {
    const ultima = Number(almacen?.getItem(CLAVE) || 0);
    if (ahora - ultima < VENTANA_MS) return false;
    almacen?.setItem(CLAVE, String(ahora));
  } catch {
    /* sin almacenamiento: se recarga igual, una sola vez por pestana no se puede garantizar */
  }
  return true;
}

function almacenDeSesion(): Almacen | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Como React.lazy, pero se recupera sola si se publico una version nueva. */
export function paginaPerezosa<P extends object>(importar: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(async () => {
    try {
      return await importar();
    } catch (error) {
      if (debeRecargar(Date.now(), almacenDeSesion())) {
        window.location.reload();
        // La pagina se esta recargando: no hay nada que mostrar mientras tanto.
        return new Promise<{ default: ComponentType<P> }>(() => {});
      }
      throw error;
    }
  });
}
