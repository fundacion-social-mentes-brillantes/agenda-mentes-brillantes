# Servidor MCP — manejar la agenda desde Claude, Codex o ChatGPT

El servidor MCP vive en la carpeta [`mcp-server/`](../mcp-server). Le da a un asistente (Claude, Codex,
ChatGPT) la capacidad de **ver, crear, editar y borrar eventos** de tu agenda.

Funciona de dos maneras:

- **Local (stdio):** corre en tu computador. Ideal para **Claude Desktop, Claude Code y Codex**. Es lo más simple y privado.
- **Nube (HTTP):** se publica en internet con un token secreto. Necesario para **ChatGPT**.

Las dos usan el mismo código.

---

## Paso 1 — Descargar la llave de servicio de Firebase

1. Entra a https://console.firebase.google.com → tu proyecto.
2. Engranaje ⚙️ (arriba a la izquierda) → **Configuración del proyecto**.
3. Pestaña **Cuentas de servicio**.
4. Botón **Generar nueva clave privada** → **Generar clave**. Se descarga un archivo `.json`.
5. Guárdalo dentro de `mcp-server/` con el nombre `serviceAccount.json`.

> Ese archivo es una llave maestra: **no lo compartas ni lo subas a GitHub**. Ya está protegido en `.gitignore`.

## Paso 2 — Conocer tu UID

1. En Firebase Console → **Authentication → Users**.
2. Busca tu correo y copia el valor de la columna **Identificador de usuario (UID)**.
   Es una cadena como `a1b2c3d4e5...`.

## Paso 3 — Preparar el servidor

Abre una terminal en la carpeta `mcp-server` y ejecuta una sola vez:

```bash
cd "C:\Programas creados por mi\agenda-mentes-brillantes\mcp-server"
npm install
npm run build
```

Crea también el archivo de configuración copiando el ejemplo:

```bash
cp .env.example .env
```

Y edita `.env` poniendo al menos:

```
FIREBASE_SERVICE_ACCOUNT=./serviceAccount.json
AGENDA_UID=tu_uid_aqui
```

Prueba que funciona:

```bash
npm run stdio
```

Si ves `Agenda Mentes Brillantes MCP (stdio) listo.` está bien. Ciérralo con `Ctrl + C`.

---

## Conectar a Claude Desktop

Edita el archivo `claude_desktop_config.json`:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

Agrega (ajusta las rutas a tu computador):

```json
{
  "mcpServers": {
    "agenda-mentes-brillantes": {
      "command": "node",
      "args": ["C:\\Programas creados por mi\\agenda-mentes-brillantes\\mcp-server\\dist\\stdio.js"],
      "env": {
        "FIREBASE_SERVICE_ACCOUNT": "C:\\Programas creados por mi\\agenda-mentes-brillantes\\mcp-server\\serviceAccount.json",
        "AGENDA_UID": "tu_uid_aqui",
        "AGENDA_TZ_OFFSET": "-05:00"
      }
    }
  }
}
```

Cierra y vuelve a abrir Claude Desktop. Verás las herramientas de la agenda disponibles.

---

## Conectar a Claude Code

Desde la carpeta `mcp-server`, ejecuta:

```bash
claude mcp add agenda --env FIREBASE_SERVICE_ACCOUNT=./serviceAccount.json --env AGENDA_UID=tu_uid_aqui -- node ./dist/stdio.js
```

---

## Conectar a Codex

Edita `~/.codex/config.toml` (en Windows: `C:\Users\TU_USUARIO\.codex\config.toml`) y agrega:

```toml
[mcp_servers.agenda]
command = "node"
args = ["C:\\Programas creados por mi\\agenda-mentes-brillantes\\mcp-server\\dist\\stdio.js"]
env = { FIREBASE_SERVICE_ACCOUNT = "C:\\Programas creados por mi\\agenda-mentes-brillantes\\mcp-server\\serviceAccount.json", AGENDA_UID = "tu_uid_aqui", AGENDA_TZ_OFFSET = "-05:00" }
```

---

## Conectar a ChatGPT (modo nube)

ChatGPT no puede usar el servidor local; hay que publicarlo en internet.

### A. Publicar el servidor

Sirve para cualquier servicio que ejecute Node (Render, Railway, Google Cloud Run, etc.). Configura:

- Comando de inicio: `npm run start:http` (recuerda `npm install && npm run build` antes).
- Variables de entorno:
  - `FIREBASE_SERVICE_ACCOUNT_BASE64` = el contenido del `serviceAccount.json` convertido a base64
    (en la terminal: `base64 -w0 serviceAccount.json` en Linux/Mac, o usa un convertidor).
  - `AGENDA_UID` = tu UID.
  - `MCP_BEARER_TOKEN` = una contraseña larga inventada por ti (ej. 32 caracteres). **Guárdala.**
  - `AGENDA_TZ_OFFSET` = `-05:00`.
  - `MCP_HTTP_PORT` = el puerto que pida el servicio (muchos usan la variable `PORT`).

El endpoint quedará en `https://TU-DOMINIO/mcp`. Puedes comprobar que vive abriendo `https://TU-DOMINIO/health`.

### B. Agregarlo en ChatGPT

En ChatGPT (con conectores MCP / modo desarrollador, disponible en planes de pago):

1. Configuración → **Conectores** → **Agregar servidor MCP**.
2. URL: `https://TU-DOMINIO/mcp`.
3. Autenticación: tipo **Bearer / token**, y pega el `MCP_BEARER_TOKEN`.
4. Guarda. Ya puedes pedirle a ChatGPT que cree o consulte eventos.

---

## Qué puede hacer el asistente

| Herramienta | Para qué sirve |
|---|---|
| `list_workspaces` | Ver tus agendas (personal y compartidas). |
| `list_events` | Listar eventos, filtrando por fechas o texto. |
| `today_agenda` | Ver los eventos de hoy. |
| `get_event` | Ver el detalle de un evento. |
| `create_event` | Crear un evento (título, fecha, hora, modalidad, color, pagos…). |
| `update_event` | Editar un evento o marcarlo como hecho. |
| `delete_event` | Eliminar un evento. |

Ejemplos de lo que puedes pedir:

- "¿Qué tengo agendado hoy?"
- "Agéndame una sesión presencial con Laura el 3 de julio de 3 a 4 pm, valor 80000."
- "Mueve la reunión del viernes a las 10 am."
- "Marca como hecha la cita de odontología."

> El asistente actúa con tu usuario (`AGENDA_UID`) y, si no dices otra agenda, usa tu agenda personal.
> Para una agenda compartida, dile el nombre: "créalo en la agenda Familia".
