import { describe, expect, it } from "vitest";
import { createEvent, createCoachSession, getEvent, listEvents, updateEvent, MAX_DESCRIPCION } from "../_lib/agenda.js";
import { decodeValue, encodeFields } from "../_lib/firestore.js";

// Firestore falso en memoria. Cada escritura pasa por el mismo codificar/decodificar
// que usa el REST real, para que lo guardado tenga la forma que tendria en la nube.
function fsFalso() {
  const docs = new Map([["workspaces/GEMB", { ownerId: "u1", kind: "shared", name: "GEMB" }]]);
  const ida = (data) => Object.fromEntries(Object.entries(encodeFields(data)).map(([k, v]) => [k, decodeValue(v)]));
  let n = 0;
  return {
    docs,
    async runQuery(q) {
      if (q.from[0].collectionId === "members") {
        return [{ name: "projects/p/databases/(default)/documents/workspaces/GEMB/members/u1", id: "u1", data: { uid: "u1", role: "owner" } }];
      }
      const ws = q.where.fieldFilter.value.stringValue;
      return [...docs]
        .filter(([ruta, d]) => ruta.startsWith("events/") && d.workspaceId === ws)
        .map(([ruta, d]) => ({ id: ruta.split("/")[1], data: d }));
    },
    async getDoc(ruta) {
      return docs.has(ruta) ? { id: ruta.split("/")[1], data: docs.get(ruta) } : null;
    },
    async createDoc(coleccion, data, id = `ev${++n}`) {
      docs.set(`${coleccion}/${id}`, ida(data));
      return { id, data: docs.get(`${coleccion}/${id}`) };
    },
    async patchDoc(ruta, data) {
      docs.set(ruta, { ...docs.get(ruta), ...ida(data) });
    },
  };
}

const crear = (fs, extra = {}) => createEvent(fs, "u1", { title: "Cumbre", date: "2026-10-31", startTime: "09:00", workspace: "GEMB", ...extra }, "Sebas");

describe("descripcion del evento desde el conector", () => {
  it("se guarda al crear (sin espacios sobrantes) y get_event la devuelve completa", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { description: "  Calle 10 # 5-20\nMapa: https://maps.app.goo.gl/abc  " });
    expect(fs.docs.get(`events/${ev.id}`).description).toBe("Calle 10 # 5-20\nMapa: https://maps.app.goo.gl/abc");
    expect((await getEvent(fs, "u1", ev.id)).description).toBe("Calle 10 # 5-20\nMapa: https://maps.app.goo.gl/abc");
  });

  it("sin descripcion queda vacia, igual que en la app", async () => {
    const fs = fsFalso();
    const ev = await crear(fs);
    expect(fs.docs.get(`events/${ev.id}`).description).toBe("");
  });

  it("si pasa de 5000 caracteres avisa en vez de cortar en silencio", async () => {
    const fs = fsFalso();
    await expect(crear(fs, { description: "x".repeat(MAX_DESCRIPCION + 1) })).rejects.toThrow(/máximo es 5000/);
    expect([...fs.docs.keys()].filter((k) => k.startsWith("events/"))).toHaveLength(0);
  });

  it("addToDescription agrega al final sin borrar lo que habia", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { description: "Dirección: Calle 10" });
    const nuevo = await updateEvent(fs, "u1", ev.id, { addToDescription: "Entrada: https://boletas.example.com/x" });
    expect(nuevo.description).toBe("Dirección: Calle 10\n\nEntrada: https://boletas.example.com/x");
  });

  it("addToDescription en un evento sin texto lo deja solo a el", async () => {
    const fs = fsFalso();
    const ev = await crear(fs);
    expect((await updateEvent(fs, "u1", ev.id, { addToDescription: "Llevar cuaderno" })).description).toBe("Llevar cuaderno");
  });

  it("description reemplaza todo, y vacia lo borra", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { description: "viejo" });
    expect((await updateEvent(fs, "u1", ev.id, { description: "nuevo" })).description).toBe("nuevo");
    expect((await updateEvent(fs, "u1", ev.id, { description: "" })).description).toBe("");
  });

  it("agregar no puede pasar el maximo", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { description: "a".repeat(MAX_DESCRIPCION - 5) });
    await expect(updateEvent(fs, "u1", ev.id, { addToDescription: "mas texto" })).rejects.toThrow(/máximo es 5000/);
    expect(fs.docs.get(`events/${ev.id}`).description).toHaveLength(MAX_DESCRIPCION - 5);
  });

  it("editar otra cosa no toca la descripcion", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { description: "se queda" });
    expect((await updateEvent(fs, "u1", ev.id, { title: "Cumbre 2026" })).description).toBe("se queda");
  });

  it("list_events la trae recortada y avisa que get_event la tiene completa", async () => {
    const fs = fsFalso();
    const larga = "Indicaciones. ".repeat(60);
    await crear(fs, { description: larga });
    const { events } = await listEvents(fs, "u1", { workspace: "GEMB" });
    expect(events[0].description.length).toBeLessThan(larga.length);
    expect(events[0].description).toMatch(/completa con get_event\)$/);
    expect((await getEvent(fs, "u1", events[0].id)).description).toBe(larga.trim());
  });
});

describe("enlace del evento desde el conector", () => {
  it("un enlace https queda como enlace propio del evento", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { meetingUrl: "https://meet.google.com/abc-defg-hij/" });
    expect(ev.meetingLinkType).toBe("custom");
    expect(ev.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("si llega sin https:// se le pone, como en la app", async () => {
    const fs = fsFalso();
    expect((await crear(fs, { meetingUrl: "www.cumbre.com/entradas" })).meetingUrl).toBe("https://www.cumbre.com/entradas");
  });

  it("rechaza http, javascript: y texto que no es enlace, sin crear nada", async () => {
    const fs = fsFalso();
    await expect(crear(fs, { meetingUrl: "http://inseguro.com" })).rejects.toThrow(/https/);
    await expect(crear(fs, { meetingUrl: "javascript:alert(1)" })).rejects.toThrow(/https/);
    await expect(crear(fs, { meetingUrl: "no es un enlace" })).rejects.toThrow(/https/);
    expect([...fs.docs.keys()].filter((k) => k.startsWith("events/"))).toHaveLength(0);
  });

  it("al editar se cambia, y vacio lo quita", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { meetingUrl: "https://uno.com" });
    expect((await updateEvent(fs, "u1", ev.id, { meetingUrl: "https://dos.com" })).meetingUrl).toBe("https://dos.com");
    const sin = await updateEvent(fs, "u1", ev.id, { meetingUrl: "" });
    expect(sin.meetingLinkType).toBe("none");
    expect(sin.meetingUrl).toBe("");
  });

  it("la sala fija de reduccion del ego manda sobre un enlace escrito", async () => {
    const fs = fsFalso();
    const ev = await crear(fs, { title: "Sala de reducción del ego", modality: "virtual", meetingUrl: "https://otro.com" });
    expect(ev.meetingLinkType).toBe("ego_room");
    expect(ev.meetingUrl).toBe("https://meet.google.com/pgk-svvh-brp");
  });

  it("una sesion coach no acepta otro enlace", async () => {
    const fs = fsFalso();
    await fs.createDoc("events", { workspaceId: "GEMB", recordType: "client", clientCode: 7, clientName: "Ana" }, "client_GEMB_7");
    const sesion = await createCoachSession(fs, "u1", { clientCode: 7, date: "2026-10-31", workspace: "GEMB" }, "Sebas");
    await expect(updateEvent(fs, "u1", sesion.id, { meetingUrl: "https://otro.com" })).rejects.toThrow(/coach/);
  });
});
