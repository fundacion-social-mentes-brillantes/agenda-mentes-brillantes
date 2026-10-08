import { describe, expect, it } from "vitest";
import { baseDelTema, contraste, leerTema, leerTemaPersonal, legibleSobre, normalizarHex, paletaPersonal } from "../tema";

describe("tema personal", () => {
  it("lee colores escritos de varias formas y descarta lo que no es color", () => {
    expect(normalizarHex("#E5739B")).toBe("#e5739b");
    expect(normalizarHex("f0a")).toBe("#ff00aa");
    expect(normalizarHex("rosado")).toBeNull();
    expect(normalizarHex(42)).toBeNull();
  });

  it("un color muy claro se oscurece lo justo para poder leerlo sobre blanco", () => {
    const amarillo = legibleSobre("#ffff00", "#ffffff");
    expect(contraste(amarillo, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // Uno que ya se lee no se toca.
    expect(legibleSobre("#2b3a7a", "#ffffff")).toBe("#2b3a7a");
  });

  // Colores que la gente podría elegir, incluidos los difíciles (blanco, negro, amarillo).
  const COLORES = ["#e5739b", "#f0a3c0", "#d7b46a", "#2b3a7a", "#ffff00", "#000000", "#ffffff", "#38b2ac"];

  it.each(COLORES)("con %s, en claro y en oscuro, el texto siempre se lee", (accent) => {
    for (const base of ["light", "dark"] as const) {
      const p = paletaPersonal({ base, accent });
      expect(contraste(p["--app-strong"], p["--app-bg"])).toBeGreaterThanOrEqual(7);
      expect(contraste(p["--app-muted"], p["--app-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p["--app-accent"], p["--app-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p["--app-faint"], p["--app-bg"])).toBeGreaterThanOrEqual(3);
    }
  });

  it("lo guardado se lee con cuidado: si está dañado, no se usa", () => {
    expect(leerTemaPersonal({ base: "dark", accent: "#ABCDEF" })).toEqual({ base: "dark", accent: "#abcdef" });
    expect(leerTemaPersonal({ base: "raro", accent: "#abcdef" })).toEqual({ base: "light", accent: "#abcdef" });
    expect(leerTemaPersonal({ base: "dark", accent: "url(x)" })).toBeNull();
    expect(leerTemaPersonal("texto")).toBeNull();
    expect(leerTema("pink")).toBe("pink");
    expect(leerTema("Pink Brillante")).toBeNull();
  });

  it("cada tema dice si la pantalla es clara u oscura", () => {
    const personal = { base: "light" as const, accent: "#e5739b" };
    expect(baseDelTema("dark", personal)).toBe("dark");
    expect(baseDelTema("pink", personal)).toBe("light");
    expect(baseDelTema("custom", personal)).toBe("light");
    expect(baseDelTema("custom", { ...personal, base: "dark" })).toBe("dark");
  });
});
