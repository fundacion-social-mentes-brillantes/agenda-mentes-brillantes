// Pruebas de las reglas de seguridad de Firestore contra el EMULADOR oficial
// (nunca contra la base real). Se corren con: npm run test:reglas
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-agenda-reglas",
    firestore: { rules: readFileSync("firestore.rules", "utf8") }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

// Escenario: la agenda del equipo "GEMB" (duena: sebas), con ana de editora.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "workspaces/GEMB"), { ownerId: "sebas", kind: "shared", name: "GEMB", joinEnabled: true, joinCode: "CODIGO-SECRETO" });
    await setDoc(doc(db, "workspaces/GEMB/members/sebas"), { uid: "sebas", role: "owner" });
    await setDoc(doc(db, "workspaces/GEMB/members/ana"), { uid: "ana", role: "editor", joinCode: "CODIGO-SECRETO" });
    await setDoc(doc(db, "events/ev1"), { workspaceId: "GEMB", createdBy: "sebas", title: "Sesion", kind: "coach", clientCode: 211 });
    await setDoc(doc(db, "users/ana"), { uid: "ana", displayName: "Ana" });
  });
});

const como = (uid: string) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe("eventos", () => {
  it("un miembro los ve; alguien de afuera o sin sesion no", async () => {
    await assertSucceeds(getDoc(doc(como("ana"), "events/ev1")));
    await assertFails(getDoc(doc(como("intruso"), "events/ev1")));
    await assertFails(getDoc(doc(anonimo(), "events/ev1")));
  });

  it("un miembro crea eventos a su nombre, no a nombre de otro", async () => {
    await assertSucceeds(setDoc(doc(como("ana"), "events/nuevo"), { workspaceId: "GEMB", createdBy: "ana", title: "x" }));
    await assertFails(setDoc(doc(como("ana"), "events/falso"), { workspaceId: "GEMB", createdBy: "sebas", title: "x" }));
  });

  it("alguien de afuera no puede meter eventos en la agenda del equipo", async () => {
    await assertFails(setDoc(doc(como("intruso"), "events/x"), { workspaceId: "GEMB", createdBy: "intruso", title: "x" }));
  });

  it("un evento no se puede sacar de su agenda ni cambiar de autor", async () => {
    await assertSucceeds(updateDoc(doc(como("ana"), "events/ev1"), { title: "Sesion movida" }));
    await assertFails(updateDoc(doc(como("ana"), "events/ev1"), { workspaceId: "otra" }));
    await assertFails(updateDoc(doc(como("ana"), "events/ev1"), { createdBy: "ana" }));
  });

  it("borrar es solo para miembros", async () => {
    await assertFails(deleteDoc(doc(como("intruso"), "events/ev1")));
    await assertSucceeds(deleteDoc(doc(como("ana"), "events/ev1")));
  });

  it("la lista solo trae lo de las agendas propias", async () => {
    await assertSucceeds(getDocs(query(collection(como("ana"), "events"), where("workspaceId", "==", "GEMB"))));
    await assertFails(getDocs(query(collection(como("intruso"), "events"), where("workspaceId", "==", "GEMB"))));
  });
});

describe("agendas y miembros", () => {
  it("el codigo de invitacion no lo puede leer quien no es miembro", async () => {
    await assertFails(getDoc(doc(como("intruso"), "workspaces/GEMB")));
    await assertSucceeds(getDoc(doc(como("ana"), "workspaces/GEMB")));
  });

  it("unirse exige el codigo correcto y entra como editor, nunca como dueno", async () => {
    await assertFails(setDoc(doc(como("pepe"), "workspaces/GEMB/members/pepe"), { uid: "pepe", role: "editor", joinCode: "otro" }));
    await assertFails(setDoc(doc(como("pepe"), "workspaces/GEMB/members/pepe"), { uid: "pepe", role: "owner", joinCode: "CODIGO-SECRETO" }));
    await assertSucceeds(setDoc(doc(como("pepe"), "workspaces/GEMB/members/pepe"), { uid: "pepe", role: "editor", joinCode: "CODIGO-SECRETO" }));
  });

  it("nadie puede meter a otra persona ni ascenderse a dueno", async () => {
    await assertFails(setDoc(doc(como("ana"), "workspaces/GEMB/members/pepe"), { uid: "pepe", role: "editor", joinCode: "CODIGO-SECRETO" }));
    await assertFails(updateDoc(doc(como("ana"), "workspaces/GEMB/members/ana"), { role: "owner" }));
  });

  it("solo el dueno cambia la agenda, y no puede regalarla a otro", async () => {
    await assertFails(updateDoc(doc(como("ana"), "workspaces/GEMB"), { name: "Mia" }));
    await assertSucceeds(updateDoc(doc(como("sebas"), "workspaces/GEMB"), { name: "GEMB familia" }));
    await assertFails(updateDoc(doc(como("sebas"), "workspaces/GEMB"), { ownerId: "ana" }));
  });

  it("crear una agenda solo a nombre propio", async () => {
    await assertSucceeds(setDoc(doc(como("pepe"), "workspaces/de-pepe"), { ownerId: "pepe", kind: "shared", name: "Pepe" }));
    await assertFails(setDoc(doc(como("pepe"), "workspaces/a-nombre-de-sebas"), { ownerId: "sebas", kind: "shared", name: "Falsa" }));
  });

  it("el dueno puede sacar a un miembro; un miembro no puede sacar a otro", async () => {
    await assertFails(deleteDoc(doc(como("ana"), "workspaces/GEMB/members/sebas")));
    await assertSucceeds(deleteDoc(doc(como("sebas"), "workspaces/GEMB/members/ana")));
  });
});

describe("perfiles", () => {
  it("cada quien ve y edita solo el suyo", async () => {
    await assertSucceeds(getDoc(doc(como("ana"), "users/ana")));
    await assertFails(getDoc(doc(como("pepe"), "users/ana")));
    await assertFails(setDoc(doc(como("pepe"), "users/ana"), { uid: "ana", displayName: "hackeado" }));
    await assertFails(deleteDoc(doc(como("ana"), "users/ana")));
  });
});
