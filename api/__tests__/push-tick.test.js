import { beforeEach, describe, expect, it, vi } from "vitest";
import { peticion, respuesta } from "./ayudas.js";

const handler = (await import("../push-tick.js")).default;

beforeEach(() => {
  process.env.PUSH_TICK_SECRET = "secreto-de-azure";
  globalThis.fetch = vi.fn(async () => {
    throw new Error("no deberia salir a la red");
  });
});

describe("tarea de avisos (push-tick)", () => {
  it("sin la clave compartida con Azure no hace nada", async () => {
    for (const cabeceras of [{}, { "x-push-secret": "otra" }, { "x-push-secret": "secreto-de-azure-x" }]) {
      const res = respuesta();
      await handler(peticion({ headers: cabeceras }), res);
      expect(res.statusCode).toBe(401);
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("solo acepta POST", async () => {
    const res = respuesta();
    await handler(peticion({ method: "GET", headers: { "x-push-secret": "secreto-de-azure" } }), res);
    expect(res.statusCode).toBe(405);
  });
});
