# Despertador en la nube (Azure) — cómo instalarlo

Esta carpeta contiene el **despertador** de los avisos de la agenda.

No hace nada complicado: es un reloj que vive en Azure y que, cada cierto tiempo,
llama por internet a la agenda y le dice *"revisa si hay que avisarle algo a alguien"*.
Quien decide a quién avisar y qué decirle es la agenda, no esto.

| Reloj | Cuándo suena | Qué le pide a la agenda |
|---|---|---|
| `recordatorios` | cada 5 minutos, todo el día | avisar los eventos que empiezan en los próximos 18 minutos |
| `resumen` | todos los días a las 7:02 a.m. de Colombia | mandar la lista del día |

> **¿Cuánto cuesta?** Nada. El plan de Consumo de Azure regala 1.000.000 de ejecuciones
> gratis al mes y esto usa unas **8.700** (288 al día del de 5 minutos + 1 del resumen).
> Lo único que puede cobrar centavos es la cuenta de almacenamiento, que es obligatoria.

---

## Antes de empezar: instalar dos programas

Se hace **una sola vez** en el computador. Abre **PowerShell** y ejecuta:

```powershell
winget install -e --id Microsoft.AzureCLI
```

```powershell
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

Después **cierra y vuelve a abrir PowerShell** (si no, no reconoce los comandos nuevos).

Para comprobar que quedaron bien:

```powershell
az --version
func --version
```

---

## Paso 1 — Entrar a Azure

```powershell
az login
```

Se abre el navegador. Inicia sesión con la cuenta de Azure de la Fundación.

Después, para asegurarnos de trabajar en la suscripción correcta:

```powershell
az account set --subscription "ID-DE-LA-SUSCRIPCION"
```

> Para ver el ID: `az account list --output table`.
> (No se escribe aquí el identificador real porque este repositorio es público en GitHub.)

## Paso 2 — Crear la cuenta de almacenamiento

Azure exige una "cuenta de almacenamiento" para que el reloj pueda recordar cuándo sonó
por última vez. Reutilizamos el grupo de recursos que ya existe, `rg-gemb-ia` (en `eastus`):

```powershell
az storage account create --name stgembavisos --resource-group rg-gemb-ia --location eastus --sku Standard_LRS
```

> ⚠️ El nombre `stgembavisos` tiene que ser **único en todo el mundo**. Si Azure responde
> que ya está ocupado, agrégale números al final (`stgembavisos2`, `stgembavisos26`...) y
> usa ese mismo nombre en el paso siguiente. Solo minúsculas y números, máximo 24 letras.

## Paso 3 — Crear la Function App

```powershell
az functionapp create --name gemb-avisos-agenda --resource-group rg-gemb-ia --storage-account stgembavisos --consumption-plan-location eastus --os-type Linux --runtime node --runtime-version 22 --functions-version 4
```

> ⚠️ `gemb-avisos-agenda` también tiene que ser **único en todo el mundo** (será la
> dirección `gemb-avisos-agenda.azurewebsites.net`). Si está ocupado, cámbialo y usa el
> nombre nuevo en todos los comandos que siguen.

## Paso 4 — Guardarle las dos claves

Aquí le decimos **a qué dirección** llamar y **con qué secreto**. El secreto tiene que ser
**exactamente el mismo** que está en Vercel como `PUSH_TICK_SECRET`.

```powershell
az functionapp config appsettings set --name gemb-avisos-agenda --resource-group rg-gemb-ia --settings VERCEL_URL="https://agenda-mentes-brillantes.vercel.app" PUSH_TICK_SECRET="AQUI-EL-SECRETO-REAL"
```

Para ver qué quedó guardado (el secreto aparece completo, no lo compartas):

```powershell
az functionapp config appsettings list --name gemb-avisos-agenda --resource-group rg-gemb-ia --output table
```

## Paso 5 — Subir el código

Desde **esta carpeta** (`azure`):

```powershell
cd "C:\Programas creados por mi\agenda-mentes-brillantes\azure"
```

```powershell
npm install
```

```powershell
func azure functionapp publish gemb-avisos-agenda
```

Cuando termine debe listar las dos funciones (`recordatorios` y `resumen`). Listo:
el despertador ya está trabajando solo.

---

## Ver qué está pasando (los registros)

Para quedarse mirando en vivo lo que hace el despertador:

```powershell
func azure functionapp logstream gemb-avisos-agenda --browser
```

> ⚠️ En **Linux con plan de Consumo** el registro en la ventana negra **no funciona**:
> hay que verlo en el navegador (por eso el `--browser`) o en
> **portal.azure.com → tu Function App → Functions → recordatorios → Monitor**.

Cada vez que suene el reloj y todo salga bien, verás una línea así:

```
[recordatorios] revisados: 12, enviados: 2, fallidos: 0
```

Si algo falla, la línea empieza igual pero dice el motivo (por ejemplo
`La agenda respondió 401`, que significa que el secreto no coincide).

También se pueden ver desde el navegador:
**portal.azure.com → gemb-avisos-agenda → Functions → recordatorios → Monitor**.

---

## Probar a mano, sin esperar al reloj

### Probar la agenda directamente

Esto llama al endpoint de la agenda igual que lo haría Azure. Sirve para saber si el
problema está en la agenda o en Azure.

En **PowerShell** (ojo: en PowerShell hay que escribir `curl.exe`, no solo `curl`):

```powershell
curl.exe -X POST "https://agenda-mentes-brillantes.vercel.app/api/push-tick" -H "Content-Type: application/json" -H "x-push-secret: AQUI-EL-SECRETO-REAL" -d "{\"mode\":\"reminders\"}"
```

Para probar el resumen del día, cambia `reminders` por `daily`:

```powershell
curl.exe -X POST "https://agenda-mentes-brillantes.vercel.app/api/push-tick" -H "Content-Type: application/json" -H "x-push-secret: AQUI-EL-SECRETO-REAL" -d "{\"mode\":\"daily\"}"
```

Qué significa la respuesta:

| Respuesta | Qué pasa | Cómo se arregla |
|---|---|---|
| `{"ok":true,"revisados":...}` | Funcionó. | Nada. |
| `401 no autorizado` | El secreto no coincide con el de Vercel. | Volver a poner `PUSH_TICK_SECRET` igual en los dos lados. |
| `405 Método no permitido` | Se llamó sin `POST`. | Falta el `-X POST` en el comando. |
| `500 Faltan las llaves...` | No están las VAPID en Vercel. | Poner `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. |
| `500 Falta configurar PUSH_REFRESH_TOKEN` | El servidor no puede leer la agenda. | Poner `PUSH_REFRESH_TOKEN` en Vercel. |
| `404` | La dirección está mal o `api/push-tick.js` no se ha publicado. | Revisar `VERCEL_URL` y volver a desplegar la agenda. |

El endpoint dice el motivo exacto en español, así que vale la pena leer el mensaje completo.
Esos mismos mensajes aparecen en los registros de Azure cuando el despertador falla.

### Probar el despertador de Azure

Desde el portal: **portal.azure.com → gemb-avisos-agenda → Functions →** elige
`recordatorios` **→ Code + Test → Test/Run → Run**. Se ejecuta de inmediato sin esperar
los 5 minutos.

---

## Probar en el propio computador (opcional)

1. Copia `local.settings.json.ejemplo` y llámalo `local.settings.json`.
2. Pon adentro la dirección real y el secreto real.
3. Ejecuta `npm install` y luego `func start`.

> ⚠️ Si en `local.settings.json` dejas `AzureWebJobsStorage` con el valor
> `UseDevelopmentStorage=true`, hace falta el **emulador Azurite** o `func start` no arranca.
> Se instala una sola vez con `npm install -g azurite` y hay que dejarlo corriendo en **otra
> ventana** de PowerShell (solo hay que escribir `azurite`). La otra opción es pegar ahí la
> cadena de conexión real de la cuenta de almacenamiento de Azure.

`local.settings.json` **nunca** se sube al repositorio ni a Azure (ya está en `.gitignore`
y en `.funcignore`).

---

## Cambiar los horarios

Los horarios están escritos en los dos archivos de `src/functions/`:

| Archivo | Línea | Significa |
|---|---|---|
| `recordatorios.js` | `schedule: "0 */5 * * * *"` | cada 5 minutos |
| `resumen.js` | `schedule: "0 2 12 * * *"` | todos los días a las 12:02 **UTC** = 7:02 a.m. Colombia |

El formato es: `segundo minuto hora día mes díaDeLaSemana`.

> ⚠️ **Azure trabaja en hora UTC.** Colombia es UTC−5 fijo. Para saber qué número poner:
> **hora que quieres en Colombia + 5 = hora UTC**. Ejemplos: 6:00 a.m. Colombia → `0 0 11 * * *`;
> 8:00 p.m. Colombia → `0 0 1 * * *` (ojo, ese ya cae al día siguiente en UTC).

> **¿Por qué el resumen es a las 7:02 y no a las 7:00?** Para que no caiga exactamente
> encima del turno de `recordatorios` de las 12:00 UTC. Si sonaran al mismo tiempo, los dos
> intentarían escribir el mismo documento en la agenda y podrían estorbarse.

Después de cambiar un horario hay que volver a subir el código con
`func azure functionapp publish gemb-avisos-agenda`.

---

## Mantenimiento a futuro

> 📅 **30 de septiembre de 2028.** Microsoft retira el **plan de Consumo en Linux** ese día.
> Antes de esa fecha hay que mover la Function App al **plan Flex** (Flex Consumption), que es
> el reemplazo. No hay que cambiar nada del código: es volver a crear la Function App con el
> plan nuevo y volver a poner las dos claves (`VERCEL_URL` y `PUSH_TICK_SECRET`).

---

## Apagar o borrar todo

Apagar temporalmente (deja de sonar, no se borra nada):

```powershell
az functionapp stop --name gemb-avisos-agenda --resource-group rg-gemb-ia
```

Volver a encender:

```powershell
az functionapp start --name gemb-avisos-agenda --resource-group rg-gemb-ia
```

Borrar definitivamente la Function App:

```powershell
az functionapp delete --name gemb-avisos-agenda --resource-group rg-gemb-ia
```
