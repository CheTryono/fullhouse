# Corrección del arranque cerrado de Fullhouse Staging

> El procedimiento posterior, separado de la primera creación y sin ejecutar
> servicios, se prepara en [COMMERCIAL_FAILED_FUNCTION_RECOVERY.md](COMMERCIAL_FAILED_FUNCTION_RECOVERY.md).

Base `43cdfa8` (PR #30 fusionada). Rama
`fix/commercial-staging-runtime-project`. Esta entrega no despliega, elimina,
inspecciona ni modifica recursos de Google Cloud o IAM.

## Incidente y reproducción

El propietario informó que el segundo ensayo real llegó a Cloud Build/Cloud Run,
pero `remoteV1` quedó `FAILED`: `runtimeCheck()` lanzó «No se permite cruzar
staging con emulación o depuración que altere la verificación de tokens» al cargar
`index.cjs`. No hay servicio operativo según su informe. No es una observación
remota realizada por Codex.

La condición anterior exigía `GCLOUD_PROJECT === "fullhouse-staging"` antes de
cargar el SDK. El transporte fija `FIREBASE_CONFIG` inline con `projectId` y
`storageBucket` correctos, pero no fija ese alias. No se debe suponer que Cloud Run
añadirá una variable fuera del contrato de nuestra release. La prueba anterior
`check-remote-gcloud-node22.cjs` inyectaba el alias y ocultaba esa incompatibilidad.

**Reproducción anterior a corregir:** Node 22.23.5, artefacto copiado y únicamente
las cuatro variables de `gcloud.ENV`, sin aliases: salida 1 con la misma traza
`policy.cjs:12` / `index.cjs:3`. El mismo caso ejecutado por el **Functions
Framework real 5.0.5** falló al cargar el módulo y no inició el servidor. La prueba
de arranque esperaba éxito y falló antes de reparar el código.

El mensaje antiguo agrupaba ausencia, contradicción y emulación. Esa traza por sí
sola no permite reconstruir todas las variables del contenedor fallido; no se
atribuyen a una inspección remota valores que no se proporcionaron. La violación
del contrato entre nuestro plan y nuestro arranque sí queda reproducida.

## Contrato de identidad

`settingsCheck()` continúa fijando proyecto, app, bucket, región, base, runtime,
cuenta runtime, orígenes y límites. `runtimeCheck()` exige Node 22 y al menos una
señal explícita de proyecto:

- `GCLOUD_PROJECT` o `GOOGLE_CLOUD_PROJECT`, si existen, deben coincidir
  exactamente con el proyecto autorizado. Un valor vacío o contradictorio falla,
  incluso cuando otra señal sea correcta.
- `FIREBASE_CONFIG`, si existe, debe ser JSON inline objeto, con
  `projectId === settings.projectId`. Si incluye `storageBucket`, también debe
  coincidir exactamente. No se leen rutas de archivo ni credenciales; JSON
  malformado, primitivos, arrays, ausencia de proyecto o bucket contradictorio
  bloquean el arranque incluso con un alias correcto.
- Sin ninguna señal no se inicia. No basta la configuración estática por sí sola.

Las señales se verifican todas; no se utiliza una precedencia que oculte
contradicciones. Se conserva compatibilidad con el arranque anterior que
proporcionaba solo un alias correcto. El plan revisado proporciona ambos campos
Firebase, por lo que no depende de aliases ni de consultas al servidor de metadata.

Los bloqueos de variables `*EMULATOR*` y `FIREBASE_DEBUG*` no vacías se mantienen,
incluido `skipTokenVerification`. La identidad configurada **no es autenticación
ni una atestación de la infraestructura**: un operador capaz de cambiar código y
variables sigue siendo una autoridad de despliegue. Auth/App Check y permisos de
recursos continúan siendo controles independientes.

## Pruebas reproducibles

Instalar las herramientas web bajo Node 24.15+ de la rama 24:

```sh
nvm use 24
npm ci --ignore-scripts
npm test
npm run check
npm run check:remote
npm run check:remote-client
npm run check:auth
npm run check:history-contract
```

El Framework **5.0.5** está fijado como dependencia **de desarrollo** y en el lock
de raíz, sin actualizar versiones existentes. No se añade al artefacto, ni se
cambia `remote/package.json`, su lock o el runtime. La versión del Framework del
contenedor real fallido no fue comunicada y no se presume idéntica a la ensayada.

Instalar por separado las dependencias backend fijadas bajo Node 22, si faltan;
después ejecutar:

```sh
nvm use 22
npm ci --prefix remote --engine-strict
npm run test:remote-staging:startup
npm run check:remote-staging:gcloud-node22
```

La primera suite lanza el ejecutable real del Framework, el `index.cjs` copiado,
entry point `remoteV1` y firma HTTP. Utiliza un entorno construido desde cero con
las variables de release, sin heredar ADC, aliases, tokens o `NODE_OPTIONS` del
operador. Un preload impide conexiones salientes/DNS y cargar clientes
Firestore/Storage. Las solicitudes de ensayo son únicamente locales.

Comprueba inicio sin aliases, aliases coherentes, rechazo de proyecto/alias vacío,
bucket o JSON incorrectos, identidad ausente y siete variables de emulación o
depuración. El handler sigue rechazando HTTP sin tokens con `UNAUTHENTICATED` y
conserva CORS. Las pruebas negativas exigen que el proceso salga con error **antes
de servir**, no solo que una petición falle.

`check:remote-staging:gcloud-node22` ejecuta esa suite y conserva además el
diagnóstico callable existente, ahora **sin inyectar GCLOUD_PROJECT**: puertos JWT
sintéticos válidos producen `UNAVAILABLE`, tokens ausentes/inválidos son
rechazados, capacidad/CORS se conservan y no se cargan clientes de datos. Esto no
demuestra validación real de certificados, App Check en Cloud Run ni IAM efectivo.

La suite general incluye las cuatro regresiones puras de identidad. La suite
Framework está separada porque exige Node 22 real; no se presenta Node 24 como
runtime compatible del backend ni se omite silenciosamente esa prueba.

## Nueva release

El cambio de `policy.cjs` modifica los hashes del artefacto y del manifiesto y,
por tanto, el SHA-256 completo de release. El hash anterior de PR #30 no autoriza
estos bytes. Las instrucciones siguientes solo preparan archivos locales:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/remote-staging-gcloud.cjs > /tmp/fullhouse-startup-release.json
node -e 'const g=require("./scripts/remote-staging-gcloud.cjs"),p=require("/tmp/fullhouse-startup-release.json");g.verifyPlan(p);console.log(p.releaseHash)'
```

Regenerar en el checkout limpio que se revise; no copiar planes de otra máquina,
porque contienen rutas locales. `verifyPlan` compara los bytes actuales y los
controles. No introducir automáticamente la salida en variables de consentimiento.
El hash no equivale a permiso de ejecución ni a una firma de autenticidad.

SHA-256 de la nueva release revisada, idéntico en Node 22.23.5 y 24.22.1:

```text
1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af
```

No reutilizar `703cb1a4...` de PR #30. El hash nuevo sigue requiriendo aprobación
independiente; no se han configurado variables de consentimiento.

## Resultados ejecutados por Codex

| Verificación | Resultado |
| --- | --- |
| Reproducción Node 22 con solo las variables declaradas | Antes de reparar: salida 1 en `runtimeCheck`, misma traza que el incidente comunicado |
| Regresión Functions Framework sin aliases | Antes de reparar: 0/1, el servidor no inicia; después el mismo caso inicia y rechaza HTTP sin tokens |
| Instalación limpia raíz, Node 24.22.1, `npm ci --ignore-scripts` | Aprobada; versiones existentes del lock sin cambios; únicamente dependencias dev del Framework añadidas |
| `npm test`, Node 24.22.1 | 631 casos: **625 aprobados, 0 fallos, 0 omitidos, seis TODO previos**, 47.707 s |
| Selección `commercial-gcloud`, `commercial-build`, `commercial-iam`, `commercial-staging`, `commercial-media`, `commercial-runtime-project`, Node 22.23.5 | **83/83**, sin fallos/omitidos/TODO |
| `check:remote-staging:gcloud-node22` | **16/16** procesos de Functions Framework y diagnóstico HTTP callable aprobados |
| SDK 592.0.0, `test:remote-staging:gcloud-sdk` | Opciones/solicitud/ZIP/hashes aprobados; **cero intentos de red** |
| `check`, `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Aprobadas; fuente/app.js sincronizados sin escribirlos |
| `prepare` / `verifyPlan`, Node 22 y 24 | Hash idéntico, artefacto y variables cerradas verificados |

Las seis tareas pendientes del contrato histórico siguen explícitas; no se
clasificó ningún fallo nuevo como TODO. Las regresiones públicas, Auth, guardado
pendiente, contratos e historial se incluyen en `npm test`. No se repitieron
emuladores completos, navegador ni consultas IAM reales: las reglas, UI y backend
de datos no cambiaron. No se declara validado el contenedor de Google Cloud ni
su imagen tras la reparación; eso requiere otro ensayo autorizado.

## Barreras y siguiente ensayo

- `deploymentAuthorized:true` conserva únicamente la autorización de repositorio
  de PR #30. `remoteEnabled:false`, cliente `enabled:false`, App Check site key
  sin configurar, variable de activación `0` y UIDs vacíos permanecen intactos.
- App Check/Auth, orígenes, capacidad, Node 22, región, runtime/build dedicados,
  repositorio y bucket de fuentes, IAM, reglas y permisos no cambian.
- Firebase CLI sigue bloqueado y Actions no despliega Functions. No cambia el
  Planner local, `app.tsx`, `app.js`, Hosting/Pages ni el historial experimental.
- **Bloqueo independiente:** `assertAudit()` sigue admitiendo solo el primer
  ensayo, con función `null` y observación 404. Una función existente `FAILED`
  se rechaza antes de subir o ejecutar una actualización. Nueva regresión exige
  cero comandos mutantes en ese caso. No se amplía esa autorización por esta PR.

Antes de otro despliegue, el propietario deberá revisar esta corrección y su nuevo
hash, inspeccionar de solo lectura la función/revisión fallida y aprobar por
separado un procedimiento dirigido de actualización que compruebe el recurso
existente, permisos y estado esperado. No borrar para eludir la barrera, no pasar
un inventario ficticio al ejecutor y no repetir el comando de primer ensayo como
si la función estuviera ausente. Este procedimiento de actualización queda fuera
de la corrección de arranque, pendiente de revisión y autorización independientes.

El ensayo autorizado posterior deberá comprobar arranque/estado ACTIVE, build y
runtime efectivos, imagen/hash/fuentes, capacidad, variables cerradas y rechazo
real de tokens. No se reintenta automáticamente una confirmación incierta ni se
anuncia rollback: las fuentes, imágenes, revisiones y logs pueden existir y
generar cargos aunque el servicio falle. No se limpia ningún recurso aquí.
