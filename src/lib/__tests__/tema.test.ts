import { describe, expect, it } from "vitest";
import {
  ACENTO_AGENDA_MB,
  APARIENCIA_PREDETERMINADA,
  colorSecundario,
  contraste,
  hexAHsv,
  hsvAHex,
  leerApariencia,
  legibleSobre,
  normalizarHex,
  paleta,
  resolverModo
} from "../tema";

describe("colores", () => {
  it("lee colores escritos de varias formas y descarta lo que no es color", () => {
    expect(normalizarHex("#5B2DFF")).toBe("#5b2dff");
    expect(normalizarHex("f0a")).toBe("#ff00aa");
    expect(normalizarHex("violeta")).toBeNull();
    expect(normalizarHex(42)).toBeNull();
  });

  it("la rueda (tono, saturación, brillo) va y vuelve al mismo color", () => {
    for (const hex of ["#5b2dff", "#2196f3", "#f09ab9", "#34c3a0", "#d7b46a"]) {
      const vuelta = hsvAHex(hexAHsv(hex));
      // Puede moverse un punto por el redondeo, nunca más.
      const [a, b] = [hex, vuelta].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
      a.forEach((canal, i) => expect(Math.abs(canal - b[i])).toBeLessThanOrEqual(3));
    }
    expect(hexAHsv("#ff0000")).toEqual({ h: 0, s: 100, v: 100 });
  });

  it("el secundario del violeta del logo es un azul, como en el logo", () => {
    const { h } = hexAHsv(colorSecundario(ACENTO_AGENDA_MB));
    expect(h).toBeGreaterThanOrEqual(195);
    expect(h).toBeLessThanOrEqual(225);
  });

  it("un color que no se lee sobre el fondo se ajusta lo justo", () => {
    expect(contraste(legibleSobre("#ffff00", "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(legibleSobre("#2b3a7a", "#ffffff")).toBe("#2b3a7a");
  });

  // Colores que la gente podría elegir, incluidos los difíciles (blanco, negro, amarillo).
  const COLORES = [ACENTO_AGENDA_MB, "#f09ab9", "#d7b46a", "#2196f3", "#ffff00", "#000000", "#ffffff", "#34c3a0"];

  it.each(COLORES)("con %s, en claro y en oscuro, el texto siempre se lee", (acento) => {
    for (const base of ["light", "dark"] as const) {
      const p = paleta(acento, base);
      for (const fondo of [p["--app-bg"], p["--app-bg-soft"]]) {
        expect(contraste(p["--app-strong"], fondo)).toBeGreaterThanOrEqual(7);
        expect(contraste(p["--app-muted"], fondo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(p["--app-accent"], fondo)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(p["--app-faint"], p["--app-bg"])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("apariencia guardada", () => {
  it("por defecto: oscuro con el violeta del logo", () => {
    expect(APARIENCIA_PREDETERMINADA).toEqual({ modo: "oscuro", acento: "#5b2dff" });
  });

  it("el modo automático sigue al aparato", () => {
    expect(resolverModo("auto", true)).toBe("dark");
    expect(resolverModo("auto", false)).toBe("light");
    expect(resolverModo("claro", true)).toBe("light");
    expect(resolverModo("oscuro", false)).toBe("dark");
  });

  it("se lee con cuidado: si está dañada, no se usa", () => {
    expect(leerApariencia({ modo: "auto", acento: "#ABCDEF" })).toEqual({ modo: "auto", acento: "#abcdef" });
    expect(leerApariencia({ modo: "raro", acento: "#abcdef" })).toBeNull();
    expect(leerApariencia({ modo: "claro", acento: "url(x)" })).toBeNull();
    expect(leerApariencia("texto")).toBeNull();
  });

  it("quien venía del formato anterior conserva lo que había elegido", () => {
    expect(leerApariencia(undefined, "pink")).toEqual({ modo: "claro", acento: "#f09ab9" });
    expect(leerApariencia(undefined, "custom", { base: "dark", accent: "#E5739B" })).toEqual({ modo: "oscuro", acento: "#e5739b" });
    // "dark" era el de siempre: pasa a la nueva identidad (violeta del logo).
    expect(leerApariencia(undefined, "dark")).toBeNull();
    // Lo nuevo manda sobre lo viejo.
    expect(leerApariencia({ modo: "auto", acento: "#2196f3" }, "pink")).toEqual({ modo: "auto", acento: "#2196f3" });
  });
});
