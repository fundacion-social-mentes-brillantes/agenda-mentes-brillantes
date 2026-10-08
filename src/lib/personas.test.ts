import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../types/client";

// El ERP falso: el código -> la persona que tiene allá.
const erp = new Map<number, { codigo: string; existe: boolean; nombre?: string }>();
vi.mock("../services/erpService", () => ({
  consultarEstadoErp: async (codigos: number[]) => {
    if (erp.has(-1)) return null; // el ERP no responde
    return new Map(codigos.map((c) => [c, erp.get(c) || { codigo: String(c), existe: false }]));
  }
}));

const { choqueConErp, mismoNombre, personasParecidas } = await import("./personas");

const persona = (code: number, name: string): Client =>
  ({ id: `c${code}`, workspaceId: "GEMB", code, name, nameLower: name.toLowerCase(), active: true, createdAt: new Date() }) as Client;
const lista = [persona(1, "Catalina Gómez"), persona(2, "Catalina Ruiz"), persona(3, "Jorge Pérez"), persona(4, "John Mejía")];

describe("personas de las sesiones coach (se cruzan con el ERP por el código)", () => {
  beforeEach(() => erp.clear());

  it("mismo nombre escrito distinto sí; otra persona con el mismo primer nombre no", () => {
    expect(mismoNombre("Catalina Gómez", "catalina gomez ruiz")).toBe(true);
    expect(mismoNombre("CATALINA GOMEZ", "Catalina Gómez")).toBe(true);
    expect(mismoNombre("Catalina Gómez", "Catalina Ruiz")).toBe(false);
  });

  it("nombres parecidos: lo que el dictado suele oír mal", () => {
    expect(personasParecidas("Katalina", lista).map((c) => c.code)).toEqual([1, 2]);
    expect(personasParecidas("Jhon Mejia", lista).map((c) => c.code)).toEqual([4]);
    expect(personasParecidas("Jorge", lista).map((c) => c.code)).toEqual([3]);
    expect(personasParecidas("Valentina Ortiz", lista)).toEqual([]);
  });

  it("no se crea con un código que en el ERP es de otra persona", async () => {
    erp.set(5, { codigo: "5", existe: true, nombre: "Pedro Ramírez" });
    expect(await choqueConErp(5, "Laura Gómez")).toMatch(/ya es de "Pedro Ramírez"/);
  });

  it("sí se crea si el ERP tiene a la misma persona, si no la tiene o si no responde", async () => {
    erp.set(6, { codigo: "6", existe: true, nombre: "Laura Gómez Díaz" });
    expect(await choqueConErp(6, "laura gomez")).toBeNull();
    expect(await choqueConErp(7, "Laura Gómez")).toBeNull();
    erp.set(-1, { codigo: "-1", existe: false });
    expect(await choqueConErp(5, "Laura Gómez")).toBeNull();
  });
});
