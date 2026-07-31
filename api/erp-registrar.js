// Función de servidor (Vercel): pasa UNA sesión coach de la agenda al ERP.
//
// Es la única puerta por la que la agenda escribe en la contabilidad, y es
// angosta a propósito: el ERP solo descuenta de un paquete ya comprado. Si la
// persona no tiene cupo, contesta que no y no escribe nada. Vender el paquete
// sigue siendo una decisión que se toma en el ERP.
//
// El secreto (ERP_SHARED_SECRET) vive SOLO aquí, nunca en el navegador, y antes
// de escribir se verifica que quien oprime el botón tenga sesión válida.

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web publica

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://mentes-brillantes-erp.vercel.app";
const RUTA = "/api/integraciones/agenda/registrar-sesion";
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

  // Modo consulta: cuáles de estos eventos ya están en el ERP (para el botón).
  if (body.consultar) {
    const eventos = (Array.isArray(body.eventos) ? body.eventos : [])
      .map((e) => String(e || "").trim())
      .filter(Boolean)
      .slice(0, MAX_EVENTOS);

    if (!eventos.length) {
      res.status(200).json({ registrados: [] });
      return;
    }

    try {
      const url = `${ERP_BASE_URL}${RUTA}?eventos=${encodeURIComponent(eventos.join(","))}`;
      const r = await fetch(url, { headers: { "x-agenda-secret": secreto } });
      if (!r.ok) {
        console.error("[erp-registrar] consulta no OK", r.status);
        res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
        return;
      }
      res.status(200).json(await r.json());
    } catch (error) {
      console.error("[erp-registrar] fallo de red en consulta", error?.message);
      res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
    }
    return;
  }

  const codigo = String(body.codigo ?? "").trim();
  const fecha = String(body.fecha ?? "").trim();
  const eventoId = String(body.eventoId ?? "").trim();

  if (!/^\d{1,10}$/.test(codigo) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    res.status(400).json({ error: "Faltan el código de la persona o la fecha de la sesión." });
    return;
  }

  try {
    const r = await fetch(`${ERP_BASE_URL}${RUTA}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agenda-secret": secreto },
      body: JSON.stringify({ codigo, fecha, eventoId })
    });

    const datos = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("[erp-registrar] respuesta no OK", r.status, datos?.error);
      res.status(502).json({ error: datos?.mensaje || "No se pudo pasar la sesión al ERP en este momento." });
      return;
    }

    res.status(200).json(datos);
  } catch (error) {
    console.error("[erp-registrar] fallo de red", error?.message);
    res.status(502).json({ error: "No se pudo pasar la sesión al ERP en este momento." });
  }
}
