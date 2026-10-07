// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { WorkspaceWithRole } from "../../types/workspace";

// Firebase simulado: se guarda el callback de la suscripcion para "enviar" listas.
const suscripcion: { alLlegar?: (lista: WorkspaceWithRole[]) => void; alFallar?: (e: unknown) => void; bajas: number } = {
  bajas: 0
};
vi.mock("../../services/workspaceService", () => ({
  personalWorkspaceId: (uid: string) => `personal_${uid}`,
  workspaceService: {
    ensurePersonalWorkspace: vi.fn(async (u: { uid: string }) => ({ id: `personal_${u.uid}` })),
    subscribeToMyWorkspaces: vi.fn((_uid: string, ok: (l: WorkspaceWithRole[]) => void, ko: (e: unknown) => void) => {
      suscripcion.alLlegar = ok;
      suscripcion.alFallar = ko;
      return () => {
        suscripcion.bajas += 1;
      };
    })
  }
}));
vi.mock("../../services/eventsService", () => ({
  eventsService: { migrateLegacyEvents: vi.fn(async () => 0) }
}));

const { useWorkspaces } = await import("../useWorkspaces");

const usuario = (uid: string) => ({ uid }) as unknown as User;
const agenda = (id: string, kind: "personal" | "shared" = "shared"): WorkspaceWithRole =>
  ({ id, name: id, ownerId: "x", kind, myRole: "owner", createdAt: new Date(0), updatedAt: new Date(0) }) as WorkspaceWithRole;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("migrated_u1", "1");
  localStorage.setItem("migrated_u2", "1");
  suscripcion.alLlegar = undefined;
  suscripcion.bajas = 0;
});

describe("useWorkspaces", () => {
  it("sin sesion no hay agendas ni carga", () => {
    const { result } = renderHook(() => useWorkspaces(null));
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.activeWorkspaceId).toBeNull();
  });

  it("primera vez: espera al servidor y activa la agenda personal", () => {
    const { result } = renderHook(() => useWorkspaces(usuario("u1")));
    expect(result.current.loading).toBe(true);
    act(() => suscripcion.alLlegar?.([agenda("GEMB"), agenda("personal_u1", "personal")]));
    expect(result.current.loading).toBe(false);
    expect(result.current.workspaces.map((w) => w.id)).toEqual(["GEMB", "personal_u1"]);
    expect(result.current.activeWorkspaceId).toBe("personal_u1");
  });

  it("arranque rapido: muestra lo guardado la vez pasada sin esperar", () => {
    localStorage.setItem("workspacesCache_u1", JSON.stringify([agenda("GEMB"), agenda("personal_u1", "personal")]));
    localStorage.setItem("activeWorkspace_u1", "GEMB");
    const { result } = renderHook(() => useWorkspaces(usuario("u1")));
    expect(result.current.loading).toBe(false);
    expect(result.current.activeWorkspaceId).toBe("GEMB");
  });

  it("elegir otra agenda la activa y la recuerda", () => {
    const { result } = renderHook(() => useWorkspaces(usuario("u1")));
    act(() => suscripcion.alLlegar?.([agenda("GEMB"), agenda("personal_u1", "personal")]));
    act(() => result.current.setActiveWorkspaceId("GEMB"));
    expect(result.current.activeWorkspaceId).toBe("GEMB");
    expect(localStorage.getItem("activeWorkspace_u1")).toBe("GEMB");
  });

  it("si la agenda activa desaparece, vuelve a la personal", () => {
    const { result } = renderHook(() => useWorkspaces(usuario("u1")));
    act(() => suscripcion.alLlegar?.([agenda("GEMB"), agenda("personal_u1", "personal")]));
    act(() => result.current.setActiveWorkspaceId("GEMB"));
    act(() => suscripcion.alLlegar?.([agenda("personal_u1", "personal")]));
    expect(result.current.activeWorkspaceId).toBe("personal_u1");
  });

  it("al cambiar de cuenta nunca se ven las agendas de la anterior", () => {
    const { result, rerender } = renderHook(({ u }) => useWorkspaces(u), { initialProps: { u: usuario("u1") } });
    act(() => suscripcion.alLlegar?.([agenda("GEMB"), agenda("personal_u1", "personal")]));
    rerender({ u: usuario("u2") });
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(suscripcion.bajas).toBe(1);
  });

  it("un error del servidor se informa sin borrar lo que ya se veia", () => {
    const { result } = renderHook(() => useWorkspaces(usuario("u1")));
    act(() => suscripcion.alLlegar?.([agenda("personal_u1", "personal")]));
    act(() => suscripcion.alFallar?.(new Error("sin red")));
    expect(result.current.error).toBe("sin red");
    expect(result.current.workspaces.map((w) => w.id)).toEqual(["personal_u1"]);
  });
});
