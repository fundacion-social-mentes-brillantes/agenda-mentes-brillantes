/**
 * La pantalla de carga (el logo de Agenda MB animado con "GEMB" debajo) vive en
 * index.html para salir al instante. La app le avisa cuando ya hay algo que
 * mostrar; si nadie avisa, a los 12 s se quita sola.
 */
interface Arranque {
  listo: () => void;
}

declare global {
  interface Window {
    __arranque?: Arranque;
  }
}

export const arranque = {
  /** La app ya se puede usar: el anillo destella y la pantalla se desvanece. */
  listo() {
    try {
      window.__arranque?.listo();
    } catch {
      /* sin pantalla de carga */
    }
  }
};
