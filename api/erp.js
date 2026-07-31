// Función de servidor (Vercel): único puente entre la agenda y el ERP contable.
//
// Hace tres cosas según "accion", y NO se parte en varias funciones a
// propósito: el plan de Vercel permite 12 funciones serverless y ya están
// todas usadas. Separarlas tumbaría el despliegue entero.
//
//   (sin accion)        estado real de unas personas (deuda y sesiones coach)
//   "consultar-eventos" cuáles eventos ya están en el ERP (para pintar el botón)
//   "registrar-sesion"  pasa UNA sesión coach a la contabilidad
//
// Solo la última escribe, y escribe poco: el ERP únicamente descuenta de un
// paquete YA comprado. Si la persona no tiene cupo contesta que no y no toca
// nada; vender el paquete se sigue decidiendo en el ERP.
//
// El secreto (ERP_SHARED_SECRET) vive SOLO en el servidor, nunca en el
// navegador. Y antes de consultar o escribir se verifica que quien pregunta
// tenga sesión válida en la agenda, igual que hace el asistente.

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web publica

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://mentes-brillantes-erp.vercel.app";
const RUTA_PERSONAS = "/api/integraciones/agenda/personas";
const RUTA_SESION = "/api/integraciones/agenda/registrar-sesion";
const MAX_CODIGOS = 50;
const MAX_EVENTOS = 200;

async function verifyUser(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.users && data.users[0] ? data.users[0] : null;
  } catch {
    return null;
  }
}

function parseBody(body) {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

/** Normaliza a una lista de códigos numéricos únicos y acotada. */
function normalizarCodigos(valor) {
  const bruto = Array.isArray(valor) ? valor : String(valor || "").split(",");
  const limpios = bruto
    .map((c) => String(c).trim())
    .filter((c) => /^\d{1,10}$/.test(c));
  return Array.from(new Set(limpios)).slice(0, MAX_CODIGOS);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const secreto = process.env.ERP_SHARED_SECRET;
  if (!secreto) {
    res.status(503).json({ error: "La conexión con el ERP no está configurada." });
    return;
  }

  const body = parseBody(req.body);
  const user = await verifyUser(body.idToken);
  if (!user) {
    res.status(401).json({ error: "Tu sesión no es válida. Cierra y vuelve a iniciar sesión." });
    return;
  }

  const accion = String(body.accion || "").trim();

  try {
    if (accion === "consultar-eventos") {
      // Cada evento viaja con su persona y su fecha, no solo con el id: es lo
      // que le permite al ERP reconocer las sesiones que se registraron alla
      // directamente, que no tienen enlace con el evento de la agenda.
      const eventos = (Array.isArray(body.eventos) ? body.eventos : [])
        .map((e) => {
          if (typeof e === "string") return { id: e.trim(), codigo: null, fecha: null };
          return {
            id: String(e?.id ?? "").trim(),
            codigo: /^\d{1,10}$/.test(String(e?.codigo ?? "")) ? String(e.codigo) : null,
            fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.fecha ?? "")) ? String(e.fecha) : null
          };
        })
        .filter((e) => e.id)
        .slice(0, MAX_EVENTOS);

      if (!eventos.length) {
        res.status(200).json({ registrados: [] });
        return;
      }

      const r = await fetch(`${ERP_BASE_URL}${RUTA_SESION}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agenda-secret": secreto },
        body: JSON.stringify({ eventos })
      });
      if (!r.ok) {
        console.error("[erp] consultar-eventos no OK", r.status);
        res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
        return;
      }
      res.status(200).json(await r.json());
      return;
    }

    if (accion === "registrar-sesion") {
      const codigo = String(body.codigo ?? "").trim();
      const fecha = String(body.fecha ?? "").trim();
      const eventoId = String(body.eventoId ?? "").trim();

      if (!/^\d{1,10}$/.test(codigo) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        res.status(400).json({ error: "Faltan el código de la persona o la fecha de la sesión." });
        return;
      }

      const r = await fetch(`${ERP_BASE_URL}${RUTA_SESION}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agenda-secret": secreto },
        body: JSON.stringify({ codigo, fecha, eventoId })
      });

      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[erp] registrar-sesion no OK", r.status, datos?.error);
        res.status(502).json({ error: datos?.mensaje || "No se pudo pasar la sesión al ERP en este momento." });
        return;
      }
      res.status(200).json(datos);
      return;
    }

    // Por defecto: estado financiero de unas personas.
    const codigos = normalizarCodigos(body.codigos ?? body.codigo);
    if (!codigos.length) {
      res.status(400).json({ error: "Indica al menos un código de persona." });
      return;
    }

    const url = `${ERP_BASE_URL}${RUTA_PERSONAS}?codigos=${encodeURIComponent(codigos.join(","))}`;
    const r = await fetch(url, { headers: { "x-agenda-secret": secreto } });

    if (!r.ok) {
      // No se filtra el detalle del ERP al navegador; queda en el log.
      console.error("[erp] respuesta no OK", r.status);
      res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
      return;
    }

    res.status(200).json(await r.json());
  } catch (error) {
    console.error("[erp] fallo de red", error?.message);
    res.status(502).json({ error: "No se pudo conectar con el ERP en este momento." });
  }
}
