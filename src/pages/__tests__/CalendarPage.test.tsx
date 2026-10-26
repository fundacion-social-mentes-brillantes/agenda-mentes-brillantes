// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ apariencia: "oscuro", base: "violeta" }) }));
vi.mock("../../hooks/useEventosEnErp", () => ({ useEventosEnErp: () => ({ registrados: new Set<string>() }) }));
vi.mock("../../lib/capturaDia", () => ({ crearImagenDelDia: vi.fn(), nombreDeCaptura: () => "captura.png" }));

const { default: CalendarPage } = await import("../CalendarPage");

const mismoDia = (fecha: Date, anio: number, mes: number, dia: number) =>
  fecha.getFullYear() === anio && fecha.getMonth() === mes && fecha.getDate() === dia;

function pintar() {
  const props = {
    events: [],
    setActivePage: vi.fn(),
    setEditingEvent: vi.fn(),
    setSelectedDate: vi.fn(),
    onCambiarDia: vi.fn(),
    onDuplicate: vi.fn(),
    onUpdateEvent: vi.fn(),
    onDeleteEvent: vi.fn()
  };
  render(<CalendarPage {...props} />);
  return props;
}

beforeEach(() => {
  // Lunes 26 de octubre de 2026, como en el video de la hermana de Sebastián.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 26, 8, 56));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("crear una cita el día elegido en el calendario", () => {
  it("al abrir, el día elegido es hoy", () => {
    const { onCambiarDia } = pintar();
    expect(mismoDia(onCambiarDia.mock.lastCall![0], 2026, 9, 26)).toBe(true);
  });

  it("al tocar el 28 avisa ese día, para que el botón «Nuevo» de abajo cree la cita el 28", () => {
    const { onCambiarDia } = pintar();
    fireEvent.click(screen.getByRole("button", { name: /28 de octubre/ }));
    expect(mismoDia(onCambiarDia.mock.lastCall![0], 2026, 9, 28)).toBe(true);
  });

  it("el «+» junto al día abre el formulario con el 28, no con hoy", () => {
    const { setSelectedDate, setActivePage } = pintar();
    fireEvent.click(screen.getByRole("button", { name: /28 de octubre/ }));
    fireEvent.click(screen.getByLabelText("Crear evento este día"));
    expect(mismoDia(setSelectedDate.mock.lastCall![0], 2026, 9, 28)).toBe(true);
    expect(setActivePage).toHaveBeenCalledWith("event-form");
  });
});
