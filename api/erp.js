// Función de servidor (Vercel): trae del ERP el estado real de las personas.
//
// La agenda ya comparte los códigos de persona con el ERP, pero el dinero y
// el conteo de sesiones se escribían a mano en cada evento y podían desviarse
// de la contabilidad. Aquí se consulta la verdad del ERP.
//
// El secreto (ERP_SHARED_SECRET) vive SOLO en el servidor, nunca en el
// navegador. Y antes de consultar se verifica que quien pregunta tenga sesión
// válida en la agenda, igual que hace el asistente.

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web publica

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://mentes-brillantes-erp.vercel.app";
const MAX_CODIGOS = 50;

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

  const codigos = normalizarCodigos(body.codigos ?? body.codigo);
  if (!codigos.length) {
    res.status(400).json({ error: "Indica al menos un código de persona." });
    return;
  }

  try {
    const url = `${ERP_BASE_URL}/api/integraciones/agenda/personas?codigos=${encodeURIComponent(codigos.join(","))}`;
    const r = await fetch(url, { headers: { "x-agenda-secret": secreto } });

    if (!r.ok) {
      // No se filtra el detalle del ERP al navegador; queda en el log.
      console.error("[erp] respuesta no OK", r.status);
      res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
      return;
    }

    const datos = await r.json();
    res.status(200).json(datos);
  } catch (error) {
    console.error("[erp] fallo de red", error?.message);
    res.status(502).json({ error: "No se pudo consultar el ERP en este momento." });
  }
}
