// Peticion y respuesta minimas como las de Vercel, para llamar a los handlers.
export function peticion({ method = "POST", body = {}, headers = {}, query = {} } = {}) {
  return { method, body, headers, query };
}

export function respuesta() {
  const r = {
    statusCode: 200,
    headers: {},
    cuerpo: undefined,
    setHeader(nombre, valor) {
      r.headers[nombre.toLowerCase()] = valor;
    },
    status(codigo) {
      r.statusCode = codigo;
      return r;
    },
    json(datos) {
      r.cuerpo = datos;
      return r;
    },
    send(datos) {
      r.cuerpo = datos;
      return r;
    },
    end() {
      return r;
    },
  };
  return r;
}
