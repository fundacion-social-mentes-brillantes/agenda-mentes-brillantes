import { describe, expect, it } from "vitest";
import { debeRecargar } from "../paginaPerezosa";

function almacen() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

describe("debeRecargar", () => {
  it("la primera vez recarga para traer la version nueva", () => {
    expect(debeRecargar(1_000_000, almacen())).toBe(true);
  });

  it("si ya recargo hace un momento no insiste (no hay bucle)", () => {
    const a = almacen();
    expect(debeRecargar(1_000_000, a)).toBe(true);
    expect(debeRecargar(1_005_000, a)).toBe(false);
  });

  it("pasado un rato puede volver a recargar (otra publicacion)", () => {
    const a = almacen();
    debeRecargar(1_000_000, a);
    expect(debeRecargar(1_000_000 + 60_000, a)).toBe(true);
  });

  it("sin almacenamiento recarga igual", () => {
    expect(debeRecargar(1_000_000, null)).toBe(true);
  });
});
