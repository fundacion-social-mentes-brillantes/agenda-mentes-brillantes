// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../../types/event";

const sub: { ok?: (e: CalendarEvent[]) => void; ko?: (e: unknown) => void; ids?: string[] } = {};
vi.mock("../../services/eventsService", () => ({
  eventsService: {
    subscribeToEventsMulti: vi.fn((ids: string[], ok: (e: CalendarEvent[]) => void, ko: (e: unknown) => void) => {
      sub.ids = ids;
      sub.ok = ok;
      sub.ko = ko;
      return () => {};
    })
  }
}));

const { useEvents } = await import("../useEvents");
const ev = (id: string) => ({ id, title: id }) as CalendarEvent;

beforeEach(() => {
  sub.ok = undefined;
  sub.ids = undefined;
});

describe("useEvents", () => {
  it("sin agendas: lista vacia y sin cargar", () => {
    const { result } = renderHook(() => useEvents([]));
    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("carga, recibe y no re-suscribe si el arreglo trae lo mismo en otro orden", () => {
    const { result, rerender } = renderHook(({ ids }) => useEvents(ids), { initialProps: { ids: ["b", "a"] } });
    expect(result.current.loading).toBe(true);
    expect(sub.ids).toEqual(["a", "b"]);
    act(() => sub.ok?.([ev("1")]));
    expect(result.current.loading).toBe(false);
    expect(result.current.events.map((e) => e.id)).toEqual(["1"]);
    const okAnterior = sub.ok;
    rerender({ ids: ["a", "b"] });
    expect(sub.ok).toBe(okAnterior);
  });

  it("al cambiar de agendas sigue mostrando lo anterior mientras carga lo nuevo", () => {
    const { result, rerender } = renderHook(({ ids }) => useEvents(ids), { initialProps: { ids: ["a"] } });
    act(() => sub.ok?.([ev("1")]));
    rerender({ ids: ["a", "c"] });
    expect(result.current.loading).toBe(true);
    expect(result.current.events.map((e) => e.id)).toEqual(["1"]);
    act(() => sub.ok?.([ev("1"), ev("2")]));
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toHaveLength(2);
  });

  it("un error se informa con su mensaje", () => {
    const { result } = renderHook(() => useEvents(["a"]));
    act(() => sub.ko?.(new Error("permiso denegado")));
    expect(result.current.error).toBe("permiso denegado");
    expect(result.current.loading).toBe(false);
  });
});
