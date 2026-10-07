// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../../types/event";

const consultarEstadoErp = vi.fn();
const consultarEventosEnErp = vi.fn();
vi.mock("../../services/erpService", () => ({
  consultarEstadoErp: (...a: unknown[]) => consultarEstadoErp(...a),
  consultarEventosEnErp: (...a: unknown[]) => consultarEventosEnErp(...a),
  aFechaIso: (d: Date) => d.toISOString().slice(0, 10)
}));

const { useEstadoErp } = await import("../useEstadoErp");
const { useEventosEnErp } = await import("../useEventosEnErp");

beforeEach(() => {
  consultarEstadoErp.mockReset();
  consultarEventosEnErp.mockReset();
});

describe("useEstadoErp", () => {
  it("sin codigos no consulta nada", () => {
    const { result } = renderHook(() => useEstadoErp([]));
    expect(result.current.cargando).toBe(false);
    expect(consultarEstadoErp).not.toHaveBeenCalled();
  });

  it("consulta, entrega y avisa si el ERP no responde", async () => {
    consultarEstadoErp.mockResolvedValueOnce(new Map([[5, { codigo: "5" }]]));
    const { result, rerender } = renderHook(({ c }) => useEstadoErp(c), { initialProps: { c: [5, 5] } });
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.estados.has(5)).toBe(true);
    expect(consultarEstadoErp).toHaveBeenCalledWith([5]);

    consultarEstadoErp.mockResolvedValueOnce(null);
    rerender({ c: [9] });
    await waitFor(() => expect(result.current.erpCaido).toBe(true));
  });

  it("recargar vuelve a preguntar", async () => {
    consultarEstadoErp.mockResolvedValue(new Map());
    const { result } = renderHook(() => useEstadoErp([5]));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.recargar());
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(consultarEstadoErp).toHaveBeenCalledTimes(2));
  });
});

describe("useEventosEnErp", () => {
  const coach = (id: string, codigo: number) =>
    ({ id, kind: "coach", clientCode: codigo, startAt: new Date("2026-10-06T15:00:00Z") }) as unknown as CalendarEvent;

  it("pregunta solo por sesiones coach y entrega las registradas", async () => {
    consultarEventosEnErp.mockResolvedValue(new Set(["e1"]));
    const normal = { id: "n1", kind: "normal", startAt: new Date() } as unknown as CalendarEvent;
    const { result } = renderHook(() => useEventosEnErp([coach("e1", 211), normal]));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(consultarEventosEnErp).toHaveBeenCalledWith([{ id: "e1", codigo: 211, fecha: "2026-10-06" }]);
    expect(result.current.registrados.has("e1")).toBe(true);
  });

  it("si el ERP falla, todo queda gris pero no se queda cargando", async () => {
    consultarEventosEnErp.mockRejectedValue(new Error("caido"));
    const { result } = renderHook(() => useEventosEnErp([coach("e1", 211)]));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.registrados.size).toBe(0);
  });
});
