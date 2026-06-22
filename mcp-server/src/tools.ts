import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  listWorkspaces,
  updateEvent
} from "./agenda.js";

function ok(data: unknown, summary?: string) {
  const text = (summary ? summary + "\n\n" : "") + JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const modality = z.enum(["presencial", "virtual"]).optional();

export function createServer(): McpServer {
  const server = new McpServer({
    name: "agenda-mentes-brillantes",
    version: "1.0.0"
  });

  server.registerTool(
    "list_workspaces",
    {
      title: "Listar agendas",
      description: "Lista las agendas (personal y compartidas) disponibles, con su id, nombre y rol.",
      inputSchema: {}
    },
    async () => {
      try {
        return ok(await listWorkspaces(), "Agendas disponibles:");
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "list_events",
    {
      title: "Listar eventos",
      description:
        "Lista eventos de una agenda. Puedes filtrar por rango de fechas (from/to en formato YYYY-MM-DD), por texto y limitar la cantidad. Por defecto usa la agenda personal y omite los eventos marcados como hechos.",
      inputSchema: {
        workspace: z.string().optional().describe("Id o nombre de la agenda. Si se omite, usa la personal."),
        from: z.string().optional().describe("Fecha inicial YYYY-MM-DD."),
        to: z.string().optional().describe("Fecha final YYYY-MM-DD."),
        query: z.string().optional().describe("Texto a buscar en el título."),
        includeDone: z.boolean().optional().describe("Incluir eventos ya marcados como hechos."),
        limit: z.number().int().positive().optional().describe("Máximo de eventos a devolver.")
      }
    },
    async (args) => {
      try {
        const result = await listEvents(args);
        return ok(result, `Encontré ${result.events.length} evento(s).`);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "today_agenda",
    {
      title: "Agenda de hoy",
      description: "Devuelve los eventos de hoy de una agenda (zona horaria de Colombia).",
      inputSchema: {
        workspace: z.string().optional().describe("Id o nombre de la agenda. Si se omite, usa la personal.")
      }
    },
    async (args) => {
      try {
        const today = todayInBogota();
        const result = await listEvents({ workspace: args.workspace, from: today, to: today, includeDone: true });
        return ok(result, `Agenda de hoy (${today}): ${result.events.length} evento(s).`);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_event",
    {
      title: "Ver un evento",
      description: "Obtiene los detalles de un evento por su id.",
      inputSchema: { id: z.string().describe("Id del evento.") }
    },
    async (args) => {
      try {
        const event = await getEvent(args.id);
        if (!event) return fail(new Error(`No existe un evento con id ${args.id}.`));
        return ok(event);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "create_event",
    {
      title: "Crear evento",
      description:
        "Crea un evento en la agenda. Requiere título y fecha (YYYY-MM-DD). Las horas son HH:MM (24h, hora de Colombia). Si allDay es true, no necesita horas.",
      inputSchema: {
        title: z.string().describe("Título del evento."),
        date: z.string().describe("Fecha YYYY-MM-DD."),
        startTime: z.string().optional().describe("Hora de inicio HH:MM (por defecto 09:00)."),
        endTime: z.string().optional().describe("Hora final HH:MM (por defecto 10:00)."),
        allDay: z.boolean().optional().describe("Evento de todo el día."),
        modality,
        color: z.string().optional().describe("Color en hexadecimal, ej. #3b82f6."),
        reminderMinutes: z.number().int().optional().describe("Minutos de recordatorio antes (0, 10, 30, 60, 1440)."),
        totalAmount: z.number().optional().describe("Valor total en pesos (opcional)."),
        paidAmount: z.number().optional().describe("Valor abonado en pesos (opcional)."),
        workspace: z.string().optional().describe("Id o nombre de la agenda. Si se omite, usa la personal.")
      }
    },
    async (args) => {
      try {
        const event = await createEvent(args);
        return ok(event, `Evento creado: "${event.title}" (${event.when || event.startAt}).`);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "update_event",
    {
      title: "Editar evento",
      description: "Actualiza campos de un evento existente. Solo cambia lo que envíes. Usa done=true para marcarlo como hecho.",
      inputSchema: {
        id: z.string().describe("Id del evento a editar."),
        title: z.string().optional(),
        date: z.string().optional().describe("Nueva fecha YYYY-MM-DD."),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        allDay: z.boolean().optional(),
        modality,
        color: z.string().optional(),
        reminderMinutes: z.number().int().optional(),
        totalAmount: z.number().optional(),
        paidAmount: z.number().optional(),
        done: z.boolean().optional().describe("Marcar como hecho (true) o pendiente (false).")
      }
    },
    async (args) => {
      try {
        const { id, ...patch } = args;
        const event = await updateEvent(id, patch);
        return ok(event, `Evento actualizado: "${event.title}".`);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "delete_event",
    {
      title: "Eliminar evento",
      description: "Elimina un evento por su id. Esta acción no se puede deshacer.",
      inputSchema: { id: z.string().describe("Id del evento a eliminar.") }
    },
    async (args) => {
      try {
        await deleteEvent(args.id);
        return ok({ deleted: args.id }, "Evento eliminado.");
      } catch (e) {
        return fail(e);
      }
    }
  );

  return server;
}
