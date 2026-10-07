import { beforeEach, describe, expect, it, vi } from "vitest";
import { peticion, respuesta } from "./ayudas.js";

const DUENO_EQUIPO = "xGsf9WRF9dUIJfs885AZzXFhjhf1";
const estado = { usuario: { localId: "u1" }, membresias: [], agendas: {}, eventos: {} };

vi.mock("../_lib/firestore.js", async (original) => {
  const real = await original();
  class UserFirestoreFalso {
    async runQuery() {
      return estado.membresias.map((wsId) => ({ name: `x/documents/workspaces/${wsId}/members/u1` }));
    }
    async getDoc(ruta) {
      const [coleccion, id] = ruta.split("/");
      const fuente = coleccion === "workspaces" ? estado.agendas : estado.eventos;
      return fuente[id] ? { id, data: fuente[id] } : null;
    }
  }
  return { ...real, verifyIdToken: async (t) => (t ? estado.usuario : null), UserFirestore: UserFirestoreFalso };
});

const llamadasErp = [];
const handler = (await import("../erp.js")).default;
const handlerSync = (await import("../erp-sync.js")).default;

beforeEach(() => {
  process.env.ERP_SHARED_SECRET = "secreto-erp";
  estado.membresias = ["GEMB"];
  estado.agendas = { GEMB: { ownerId: DUENO_EQUIPO }, mia: { ownerId: "u1" } };
  estado.eventos = {
    ev1: { workspaceId: "GEMB", kind: "coach", clientCode: 211, startAt: "2026-10-06T15:00:00Z" },
    ajeno: { workspaceId: "mia", kind: "coach", clientCode: 211, startAt: "2026-10-06T15:00:00Z" },
  };
  llamadasErp.length = 0;
  globalThis.fetch = vi.fn(async (url, init) => {
    llamadasErp.push({ url: String(url), cuerpo: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ estado: "registrada" }), { status: 200 });
  });
});

async function llamar(h, body) {
  const res = respuesta();
  await h(peticion({ body: { idToken: "token", ...body } }), res);
  return res;
}

describe("puente agenda -> ERP", () => {
  it("quien solo tiene su propia agenda no entra", async () => {
    estado.membresias = ["mia"];
    const res = await llamar(handler, { codigos: ["211"] });
    expect(res.statusCode).toBe(403);
    expect(llamadasErp).toHaveLength(0);
  });

  it("registra la sesion si el evento de la agenda del equipo coincide", async () => {
    const res = await llamar(handler, { accion: "registrar-sesion", codigo: "211", fecha: "2026-10-06", eventoId: "ev1" });
    expect(res.statusCode).toBe(200);
    expect(llamadasErp[0].cuerpo).toEqual({ codigo: "211", fecha: "2026-10-06", eventoId: "ev1" });
  });

  it("no deja gastar el paquete de otra persona ni de otro dia", async () => {
    for (const intento of [
      { codigo: "999", fecha: "2026-10-06", eventoId: "ev1" },
      { codigo: "211", fecha: "2026-10-07", eventoId: "ev1" },
      { codigo: "211", fecha: "2026-10-06", eventoId: "no-existe" },
      { codigo: "211", fecha: "2026-10-06", eventoId: "ajeno" },
      { codigo: "211", fecha: "2026-10-06" },
    ]) {
      const res = await llamar(handler, { accion: "registrar-sesion", ...intento });
      expect(res.statusCode, JSON.stringify(intento)).toBe(400);
    }
    expect(llamadasErp).toHaveLength(0);
  });

  it("el espejo solo se manda de la agenda del equipo y sin codigos vacios", async () => {
    const malo = await llamar(handlerSync, { workspaceId: "mia", desde: "2026-10-01", hasta: "2026-10-31", eventos: [] });
    expect(malo.statusCode).toBe(403);

    const bueno = await llamar(handlerSync, {
      workspaceId: "GEMB",
      desde: "2026-10-01",
      hasta: "2026-10-31",
      eventos: [
        { id: "a", kind: "coach", clientCode: 211, date: "2026-10-06" },
        { id: "b", kind: "coach", clientCode: "", date: "2026-10-06" },
        { id: "c", kind: "normal", clientCode: 5, date: "2026-10-06" },
      ],
    });
    expect(bueno.statusCode).toBe(200);
    expect(llamadasErp[0].cuerpo.eventos.map((e) => e.id)).toEqual(["a"]);
  });
});
