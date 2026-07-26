# Avisos en el celular (notificaciones push)

La agenda puede **avisarte en el celular aunque la app esté cerrada**, igual que WhatsApp.
No hace falta tener el navegador abierto ni el teléfono desbloqueado.

Hay **dos tipos de aviso**, y cada persona decide cuáles quiere:

| Aviso | Cuándo llega | Qué dice |
|---|---|---|
| **Recordatorio** | unos 15 minutos antes de cada evento | el evento que está por empezar |
| **Resumen del día** | una vez, a las **7:02 de la mañana** | la lista de todo lo que tienes ese día |

Los avisos son de la **agenda compartida del equipo**: todos los miembros que activaron los
avisos reciben los eventos del equipo, no solo los suyos.

> ⚠️ **Por ahora los avisos llegan a UN solo aparato: el último donde los actives.**
> Si los tenías en el celular y los activas en el computador, dejan de llegar al celular.
> Para volver a tenerlos en el celular, actívalos de nuevo ahí.

---

## Cómo funciona (el dibujo)

```
   ┌──────────────┐   cada 5 minutos    ┌──────────────┐   "a Ana le toca en   ┌──────────┐
   │              │   "revisa, por      │              │    15 minutos"        │          │
   │    AZURE     │ ─────favor───────▶  │  LA AGENDA   │ ─────────────────────▶│ TU       │
   │ (despertador)│                     │  (Vercel)    │                       │ CELULAR  │
   │              │   y cada mañana     │              │                       │          │
   └──────────────┘   a las 7:02        └──────┬───────┘                       └──────────┘
                                               │
                                               │ mira quién tiene eventos
                                               ▼
                                        ┌──────────────┐
                                        │  FIRESTORE   │
                                        │ (los eventos)│
                                        └──────────────┘
```

En palabras:

1. **Azure** es un despertador que vive en la nube. No sabe nada de tus eventos: lo único
   que hace es tocarle la puerta a la agenda cada 5 minutos y una vez cada mañana.
2. **La agenda** se despierta, mira el calendario y decide a quién hay que avisarle qué.
3. **La agenda manda el aviso** directamente al celular de esa persona.

El teléfono muestra la notificación aunque la app esté cerrada porque, cuando instalaste la
app, quedó guardado un pequeño "buzón" en el navegador que sigue escuchando siempre.

> **¿Por qué hace falta Azure?** Porque la agenda es una página web: solo "despierta" cuando
> alguien la visita. Necesita que algo la llame a horas fijas. Ese es todo el trabajo de Azure.

---

## Cómo activar los avisos

1. **Instala la app en el celular.** Esto es **obligatorio**, no basta con abrir la página.
   Sigue la guía [INSTALACION-APP.md](INSTALACION-APP.md).
2. Abre la app **desde el ícono** de la pantalla de inicio.
3. Entra a **Ajustes**.
4. Busca la tarjeta **Avisos en el celular** y toca el botón
   **Activar avisos en este dispositivo**.
5. El teléfono preguntará *"¿Permitir notificaciones?"* → toca **Permitir**.
6. Aparecerá el sello verde **Activados en este dispositivo ✓** y, debajo, dos interruptores.
   Enciende los que quieras:
   - **15 minutos antes** — un aviso justo antes de cada evento.
   - **Resumen de la mañana** — a las 7:02 a. m., la lista de todo lo que tienes hoy.

Los dos vienen encendidos de entrada. Para dejar de recibirlos en ese aparato, usa
**Desactivar en este dispositivo**.

> ⚠️ **Un solo aparato a la vez.** Por ahora los avisos llegan al **último aparato donde los
> actives**. Si en Ajustes ves el mensaje *"Los avisos están activos en otro aparato"*, es que
> los tienes encendidos en otro lado: toca **Activar** para pasarlos a este (y entonces dejan
> de llegar al anterior).

---

## ⚠️ Aviso importante para iPhone y iPad

En iPhone las notificaciones **sí funcionan**, pero Apple pone dos condiciones que hay que
cumplir sí o sí:

1. El iPhone debe tener **iOS 16.4 o más nuevo**.
   Míralo en *Ajustes → General → Información → Versión del software*.
   Si es más viejo, hay que actualizar el teléfono: no hay otra forma.

2. **Es obligatorio instalar la app en la pantalla de inicio, desde Safari.**
   En iPhone, abrir la página en el navegador **no sirve**: Apple solo permite
   notificaciones a las apps instaladas.

   - Abre `https://agenda-mentes-brillantes.vercel.app` en **Safari** (no en Chrome:
     Chrome de iPhone no puede instalar la app).
   - Toca el botón **Compartir** (el cuadrito con la flecha hacia arriba, abajo en el centro).
   - Desliza y elige **Agregar a inicio**.
   - Toca **Agregar**.
   - **Cierra Safari y abre la app desde el ícono nuevo.** Recién ahí aparecerá la opción
     de activar los avisos en Ajustes.

   Si borras el ícono de la pantalla de inicio, se pierden los avisos y hay que volver a
   activarlos.

En **Android** nada de esto hace falta: funciona con Chrome directamente, aunque también
conviene instalar la app.

---

## No me llegan los avisos — lista de revisión

Revisa en este orden. Casi siempre el problema está en los primeros tres puntos.

### 1. ¿Instalaste la app? (sobre todo en iPhone)
En iPhone es **obligatorio**. Si abriste la agenda desde Safari en vez del ícono, no va a
funcionar nunca. Ver el aviso de arriba.

### 2. ¿El teléfono tiene permiso concedido?
Si alguna vez tocaste "No permitir", el teléfono no vuelve a preguntar. Hay que arreglarlo
a mano:

- **Android:** *Ajustes → Aplicaciones → Agenda Mentes Brillantes → Notificaciones* →
  encender. (Si la abres desde Chrome: *Chrome → ⋮ → Configuración → Notificaciones*.)
- **iPhone:** *Ajustes → Notificaciones →* busca **Agenda Mentes Brillantes** → activar
  **Permitir notificaciones**.
- **Computador:** haz clic en el candado 🔒 al lado de la dirección → *Notificaciones* → Permitir.

### 3. ¿Siguen activados en Ajustes?
Vuelve a *Ajustes → Avisos en el celular* dentro de la app. Tiene que verse el sello
**Activados en este dispositivo ✓** y los interruptores que quieres, encendidos.

Si en vez de eso ves el botón **Activar avisos en este dispositivo**, es que este aparato
no está suscrito: tócalo. Y si ves el mensaje *"Están bloqueados"*, ve al punto 2.

Si ves *"Los avisos están activos en otro aparato"*, los avisos se están yendo a otro
teléfono o al computador: toca **Activar** para traerlos a este.

Un truco que arregla casi todo: **Desactivar en este dispositivo** y volver a activar.

### 4. ¿El celular está en "No molestar" o ahorro de batería?
- El modo **No molestar** / **Concentración** silencia los avisos: revísalo.
- Android a veces "duerme" las apps que usas poco:
  *Ajustes → Aplicaciones → Agenda → Batería → Sin restricciones*.

### 5. ¿El evento tiene hora?
Los eventos de **todo el día** no tienen recordatorio de 15 minutos (no hay hora a la cual
restarle 15 minutos). Sí salen en el resumen de la mañana.

### 6. ¿Creaste el evento con muy poco tiempo de anticipación?
Si el evento empieza **dentro de los próximos 18 minutos**, el aviso todavía alcanza a salir
(llega en el siguiente turno del reloj, o sea en menos de 5 minutos). Pero si el evento
**ya empezó**, no llega ningún recordatorio: los avisos son solo de lo que está por venir.

### 7. Cambiaste de teléfono o borraste los datos del navegador
El "buzón" quedó en el aparato viejo. Hay que **apagar y volver a encender** el interruptor
de avisos en el teléfono nuevo.

### 8. Si nada de lo anterior funciona
El problema ya es técnico. Quien te ayude debe mirar:

- Los registros de Azure: `func azure functionapp logstream gemb-avisos-agenda --browser`
  (ver [../azure/LEEME.md](../azure/LEEME.md)).
- Que las variables de la tabla de abajo estén puestas en Vercel y en Azure, y que el
  secreto `PUSH_TICK_SECRET` sea **idéntico** en los dos lados.

---

## Configuración técnica (para quien mantenga el sistema)

Sebastián: esta parte no la necesitas para usar los avisos. Es la lista de claves que hay
que dejar puestas una sola vez.

### En Vercel

*Proyecto `agenda-mentes-brillantes` → Settings → Environment Variables.*
Márcalas para **Production**, **Preview** y **Development**.

| Variable | Qué es | Cómo se obtiene |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Llave pública del sistema de avisos. El navegador la pide para suscribirse. | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Llave privada. **Secreta**, nunca sale del servidor. | Sale del mismo comando de arriba |
| `VAPID_SUBJECT` | Correo de contacto exigido por el estándar. Formato `mailto:...` | `mailto:fundacionsocial@gimnasioemocionalmb.com` |
| `PUSH_TICK_SECRET` | Contraseña compartida con Azure para que nadie más pueda disparar los avisos. | Inventar una larga y aleatoria |
| `PUSH_REFRESH_TOKEN` | Permiso permanente para que el servidor pueda leer los eventos de la agenda. | Se genera una vez desde la app |

> Las dos llaves VAPID se generan **juntas y una sola vez**. Si se cambian, todos los
> aparatos pierden la suscripción y hay que volver a activar los avisos en cada uno.

### En Azure

*Function App `gemb-avisos-agenda` → Configuration → Application settings*, o con el comando
que está en [../azure/LEEME.md](../azure/LEEME.md).

| Variable | Qué es | Valor |
|---|---|---|
| `VERCEL_URL` | Dirección de la agenda a la que hay que llamar. | `https://agenda-mentes-brillantes.vercel.app` |
| `PUSH_TICK_SECRET` | La contraseña compartida. **Tiene que ser idéntica a la de Vercel.** | la misma de arriba |
| `AzureWebJobsStorage` | Almacenamiento que Azure necesita para funcionar. | lo crea Azure solo |
| `FUNCTIONS_WORKER_RUNTIME` | Le dice a Azure que el código es de Node.js. | `node` |

### Los dos relojes de Azure

| Reloj | Horario | Le pide a la agenda |
|---|---|---|
| `recordatorios` | cada 5 minutos | `{ "mode": "reminders" }` |
| `resumen` | 12:02 UTC = 7:02 a.m. Colombia | `{ "mode": "daily" }` |

Azure trabaja en hora **UTC** y Colombia es UTC−5 fijo (aquí no se cambia la hora en verano).
Por eso el resumen de las 7:02 a.m. está escrito como las 12:02. Los dos minutos corridos
son a propósito: así el resumen no cae encima del turno de `recordatorios` de las 12:00.

### Costo

**$0.** El plan de Consumo de Azure regala 1.000.000 de ejecuciones gratis al mes y esto usa
unas 8.700 (288 al día del reloj de 5 minutos, más 1 del resumen). Los avisos en sí no cuestan
nada: los entrega el propio navegador con el estándar Web Push.
