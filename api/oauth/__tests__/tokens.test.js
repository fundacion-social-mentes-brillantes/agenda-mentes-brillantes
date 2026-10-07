import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

let t;
beforeAll(async () => {
  process.env.OAUTH_SECRET = "secreto-de-prueba-muy-largo-para-firmar";
  t = await import("../_tokens.js");
});

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const VERIFIER = "a".repeat(43) + "-bcd_efg.hij~klm";
const CHALLENGE = b64url(createHash("sha256").update(VERIFIER).digest());

describe("direcciones de retorno", () => {
  it("solo Claude, ChatGPT o el propio computador", () => {
    expect(t.redirectUriPermitido("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(t.redirectUriPermitido("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(t.redirectUriPermitido("http://localhost:3118/callback")).toBe(true);
    expect(t.redirectUriPermitido("https://malo-claude.ai/robar")).toBe(false);
    expect(t.redirectUriPermitido("https://claude.ai.sitio-malo.com/x")).toBe(false);
    expect(t.redirectUriPermitido("http://claude.ai/api/mcp/auth_callback")).toBe(false);
    expect(t.redirectUriPermitido("javascript:alert(1)")).toBe(false);
  });
});

describe("PKCE", () => {
  it("es obligatorio y se compara exacto", () => {
    expect(t.verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
    expect(t.verifyPkce(VERIFIER, "")).toBe(false);
    expect(t.verifyPkce("", CHALLENGE)).toBe(false);
    expect(t.verifyPkce(VERIFIER + "x", CHALLENGE)).toBe(false);
    expect(t.verifyPkce("corto", CHALLENGE)).toBe(false);
  });
});

describe("firmas y codigos", () => {
  it("un token alterado o de otro tipo no se acepta", () => {
    const code = t.mintCode({ uid: "u1", name: "Ana", firebaseRefresh: "rt", codeChallenge: CHALLENGE, clientId: "c", redirectUri: "r" });
    expect(t.readCode(code)?.uid).toBe("u1");
    const [cab, , firma] = code.slice(5).split(".");
    const cuerpoFalso = b64url(Buffer.from(JSON.stringify({ typ: "code", uid: "intruso" })));
    expect(t.readCode(`mcpa_${cab}.${cuerpoFalso}.${firma}`)).toBeNull();
    // Un codigo no sirve como access token.
    expect(t.readAccessToken("mcp_" + code.slice(5))).toBeNull();
  });

  it("el refresh de Firebase viaja cifrado y se recupera igual", () => {
    const access = t.mintAccessToken({ uid: "u1", name: "Ana", firebaseRefresh: "refresh-secreto" });
    expect(access).not.toContain("refresh-secreto");
    expect(t.readAccessToken(access)).toEqual({ uid: "u1", name: "Ana", firebaseRefreshToken: "refresh-secreto" });
  });
});
