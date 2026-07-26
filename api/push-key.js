// Función de servidor (Vercel): entrega la LLAVE PÚBLICA de las notificaciones.
//
// El navegador necesita esta llave (VAPID pública) para poder suscribirse a las
// notificaciones push. Es PÚBLICA por diseño: no autoriza a enviar nada, solo
// permite que el navegador identifique a nuestro servidor. La llave privada
// (VAPID_PRIVATE_KEY) NUNCA sale de aquí y jamás se responde en este endpoint.

export default async function handler(req, res) {
  // Permisos de origen amplios: cualquier página nuestra (app instalada, dominio
  // de Vercel, dominio propio) puede pedir la llave sin iniciar sesión.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Consulta previa del navegador (CORS): se contesta vacío y listo.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  // La llave casi nunca cambia: se deja guardar 5 minutos para no pedirla todo el rato.
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
