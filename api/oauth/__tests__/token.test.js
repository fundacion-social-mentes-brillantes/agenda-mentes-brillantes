import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { peticion, respuesta } from "../../__tests__/ayudas.js";

let tokens, handler;
beforeAll(async () => {
  process.env.OAUTH_SECRET = "secreto-de-prueba-muy-largo-para-firmar";
  tokens = await import("../_tokens.js");
  handler = (await import("../token.js")).default;
});

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const VERIFIER = "v".repeat(50);
const CHALLENGE = b64url(createHash("sha256").update(VERIFIER).digest());
const RETORNO = "https://claude.ai/api/mcp/auth_callback";

function codigo(extra = {}) {
  return tokens.mintCode({
    uid: "u1", name: "Ana", firebaseRefresh: "rt", codeChallenge: CHALLENGE, clientId: "mcpc_cliente", redirectUri: RETORNO, ...extra,
  });
}

async function canjear(body) {
  const res = respuesta();
  await handler(peticion({ body: { grant_type: "authorization_code", ...body } }), res);
  return res;
}

describe("canje del codigo OAuth", () => {
  it("con todo en orden entrega tokens", async () => {
    const res = await canjear({ code: codigo(), code_verifier: VERIFIER, redirect_uri: RETORNO, client_id: "mcpc_cliente" });
    expect(res.statusCode).toBe(200);
    expect(res.cuerpo.access_token).toMatch(/^mcp_/);
  });

  it("sin el verificador PKCE no se canjea", async () => {
    const res = await canjear({ code: codigo(), redirect_uri: RETORNO });
    expect(res.statusCode).toBe(400);
  });

  it("un codigo pedido sin PKCE no se puede canjear", async () => {
    const res = await canjear({ code: codigo({ codeChallenge: "" }), code_verifier: VERIFIER, redirect_uri: RETORNO });
    expect(res.statusCode).toBe(400);
  });

  it("sin la misma direccion de retorno no se canjea (antes bastaba con omitirla)", async () => {
    expect((await canjear({ code: codigo(), code_verifier: VERIFIER })).statusCode).toBe(400);
    expect((await canjear({ code: codigo(), code_verifier: VERIFIER, redirect_uri: "http://localhost/x" })).statusCode).toBe(400);
  });

  it("con otro cliente no se canjea", async () => {
    const res = await canjear({ code: codigo(), code_verifier: VERIFIER, redirect_uri: RETORNO, client_id: "mcpc_otro" });
    expect(res.statusCode).toBe(400);
  });
});
