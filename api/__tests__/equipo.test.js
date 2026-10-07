import { describe, expect, it } from "vitest";
import { agendasDelEquipo, esDelEquipo, fechaEnBogota } from "../_lib/agenda.js";

const DUENO_EQUIPO = "xGsf9WRF9dUIJfs885AZzXFhjhf1";

// Firestore falso: membresias de la persona y los documentos de cada agenda.
function fsFalso({ membresias, agendas }) {
  return {
    async runQuery() {
      return membresias.map((wsId) => ({ name: `projects/p/databases/(default)/documents/workspaces/${wsId}/members/u1` }));
    },
    async getDoc(ruta) {
      const id = ruta.split("/")[1];
      return agendas[id] ? { id, data: agendas[id] } : null;
    },
  };
}

describe("quien es del equipo", () => {
  it("la agenda compartida de la fundacion cuenta", async () => {
    const fs = fsFalso({ membresias: ["personal_u1", "GEMB"], agendas: { GEMB: { ownerId: DUENO_EQUIPO } } });
    expect(await esDelEquipo(fs, "u1")).toBe(true);
    expect([...(await agendasDelEquipo(fs, "u1"))]).toEqual(["GEMB"]);
  });

  it("crearse una agenda propia NO lo vuelve del equipo (el hueco que se cerro)", async () => {
    const fs = fsFalso({ membresias: ["personal_u1", "mia"], agendas: { mia: { ownerId: "u1" } } });
    expect(await esDelEquipo(fs, "u1")).toBe(false);
  });

  it("si algo falla, la respuesta es no", async () => {
    const fs = { runQuery: async () => { throw new Error("caida"); }, getDoc: async () => null };
    expect(await esDelEquipo(fs, "u1")).toBe(false);
    expect(await esDelEquipo(fsFalso({ membresias: ["GEMB"], agendas: {} }), "")).toBe(false);
  });
});

describe("fecha en Colombia", () => {
  it("una sesion de las 10:30 pm del dia 6 en Colombia es del 6, aunque en UTC ya sea el 7", () => {
    expect(fechaEnBogota("2026-10-07T03:30:00Z")).toBe("2026-10-06");
    expect(fechaEnBogota("2026-10-07T12:00:00Z")).toBe("2026-10-07");
    expect(fechaEnBogota(null)).toBeNull();
  });
});
