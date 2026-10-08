import { beforeEach, describe, expect, it, vi } from "vitest";
import { peticion, respuesta } from "./ayudas.js";

const DUENO_EQUIPO = "xGsf9WRF9dUIJfs885AZzXFhjhf1";
const estado = { usuario: { localId: "u1", displayName: "Sebastián" }, membresias: ["GEMB"] };

vi.mock("../_lib/firestore.js", async (original) => {
  const real = await original();
  class UserFirestoreFalso {
    async runQuery() {
      return estado.membresias.map((wsId) => ({ name: `x/documents/workspaces/${wsId}/members/u1` }));
    }
    async getDoc(ruta) {
      const id = ruta.split("/")[1];
      return id === "GEMB" ? { id, data: { ownerId: DUENO_EQUIPO } } : null;
    }
  }
  return { ...real, verifyIdToken: async (t) => (t ? estado.usuario : null), UserFirestore: UserFirestoreFalso };
});

// Claude falso: guarda lo que se le pidió y contesta lo que diga cada prueba.
const claude = { pedidos: [], responder: null };
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(status) {
      super(`error ${status}`);
      this.status = status;
    }
  }
  class Anthropic {
    constructor(opciones) {
      this.opciones = opciones;
      this.messages = {
        create: async (pedido) => {
          claude.pedidos.push(pedido);
          return claude.responder(pedido);
        }
      };
    }
  }
  Anthropic.APIError = APIError;
  return { default: Anthropic };
});

const modulo = await import("../assistant.js");
const handler = modulo.default;
const { aMensajesClaude, deClaude, leerFoto } = modulo;

const llamadasDeepSeek = [];
const FOTO = { tipo: "image/jpeg", data: "aGVsbG8=" };

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "llave-deepseek";
  process.env.ANTHROPIC_API_KEY = "llave-claude";
  estado.membresias = ["GEMB"];
  claude.pedidos.length = 0;
  claude.responder = () => ({
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5 },
    content: [{ type: "thinking", thinking: "", signature: "firma" }, { type: "text", text: "Listo, ya está." }]
  });
  llamadasDeepSeek.length = 0;
  globalThis.fetch = vi.fn(async (url, init) => {
    const direccion = String(url);
    if (direccion.includes("api.deepseek.com")) {
      llamadasDeepSeek.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Respuesta del básico" } }] }), { status: 200 });
    }
    if (direccion.endsWith(":runQuery")) return new Response(JSON.stringify([]), { status: 200 });
    return new Response(JSON.stringify({ name: "x/workspaces/GEMB", fields: { name: { stringValue: "Agenda GEMB" } } }), { status: 200 });
  });
});

async function llamar(body, headers = {}) {
  const res = respuesta();
  await handler(peticion({ body: { idToken: "token", workspaceId: "GEMB", ...body }, headers }), res);
  return res;
}

const PREGUNTA = [{ role: "user", content: "agenda reunión mañana a las 3" }];

describe("modo Experto (Claude Haiku 5.5)", () => {
  it("le pregunta a Claude con las herramientas, las reglas en caché y la foto", async () => {
    const res = await llamar({ model: "experto", messages: PREGUNTA, foto: FOTO });
    expect(res.statusCode).toBe(200);
    expect(res.cuerpo).toEqual({ message: { role: "assistant", content: "Listo, ya está." }, modo: "experto" });
    expect(llamadasDeepSeek).toHaveLength(0);

    const pedido = claude.pedidos[0];
    expect(pedido.model).toBe("claude-haiku-5-5");
    expect(pedido.thinking).toEqual({ type: "adaptive" });
    expect(pedido.output_config).toEqual({ effort: "high" });
    expect(pedido.tools.map((t) => t.name)).toContain("create_coach_session");
    expect(pedido.tools[0].input_schema.type).toBe("object");
    expect(pedido.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(pedido.system[0].text).toContain("FOTOS");
    // La fecha de hoy y los eventos van aparte, después de lo que se guarda en caché.
    expect(pedido.system[0].text).not.toContain("HOY es");
    expect(pedido.system[1].text).toContain("HOY es");
    expect(pedido.system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(pedido.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "aGVsbG8=" } },
          { type: "text", text: "agenda reunión mañana a las 3" }
        ]
      }
    ]);
  });

  it("las acciones que pide Claude llegan al navegador como siempre", async () => {
    claude.responder = () => ({
      stop_reason: "tool_use",
      content: [
        { type: "thinking", thinking: "", signature: "firma" },
        { type: "text", text: "Voy." },
        { type: "tool_use", id: "toolu_1", name: "create_event", input: { title: "Reunión", date: "2026-10-09" } },
        { type: "tool_use", id: "toolu_2", name: "borrar_todo", input: {} }
      ]
    });
    const res = await llamar({ model: "experto", messages: PREGUNTA });
    expect(res.cuerpo.message).toEqual({
      role: "assistant",
      content: "Voy.",
      tool_calls: [{ id: "toolu_1", type: "function", function: { name: "create_event", arguments: '{"title":"Reunión","date":"2026-10-09"}' } }]
    });
  });

  it("si Claude falla, contesta el Básico y avisa que no vio la foto", async () => {
    claude.responder = () => {
      throw new Error("caído");
    };
    const res = await llamar({ model: "experto", messages: PREGUNTA, foto: FOTO });
    expect(res.statusCode).toBe(200);
    expect(res.cuerpo).toEqual({ message: { role: "assistant", content: "Respuesta del básico" }, modo: "basico", respaldo: true });
    const ultimo = llamadasDeepSeek[0].messages.at(-1);
    expect(ultimo.content).toContain("mandó una foto");
    expect(llamadasDeepSeek[0].model).toBe("deepseek-v4-flash");
  });

  it("si los filtros de Claude dicen que no, NO se le pregunta a otro modelo", async () => {
    claude.responder = () => ({ stop_reason: "refusal", content: [] });
    const res = await llamar({ model: "experto", messages: PREGUNTA });
    expect(res.statusCode).toBe(200);
    expect(res.cuerpo.modo).toBe("experto");
    expect(llamadasDeepSeek).toHaveLength(0);
  });

  it("sin llave de Claude, el Experto responde con el Básico", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await llamar({ model: "experto", messages: PREGUNTA });
    expect(res.cuerpo.modo).toBe("basico");
    expect(claude.pedidos).toHaveLength(0);
  });

  it("una foto que no es imagen se rechaza", async () => {
    const res = await llamar({ model: "experto", messages: PREGUNTA, foto: { tipo: "text/html", data: "PGgxPg==" } });
    expect(res.statusCode).toBe(400);
    expect(claude.pedidos).toHaveLength(0);
  });

  it("quien no es del equipo no gasta créditos", async () => {
    estado.membresias = ["mia"];
    const res = await llamar({ model: "experto", messages: PREGUNTA });
    expect(res.statusCode).toBe(403);
    expect(claude.pedidos).toHaveLength(0);
  });
});

describe("modo Básico (DeepSeek), el de siempre", () => {
  it("no toca a Claude ni manda fotos", async () => {
    const res = await llamar({ model: "flash", messages: PREGUNTA, foto: FOTO });
    expect(res.cuerpo).toEqual({ message: { role: "assistant", content: "Respuesta del básico" }, modo: "basico" });
    expect(claude.pedidos).toHaveLength(0);
    expect(JSON.stringify(llamadasDeepSeek[0])).not.toContain("aGVsbG8=");
  });

  it("sin foto, el límite de tamaño sigue siendo el de antes", async () => {
    const res = await llamar({ model: "flash", messages: PREGUNTA }, { "content-length": "500000" });
    expect(res.statusCode).toBe(413);
  });
});

describe("traducción de la conversación para Claude", () => {
  const convo = [
    { role: "assistant", content: "respuesta vieja suelta" },
    { role: "user", content: "crea dos eventos" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "call_00:abc", type: "function", function: { name: "create_event", arguments: '{"title":"A"}' } },
        { id: "call_01", type: "function", function: { name: "create_event", arguments: "no es json" } }
      ]
    },
    { role: "tool", tool_call_id: "call_00:abc", content: "OK id=1" },
    { role: "tool", tool_call_id: "call_01", content: "OK id=2" }
  ];

  it("arranca por la persona y junta los resultados de una ronda en un solo mensaje", () => {
    const mensajes = aMensajesClaude(convo, FOTO);
    expect(mensajes.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(mensajes[1].content).toEqual([
      { type: "tool_use", id: "call_00_abc", name: "create_event", input: { title: "A" } },
      { type: "tool_use", id: "call_01", name: "create_event", input: {} }
    ]);
    expect(mensajes[2].content.map((b) => b.tool_use_id)).toEqual(["call_00_abc", "call_01"]);
    // La foto va en la pregunta, no en los resultados.
    expect(mensajes[0].content[0].type).toBe("image");
    expect(mensajes[2].content.every((b) => b.type === "tool_result")).toBe(true);
  });

  it("resultados sueltos al principio (su pedido quedó fuera) se descartan", () => {
    const mensajes = aMensajesClaude([{ role: "tool", tool_call_id: "x", content: "OK" }, { role: "user", content: "hola" }]);
    expect(mensajes).toEqual([{ role: "user", content: [{ type: "text", text: "hola" }] }]);
  });

  it("el razonamiento interno no vuelve al navegador", () => {
    expect(deClaude({ content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "Hola" }] })).toEqual({
      role: "assistant",
      content: "Hola"
    });
  });

  it("la foto se limpia y se valida", () => {
    expect(leerFoto({ tipo: "image/png", data: "data:image/png;base64,aGVsbG8=" })).toEqual({ tipo: "image/png", data: "aGVsbG8=" });
    expect(leerFoto({ tipo: "image/png", data: "<script>" })).toBeNull();
    expect(leerFoto({ tipo: "image/png", data: "a".repeat(4_000_001) })).toBeNull();
    expect(leerFoto(null)).toBeNull();
  });

  it("guardar la foto en un evento es una acción permitida (y una inventada no)", () => {
    const m = deClaude({
      content: [
        { type: "text", text: "Listo." },
        { type: "tool_use", id: "t1", name: "attach_photo", input: { id: "ev1", name: "Invitación" } },
        { type: "tool_use", id: "t2", name: "borrar_todo", input: {} }
      ]
    });
    expect(m.tool_calls).toEqual([{ id: "t1", type: "function", function: { name: "attach_photo", arguments: JSON.stringify({ id: "ev1", name: "Invitación" }) } }]);
  });

  it("crear imágenes: pide sesión, descripción y la llave de Azure", async () => {
    const pedirImagen = async (body) => {
      const r = respuesta();
      await handler(peticion({ body: { accion: "imagen", ...body } }), r);
      return r;
    };
    expect((await pedirImagen({ prompt: "a warm invitation card" })).statusCode).toBe(401);
    expect((await pedirImagen({ idToken: "t", prompt: "x" })).statusCode).toBe(400);
    const sinLlave = await pedirImagen({ idToken: "t", prompt: "a warm invitation card" });
    expect(sinLlave.statusCode).toBe(503);
    expect(sinLlave.cuerpo.error).toMatch(/no está configurado/);
    expect(deClaude({ content: [{ type: "tool_use", id: "i1", name: "create_image", input: { prompt: "p" } }] }).tool_calls[0].function.name).toBe("create_image");
  });
});
