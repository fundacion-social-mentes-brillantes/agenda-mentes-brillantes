/*
 * Avisos push de la Agenda Mentes Brillantes.
 *
 * Este archivo se carga DENTRO del service worker que genera Workbox
 * (con importScripts), por eso es JavaScript clásico: sin import/export,
 * sin TypeScript. Aquí solo vive lo relacionado con las notificaciones:
 * mostrarlas cuando llega un push y abrir la app cuando se tocan.
 */

// (Los globales del service worker —self, clients— los declara eslint.config.js.)

// Texto que se muestra si el servidor no manda nada legible.
var TITULO_POR_DEFECTO = "Agenda Mentes Brillantes";
var CUERPO_POR_DEFECTO = "Tienes un aviso de la agenda";
var ICONO = "/icons/icon-192.png";

/**
 * Lee el contenido del push de forma segura.
 * Primero intenta JSON ({ title, body, tag, url }); si no es JSON válido usa
 * el texto plano como cuerpo; y si tampoco hay nada, usa el texto por defecto.
 */
function leerDatosDelPush(event) {
  var datos = { title: TITULO_POR_DEFECTO, body: CUERPO_POR_DEFECTO, tag: "agenda", url: "/" };
  if (!event || !event.data) return datos;

  try {
    var json = event.data.json();
    if (json && typeof json === "object") {
      if (json.title) datos.title = String(json.title);
      if (json.body) datos.body = String(json.body);
      if (json.tag) datos.tag = String(json.tag);
      if (json.url) datos.url = String(json.url);
      return datos;
    }
  } catch (e) {
    /* no era JSON: seguimos con el texto plano */
  }

  try {
    var texto = event.data.text();
    if (texto) datos.body = texto;
  } catch (e2) {
    /* sin contenido legible: queda el texto por defecto */
  }

  return datos;
}

// Llega un aviso desde el servidor (la app puede estar cerrada).
self.addEventListener("push", function (event) {
  var datos = leerDatosDelPush(event);

  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      tag: datos.tag,
      icon: ICONO,
      badge: ICONO,
      data: { url: datos.url },
      renotify: false
    })
  );
});

// El usuario toca la notificación: enfocamos la app si ya está abierta.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var destino = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (ventanas) {
        for (var i = 0; i < ventanas.length; i++) {
          var ventana = ventanas[i];
          if ("focus" in ventana) {
            // Si podemos, llevamos la ventana existente a la pantalla que toca.
            if ("navigate" in ventana && destino && destino !== "/") {
              try {
                return ventana.navigate(destino).then(function (v) {
                  return (v || ventana).focus();
                });
              } catch (e) {
                /* algunos navegadores no permiten navigate: solo enfocamos */
              }
            }
            return ventana.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(destino || "/");
        return null;
      })
      .catch(function () {
        /* si algo falla no rompemos el service worker */
        return null;
      })
  );
});

/** Convierte la llave VAPID (base64 url-safe) al formato que pide el navegador. */
function base64ALlave(base64) {
  var relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  var normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  var crudo = self.atob(normal);
  var salida = new Uint8Array(crudo.length);
  for (var i = 0; i < crudo.length; i++) {
    salida[i] = crudo.charCodeAt(i);
  }
  return salida;
}

/** Pide la llave pública al servidor por si el navegador no nos dio la anterior. */
function pedirLlaveAlServidor() {
  return fetch("/api/push-key")
    .then(function (respuesta) {
      return respuesta.json();
    })
    .then(function (datos) {
      return datos && datos.publicKey ? base64ALlave(datos.publicKey) : null;
    })
    .catch(function () {
      return null;
    });
}

/*
 * A veces el navegador renueva la suscripción por su cuenta (caduca o cambia).
 * Intentamos volver a suscribirnos con la misma llave. Es "por si acaso":
 * si falla no pasa nada grave, la app vuelve a guardar la suscripción buena
 * la próxima vez que el usuario la abra.
 */
self.addEventListener("pushsubscriptionchange", function (event) {
  var anterior = event.oldSubscription || null;
  var llaveAnterior = anterior && anterior.options ? anterior.options.applicationServerKey : null;
  var obtenerLlave = llaveAnterior ? Promise.resolve(llaveAnterior) : pedirLlaveAlServidor();

  event.waitUntil(
    obtenerLlave
      .then(function (applicationServerKey) {
        if (!applicationServerKey) return null;
        return self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      })
      .catch(function () {
        return null;
      })
  );
});
