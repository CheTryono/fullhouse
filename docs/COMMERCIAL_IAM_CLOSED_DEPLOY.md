# Comercial 3C.3 · IAM y primer despliegue cerrado

Base `f1cd384` (PR #25/3C.2 fusionada). Preparación, **sin deploy ni cambios IAM**.
Se conservan `deploymentAuthorized:false`, `remoteEnabled:false`, cliente
`enabled:false`/`appCheckSiteKey:null`, controles, cuotas, CAS, recibos y respaldos v1.
No cambia Planner, Hosting, Pages, fuentes locales ni historial experimental v2.

## Estado posterior a PR #26

Después de PR #27, el propietario confirmó siete APIs ENABLED y default
Compute/Editor. El transporte Firebase fijado no selecciona builder dedicado;
el hook ahora se bloquea incluso si se abre solo el flag de deploy. Los comandos
de deploy siguientes son **históricos, no el procedimiento operativo vigente**.
Seguir [ejecutor dedicado](COMMERCIAL_DEDICATED_BUILD.md); no retirar Editor ni
usar opciones Firebase inventadas.

PR #26 ya fusionada en `f196350`. El propietario completó después la prueba
`SYNTHETIC_IAM_PROBE_PASSED`, run `c955a4a6-a4ac-4138-a415-51efb2ce3cc9`, y retiró
el binding temporal de impersonación. Resultado, datos retenidos, diagnóstico de
listeners y siguiente autorización: [preparación cerrada](COMMERCIAL_CLOSED_FUNCTIONS.md).
Acceso runtime probado en ese alcance; **no** despliegue ni IAM global aprobados.
Las secciones anteriores a ese ensayo se conservan abajo como evidencia histórica.
En particular, sus menciones a «probe pendiente/no autorizado» describen entonces,
no una instrucción para repetir la prueba ahora. Gates siguen false.

## Cierre de PR #26: informe anterior del propietario

El propietario repitió las pruebas y la auditoría real desde Google Cloud Shell
en `feat/commercial-iam-closed-deploy`, tras las correcciones de instalación,
REGIONAL y POST. **Esta evidencia es del propietario, no una ejecución de Codex.**
No comunicó SHA exacto, versiones de Node/npm, duraciones ni códigos de salida en
esta repetición; no se infieren de las verificaciones anteriores.

| Resultado comunicado | Evidencia |
| --- | --- |
| Pruebas IAM | **17 ejecutadas, 17 aprobadas, 0 fallos, 0 omitidas** |
| Suite general | **598 casos, 592 aprobados, 0 fallos, 6 TODO previos** |
| Asignaciones directas y recursos | **Aprobados en el alcance del auditor**: `directPolicy:matches-minimal-proposal`, `issues:[]` |
| Firestore | `(default)`, Standard/Native, us-central1 verificado |
| Bucket | `fullhouse-staging.firebasestorage.app`, REGIONAL, US-CENTRAL1, acceso uniforme y prevención de acceso público correctos |
| Roles runtime | Cuatro permisos Firestore y dos Storage con la condición exacta `users/`, correctos |
| Política de la SA | `accountPolicy` ahora **observado**, con el POST corregido |
| Desplegador | `cloudfunctions.functions.setIamPolicy` e `iam.serviceAccounts.actAs` confirmados |
| Auditoría global | **Incompleta**: `complete:false`; acceso efectivo runtime sin probar, identidad de build sin identificar |

**No hay un cambio de los roles IAM actuales justificado por estos resultados.**
Se conservan roles, bindings y condición del runtime y los permisos confirmados del
desplegador. La propuesta adicional de primer HTTPS no requiere un grant nuevo:
el operador ya tiene ese permiso. La posible concesión temporal de impersonación
para una prueba futura es independiente, solo si falta al operador; no amplía los
roles del runtime ni es un requisito nuevo de la aplicación.

La aprobación directa comprueba las asignaciones/condición y parámetros observados.
No demuestra todavía que `objects.create/get` funcionen con la identidad runtime,
ni evalúa herencia, grupos, deny/PAB, App Check positivo o el despliegue completo.
No se presenta como una aprobación global de IAM ni como autorización de deploy.

### APIs deshabilitadas y orden de preparación autorizado posteriormente

| Consulta del propietario | API | Estado informado / lo que no se puede concluir |
| --- | --- | --- |
| `function` | `cloudfunctions.googleapis.com` | HTTP 403, **SERVICE_DISABLED**; existencia de funciones no verificada |
| `buildDefault` | `cloudbuild.googleapis.com` | HTTP 403, **SERVICE_DISABLED**; ejecutor de build desconocido, no ausente |
| `deployerRun` | `run.googleapis.com` | HTTP 403, **SERVICE_DISABLED**; no demuestra ausencia del servicio ni falta del permiso sobre el recurso futuro |

La razón SERVICE_DISABLED ya identifica el bloqueo de consulta comunicado; no se
atribuye por defecto a roles insuficientes. **No se habilitó ninguna API desde esta
PR.** Estado de `iamcredentials.googleapis.com` y `artifactregistry.googleapis.com`
no proporcionado en este informe: comprobarlo primero con lectura de Service Usage
o Console, sin clasificarlas como deshabilitadas por asociación.

Preparar dos autorizaciones separadas, siempre para `fullhouse-staging`:

1. **Prueba mínima runtime:** verificar Firestore/Storage ya observados e IAM
   Credentials. Autorizar habilitar **solo IAMCredentials si falta**, más la
   impersonación temporal si es necesaria y la ejecución sintética descrita abajo.
   Esta prueba directa de SDK no necesita habilitar Functions, Cloud Build ni Run,
   crear un builder, desplegar una función o abrir el backend.
2. **Primer despliegue cerrado, después:** revisar las APIs activas y solicitar
   autorización de habilitaciones pendientes. Orden operativo propuesto:
   **Artifact Registry si falta → Cloud Build → Cloud Run → Cloud Functions**.
   Es un orden para inspeccionar dependencias, no una garantía de que no se activen
   dependencias adicionales. Revisar los cambios propuestos antes de aceptarlos.
   Tras habilitar Build, repetir su consulta y distinguir el default candidato del
   ejecutor realmente seleccionado; revisar fuentes, repositorio, logs y agentes.
   Tras Run/Functions, repetir el auditor y revisar los estados que sigan desconocidos.

Solo un operador con autorización para habilitar servicios debe realizar esas
acciones. No conceder serviceusage.services.enable al runtime ni usar Owner/Editor
como solución. Habilitar APIs puede provisionar identidades administradas: revisar
sus roles concretos sin trasladarlos al runtime. No ejecutar deploy/dry-run para
que el CLI active dependencias automáticamente. No crear un recurso o relajar el
auditor únicamente para obtener `complete:true` antes del primer despliegue.

Las habilitaciones no autorizan builds, funciones, repositorios o acceso de usuarios.
Esos recursos, los logs y las escrituras sintéticas pueden consumir cuota/coste y
retener datos; mantener alertas de ~100 MXN, que no son un tope de gasto. No se
deshabilitan APIs automáticamente como mecanismo de limpieza/reversión.

### Siguiente paso mínimo: autorización limitada de prueba sintética

Antes de ejecutar nada, el propietario debe aprobar conjuntamente el alcance:

1. Comprobar IAMCredentials y el permiso **`iam.serviceAccounts.getAccessToken` del
   operador sobre** `fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com`.
   Consultar `deployer.runtimePermissions`/política de SA con lectura; tener actAs
   no implica getAccessToken. Si ya está concedido adecuadamente, **no añadir roles**.
2. Si falta, autorizar un rol personalizado de **un solo permiso getAccessToken**
   y un binding **solo sobre esa SA y para el operador elegido**, nunca sobre todo
   el proyecto ni sobre el runtime como beneficiario. Añadir condición temporal
   `request.time < timestamp("FECHA_RFC3339_APROBADA")`, por ejemplo una ventana de
   30 minutos, y registrar el binding exacto y los accesos previos. No usar Token
   Creator a nivel proyecto, Owner/Editor ni claves privadas JSON.
3. Autorizar explícitamente ejecutar el probe con Node 22 y un UUID conservado:
   dos revisiones/recibos, metadata con acceso disabled y un PNG sintético 1×1.
   La prueba negativa podría dejar un archivo diminuto fuera de `users/` si IAM
   estuviera demasiado abierto. Conservar resultados/fase/recibos y datos de prueba;
   no borrar ni reintentar con identidades nuevas automáticamente. El comando de
   la sección 2 sigue siendo **futuro y bloqueado**, no una instrucción para ejecutarlo ahora.
4. Tras la prueba, retirar **solo el binding temporal añadido**, conservando roles
   y permisos anteriores. Si el rol personalizado se creó exclusivamente para
   este ensayo, su retirada posterior requiere comprobar que no tenga otros usos;
   eliminar el binding basta para retirar esa concesión. No sobrescribir políticas
   IAM completas ni deshabilitar la SA runtime como rutina de cierre.

Los tokens de IAMCredentials duran **900 segundos** y permanecen en RAM.
Retirar/expirar el binding impide nuevas emisiones bajo esa concesión, **no revoca
instantáneamente tokens ya emitidos**. Cerrar el proceso y dejar vencer esos tokens;
verificar después la retirada con lectura de IAM. Si existían otros grants de
impersonación, este retiro no los elimina ni demuestra revocación global.
No se comparte ni guarda ningún token en Git o ChatGPT. Esta autorización no
incluiría deploy, activación de usuarios o cambio de `remoteEnabled`.

**PR #26 puede fusionarse como preparación desactivada.** Se mantienen
`deploymentAuthorized:false`, `remoteEnabled:false`, cliente `enabled:false` y sin
conexión al Planner. Esta actualización es solo documental, sin API/IAM/recursos,
probe real, merge ni deploy. El siguiente paso es solicitar esa autorización mínima,
no habilitar primero toda la infraestructura de despliegue.

Verificación local de esta actualización: Codex repitió **17/17** pruebas IAM con
Node **24.22.1**, comprobó el rechazo del hook incluso con variable de consentimiento
y verificó las tres banderas apagadas. No repitió la suite general ni la auditoría
real. Los 592 aprobados/6 TODO de la repetición de Cloud Shell siguen atribuidos al
propietario. Código, dependencias, IAM propuesto y configuración idénticos a `a7d56d2`.

## Revisión anterior: instalación y primera auditoría del propietario (histórico)

Informe recibido el **25 noviembre 2026**, misma rama. El propietario ejecutó
la auditoría real en Cloud Shell: confirma proyecto/SA correctos, rol Firestore
de cuatro permisos sin condición, rol Storage de dos permisos con condición
`users/` exacta, base Standard/Native `(default)` us-central1, acceso uniforme y
prevención de acceso público. El desplegador tiene
`cloudfunctions.functions.setIamPolicy` e `iam.serviceAccounts.actAs`.
No se proporcionó SHA del ensayo ni código de salida completo de la auditoría;
no se atribuye a Codex esta consulta real.

El único issue de `directPolicy:review-required` era la clase del bucket:
`fullhouse-staging.firebasestorage.app`, `US-CENTRAL1`, **REGIONAL**, acceso uniforme
true, public access prevention `enforced`, soft delete **604800 s = 7 días**.
REGIONAL es la [clase heredada equivalente a Standard regional](https://cloud.google.com/storage/docs/storage-classes).
La validación admite ahora STANDARD o REGIONAL, **solo con la misma región/nombre
y privacidad exigidos**. No admite MULTI_REGIONAL, NEARLINE, COLDLINE o ARCHIVE,
ni convierte valores del bucket real. Se conservan los metadatos originales.
Soft delete se informa sin modificarlo; puede retener/cobrar bytes tras un borrado.

### Consultas no verificadas: diagnóstico y corrección

| Observación del propietario | Investigación de Codex / resultado |
| --- | --- |
| `accountPolicy:404` | **Defecto del auditor:** usaba GET. El endpoint oficial `projects.serviceAccounts.getIamPolicy` requiere **POST**, con `options.requestedPolicyVersion=3` en query y cuerpo vacío. Corregido y cubierto por regresión. Ese 404 no prueba ausencia de cuenta/política |
| `function:403` | GET v2 y formato de recurso son correctos; la existencia de la función sigue desconocida. Puede faltar API/permisos de consulta u otra condición. Tener setIamPolicy no demuestra tener functions.get |
| `buildDefault:403` | GET `projects/.../locations/us-central1/defaultServiceAccount` es correcto. No confirma ausencia de builder. La API Build/permisos deben comprobarse; su default, si se obtiene, sigue siendo solo candidato para Functions |
| `deployerRun:403` | POST v2 `services/remotev1:testIamPermissions` es correcto. No demuestra ausencia del futuro servicio ni carencia global de permisos; la API, IAM y el recurso aún requieren revisión |

Se contrastaron métodos/rutas con los Discovery oficiales públicos de
[IAM](https://raw.githubusercontent.com/googleapis/discovery-artifact-manager/master/discoveries/iam.v1.json),
[Functions](https://raw.githubusercontent.com/googleapis/discovery-artifact-manager/master/discoveries/cloudfunctions.v2.json),
[Build](https://raw.githubusercontent.com/googleapis/discovery-artifact-manager/master/discoveries/cloudbuild.v1.json)
y [Run](https://raw.githubusercontent.com/googleapis/discovery-artifact-manager/master/discoveries/run.v2.json).
No se ha repetido la consulta real desde Codex: no hay sesión gcloud disponible.

Antes del primer deploy es posible que todavía no haya función/servicio Run;
**los 403 no acreditan esa ausencia ni son una aprobación del estado previo**.
Una consulta de función inexistente con API/acceso válidos normalmente devuelve
404; no normalizar el 403 como “todavía no desplegado”. Si el POST de la SA queda
denegado, revisar `iam.serviceAccounts.getIamPolicy` del inspector sobre esa cuenta,
no añadir permisos al runtime para conseguir que el auditor administrativo lea.
La respuesta inicial no incluía la causa detallada. Al repetir, el auditor conserva
solo códigos seguros de `google.rpc.ErrorInfo` (`reason`, p. ej. SERVICE_DISABLED o
IAM_PERMISSION_DENIED), estado RPC y servicio coincidente con el endpoint. Omite
mensajes/metadata arbitraria y credenciales. Los estados permanecen `unknown`;
no habilita APIs ni amplía roles para resolverlos. Un 404 que persista tras el
POST corregido también debe investigarse, sin asumir que la cuenta no existe.
La política de la SA describe quién puede actuar sobre ella/impersonarla, no los
roles que la SA tiene sobre Firestore o el bucket.

### Instalación limpia y runtimes

El propietario informó **Node 22.23.5/npm 10.9.9**, `npm ci` con EUSAGE:
`Missing: @grpc/grpc-js@1.9.16 from lock file`, además de avisos de engines.
Codex reprodujo ese mismo fallo en un directorio temporal sin node_modules.

- **Raíz/web/herramientas: Node >=24.15.0 <25.** El SDK Web Firebase **13.4.0** y
  varios `@firebase/*` exigen >=24.12; el lock de herramientas nativas (re2/node-gyp)
  eleva el mínimo común a **24.15**. `package.json`/lock ahora lo declaran. No se
  cambia el SDK web ni su código servido. Node del compilador no es el runtime
  de la función, y no fija la versión de navegador de los usuarios.
- Se conserva `@grpc/grpc-js` **1.14.7**, pero el override pasa de estar limitado al
  padre `firebase` a ser global en la raíz. Con npm 10 el grafo compartido intentaba
  resolver además 1.9.16; el pin global alinea la resolución con el lock existente.
  **Ninguna versión resuelta de la raíz cambió.** No se añade gRPC 1.9.16 ni se usa
  `--force`/`--legacy-peer-deps` para omitir el problema.
- **Backend/Functions: Node 22**, Admin **14.5.1**, Functions SDK **7.4.0** y SDKs
  Firestore/Storage sin cambios. La instalación estricta reveló que el lock del
  backend también contenía database-compat 2.1.8/database 1.1.6, que requieren
  Node 24. Se fija únicamente `@firebase/database-compat:2.1.7` dentro del rango
  `^2.1.4` declarado por Admin; usa database **1.1.5**, ambos compatibles con Node 22.
  Esos dos paquetes se reubican bajo Admin en el lock. Ningún otro paquete cambia
  de versión. Realtime Database no se usa ni se activa; el ajuste evita declarar
  soporte basándose en ignorar engines de módulos no utilizados.

Dos pruebas de contrato recorren los engines de los locks: mínimo publicado de la
raíz y Node 22.23.5 del backend. Fallaron antes del ajuste y comprueban que una
regeneración futura no introduzca silenciosamente paquetes incompatibles.

Para repetir en Cloud Shell (nvm o equivalente, sin credenciales JSON):

```sh
# Instalación y pruebas web/herramientas. Elegir una versión 24 >=24.15.
nvm use 24
node --version
npx --yes npm@10.9.9 ci --engine-strict
npm run check
npm run test:remote-staging:iam
npm test
npm run audit:remote-staging:iam -- --run

# Backend independiente: conservar Functions en Node 22.
nvm use 22
node --version
npx --yes npm@10.9.9 ci --prefix remote --engine-strict
npm run check:remote-staging:node22
```

Si esa versión de Node no está instalada, instalarla primero con nvm según la
política del equipo. No alternar instalaciones web de la raíz en Node 22 para
silenciar avisos. El CLI/hook de despliegue posterior sigue exigiendo Node 22;
este cambio no relaja el gate ni ejecuta deploy. Verificar el SDK cerrado no es
una autorización para desplegar. **No ejecutar todavía `probe --run`**, ni cambiar
flags, permisos, APIs o configuración del bucket.

### Evidencia nueva de Codex: instalación realmente limpia

Se copiaron los archivos fuente rastreados con sus cambios a un directorio temporal
sin `.git`, configuraciones locales, credenciales ni `node_modules` de raíz/backend.
Se ejecutó npm **10.9.9** directamente con cada binario Node. Se permitió la caché
normal de tarballs de npm, **no** módulos instalados anteriores. No se omitieron
scripts/engines ni dependencias para aparentar compatibilidad.

| Comprobación en la copia limpia | Resultado |
| --- | --- |
| `npm ci --engine-strict`, raíz, **Node 24.22.1** | Salida **0**, sin EBADENGINE/EUSAGE |
| `npm ci --prefix remote --engine-strict`, **Node 22.23.5** | Salida **0**, sin EBADENGINE/EUSAGE |
| `npm run test:remote-staging:iam`, Node 24.22.1 | **17/17**, 0 fallos |
| `npm test`, Node 24.22.1 | **592 aprobadas, 0 fallos, 6 TODO**, 598 casos; incluye dos contratos de engines |
| `check`, `check:remote`, `check:remote-client`, `check:history-contract` | Correctos |
| `build:staging:emulator` | Correcto, solo artefacto local demo; no Hosting ni Firebase real |
| `check:remote-staging:node22` con dependencias backend recién instaladas | Correcto: SDK cerrado y HTTP loopback 401; sin llamadas a Firebase real |

El CLI 15.37.0 se pudo cargar con Node 22 desde la instalación limpia. La primera
consulta local `--version` terminó con salida 2 por el updater intentando escribir
en `/home/agent/.config`, restricción de este entorno; al usar `XDG_CONFIG_HOME`
temporal y `CI=1`, terminó correctamente. No se cambió el CLI ni se ejecutó deploy.
No se probaron ni aprobaron sus operaciones reales de despliegue.

Las regresiones de REGIONAL/POST fallaron antes de corregir el auditor; los contratos
de engines también reprodujeron los paquetes backend incompatibles y el mínimo
insuficiente de la raíz. Esas pruebas quedan activas. La evidencia anterior Node 22
de la primera entrega se conserva abajo como histórica, no como prueba de que todos
los engines del lock anterior fueran compatibles.

**Estado de aprobación en aquella revisión (superado por el cierre de PR #26):** con los metadatos aportados, el bucket REGIONAL y los
roles directos son compatibles con la propuesta. Los fixtures corregidos lo
comprueban. La auditoría completa **sigue parcial** hasta repetir el POST correcto
y aclarar las consultas desconocidas. Acceso efectivo con runtime, builder real y
políticas heredadas siguen sin demostrarse; la prueba con escrituras requiere
autorización separada. No se declara aprobado un deploy.

## Estado inicial aportado por el propietario

Para `fullhouse-staging`, el propietario confirma Blaze, presupuesto aproximado
**100 MXN/mes con alertas**, Firestore `(default)` Standard/Native us-central1,
bucket `fullhouse-staging.firebasestorage.app` Standard us-central1, reglas deny-all,
acceso uniforme y prevención de acceso público aplicada. Confirma App Check Web
con Fraud Defense/reCAPTCHA Enterprise y la cuenta runtime
`fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com` con los dos
roles personalizados previstos: Firestore en proyecto y Storage en bucket con
condición de prefijo `users/`.

Es **informe del propietario**, no inspección ni prueba IAM ejecutada por Codex.
Actualiza el estado histórico de 3C.2 (billing apagado/sin buckets en aquel momento).
Ese informe inicial no demostraba permisos efectivos, edición/localización
observadas por API, configuración completa de App Check, soft delete o builder.
La auditoría posterior del cierre arriba sí acredita recursos/asignaciones directas;
el acceso efectivo y la identidad de build permanecen pendientes.
100 MXN es el presupuesto comunicado, no una conversión garantizada de 5 USD ni
un límite duro de gasto. No se activó ni modificó billing desde esta PR.

## Permisos runtime: trazabilidad al código

| Permiso | Operaciones reales que lo requieren |
| --- | --- |
| `datastore.databases.get` | Transacciones de Firestore: begin/commit/rollback usados por `runTransaction` |
| `datastore.entities.get` | `doc.get`, `tx.get/getAll`: head, revisión base, recibo, control, acceso/cuota, reservas, derechos e inventario de imágenes |
| `datastore.entities.create` | Revisiones/recibos inmutables, reservas, primeras filas head/cuota/inventario |
| `datastore.entities.update` | Head, contadores y metadata/inventario dentro de las TX |
| `storage.objects.create` | `file.save`, no resumable y `ifGenerationMatch:0`: instantáneas v1 y fuentes fotográficas privadas |
| `storage.objects.get` | `file.getMetadata/download`: tamaño, bytes/hash, exportación/lectura/restauración y verificación de reintentos |

Referencias: `remote/service.cjs`, `remote-staging/policy.cjs` y `media.cjs`.
No hay query/list/watch/borrado de entidades ni listado/borrado de archivos en el
backend. `storage.buckets.get/getIamPolicy` y permisos de roles pertenecen a la
auditoría administrativa, no al runtime. **No se identifica un permiso adicional
de runtime justificado por el código actual**; no se amplían los cuatro/dos.

Esto es suficiencia **estática candidata**, no prueba efectiva en Firebase real.
APIs deshabilitadas, IAM heredado, deny/PAB, requester-pays/cuota de proyecto,
credenciales o evaluación CEL pueden cambiar el resultado. Ante un 403, identificar
servicio/fase/permiso concreto; no resolverlo concediendo Owner/Editor/Admin general.

La condición requerida es exactamente:

```text
resource.name.startsWith("projects/_/buckets/fullhouse-staging.firebasestorage.app/objects/users/")
```

La auditoría verifica sintaxis y ubicación del binding con policy version 3.
**No prueba por sí sola su evaluación en `objects.create/get`.** Tampoco sirve un
`testIamPermissions` sobre el recurso bucket para demostrar un permiso condicional
de objeto. La comprobación sintética descrita abajo ejecuta las llamadas reales.
El prefijo separa el bucket, no los UIDs entre sí: IAM permite al runtime todo
`users/`; código del servidor debe imponer la cuenta. Firestore IAM de proyecto
tampoco separa colecciones/UIDs, incluidos controles/derechos. Reglas cliente deny-all
no restringen al Admin SDK. Los tests de aislamiento 3C.1/3C.2 siguen siendo necesarios.

## 1. Auditoría sin cambios, ejecutable ahora por el propietario

Cloud Shell, toolchain web Node 24.15+ (rama 24) y repositorio en esta rama:

```sh
npm ci
npm run audit:remote-staging:iam
npm run audit:remote-staging:iam -- --run
```

Sin argumentos muestra el plan, sin red. `--run` obtiene un token de la sesión
local gcloud en RAM; no lo imprime/guarda ni pide claves JSON. Proyecto, número,
base, bucket y runtime están fijados. Hace GET de metadata/roles/políticas y POST
**exclusivamente** `getIamPolicy`/`testIamPermissions`, ambos de lectura; nunca
setIamPolicy, enable, create o impersonación. La sesión es la del inspector, no se
presenta como runtime. No se leen documentos/fotografías ni se imprimen otros
miembros de IAM; el reporte del policy de la SA muestra roles y cantidades.

Verifica identidad/número del proyecto, cuenta habilitada, definición de permisos
de los roles realmente vinculados (no sus títulos), políticas proyecto/bucket,
condición exacta, región/edición/clase/privacidad, permisos de la credencial
inspectora y bindings visibles de service agents. Roles con permisos extra,
deshabilitados, grants públicos u otros grants directos exigen revisión. No sigue
roles de otro proyecto. IAM devuelve por defecto `disabled:false` si se omite el
booleano; una cuenta deshabilitada explícitamente no pasa.

Herencia de organización/carpeta, grupos, deny/PAB y permisos efectivos completos
quedan **sin evaluar**. Un resultado `matches-minimal-proposal` no autoriza un
deploy ni certifica aislamiento. Un 403/404, error o metadata ausente se conserva
como **desconocido**; no se habilitan servicios para suplirlo. `complete:false` o
salida 2 requieren revisar cada causa; metadata de una función aún no observable
puede ser desconocida antes del primer deploy y no prueba un fallo de roles runtime.
El auditor no exige crear una función para completar esa observación opcional.

El inspector necesita lectura de proyecto/roles/SA/políticas de proyecto y bucket
y metadata de servicios; no son permisos a agregar al runtime. Si falta lectura,
un operador autorizado puede inspeccionar en Console. No se crean roles para
ampliar automáticamente a la cuenta inspectora.

## 2. Prueba efectiva preparada, autorización independiente pendiente

`npm run probe:remote-staging:runtime` muestra solo el plan. **No se ejecutó** con
recursos reales en esta entrega. `--run` exige autorización literal separada,
UUID v4 conservado para reintentos, Node 22, staging cerrado y ningún emulador,
debug, proyecto cruzado o credencial de archivo. No activa backend/cliente/deploy.

Tras autorización expresa del propietario para estas escrituras sintéticas:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  FULLHOUSE_AUTHORIZE_IAM_PROBE=fullhouse-staging \
  npm run probe:remote-staging:runtime -- --run --run-id UUID-V4-RESERVADO
```

La variable se aplica solo al proceso; no borra archivos. El operador necesita
`iam.serviceAccounts.getAccessToken` **sobre esta SA**, y IAMCredentials API
disponible. Si no lo tiene, solicitar aprobación para un permiso temporal acotado
(rol personalizado de un permiso sobre la SA), no Owner/Editor ni claves JSON.
Es un requisito de la prueba, **no** del runtime ni del deploy ordinario. Autorizar
separadamente la habilitación de API si falta; no conceder Token Creator en todo
el proyecto como solución rápida. Retirar el grant temporal tras la prueba con
autorización del propietario.

IAMCredentials emite un token runtime de **900 s**, solo RAM. Firestore/Storage
reciben ese mismo auth explícito, sin fallback a ADC/credenciales del operador.
La prueba usa el servicio v1 reutilizado con un UID reservado `iam_probe_<UUID>`,
dos IDs de operación estables y un PNG sintético 1×1. No crea un usuario Auth real.

Comprueba reads de controles/derechos/inventario, TX de scratch/acceso **enabled:false**,
dos revisiones con head/recibos, creación/lectura/verificación de bytes fotográficos,
reintento inmutable, CAS y rollback. Conserva metadata scratch aparte del inventario
de producto. No concede Premium ni escribe un control enabled:true. Es prueba IAM
del servicio/SDK, **no** prueba positiva de App Check/Auth ni del flujo Premium.

Comprueba rechazo **403** de create/get fuera de `users/` y list del bucket limitado
al prefijo sintético. Un 404 no se cuenta como denegación demostrada. Si IAM está
demasiado abierto, la prueba negativa de create puede dejar un archivo diminuto
en `iam-probe-outside/<UUID>.txt`: falla y lo conserva para limpieza explícita.
Este efecto está incluido en la autorización necesaria. No ejecuta DELETE ni limpia
revisiones/archivos automáticamente. Podrían quedar datos tras un fallo parcial;
conservar UUID, fase y recibos. Un acuse perdido no prueba rollback. Reintentar con
el mismo UUID recupera los mismos IDs; no generar otro automáticamente.

## 3. Desplegador e identidades administradas

| Identidad | Necesidad / revisión mínima, sin asignación automática |
| --- | --- |
| Desplegador | Cloud Functions Developer como base a revisar; permisos de API/metadata y subida de fuente requeridos por CLI, y `iam.serviceAccounts.actAs` solo sobre runtime (y build si se selecciona explícitamente). No dar roles de datos runtime al humano para evitar un fallo de deploy |
| Nuevo HTTPS con Firebase CLI **15.37.0** | `checkHttpIam` en `deploy/functions/checkIam.js` comprueba **`cloudfunctions.functions.setIamPolicy` a nivel proyecto** para endpoints nuevos gcfv2. El rol Run de tres permisos de 3C.1 no cubre esa comprobación. Se añade a `iam.json` una **propuesta**, no un grant, de un permiso para el operador. Otorgarlo solo si la auditoría confirma que falta y el propietario lo autoriza; no al runtime |
| Política del servicio Run | `run.services.get/getIamPolicy/setIamPolicy` de la propuesta previa; acotar al servicio/condición cuando sea compatible. Un servicio inexistente y un test a nivel proyecto no demuestran que un binding condicionado funcione tras crear el recurso; revisar ese alcance antes del primer deploy |
| Functions service agent | `service-664973716762@gcf-admin-robot.iam.gserviceaccount.com`: revisar el rol gestionado `roles/cloudfunctions.serviceAgent` y su acceso a fuentes/build/runtime. No asignarlo al runtime ni al desplegador |
| Cloud Build service agent | `service-664973716762@gcp-sa-cloudbuild.iam.gserviceaccount.com`: revisar `roles/cloudbuild.serviceAgent`, separado del ejecutor de builds |
| Ejecutor de build | **No asumir** que sea `664973716762@cloudbuild.gserviceaccount.com`: puede ser Compute por defecto o una SA dedicada. Auditor consulta default de Build y buildConfig de función si es accesible. Default es candidato, no prueba de la siguiente selección. Revisar permisos de leer bucket de fuentes, escribir/leer repositorio AR y escribir logs; roles acotados propuestos `storage.objectViewer` sobre fuentes, `artifactregistry.writer` sobre repositorio, `logging.logWriter`. Validar contra el ejecutor elegido; no asignar Editor al Compute por defecto |
| Run service agent | `service-664973716762@serverless-robot-prod.iam.gserviceaccount.com`: revisar rol gestionado `roles/run.serviceAgent` y lectura de imagen necesaria, separado de runtime/build |

Este callable no incorpora triggers Eventarc/PubSub ni schedulers. La revisión
posterior del CLI **15.37.0** comprobó que su bootstrap de cualquier gcfv2 sí
solicita APIs e identidades Eventarc/PubSub, incluso HTTP: deben revisarse y
autorizarse expresamente antes del deploy, sin añadir permisos de triggers al
runtime. Véase el [hallazgo y regresión](COMMERCIAL_CLOSED_FUNCTIONS.md#3-preflight-de-solo-lectura-y-bloqueo-restante).
No se concede `resourcemanager.projects.setIamPolicy` al desplegador para que el
CLI arregle roles: el propietario debe revisar/preparar los bindings concretos.
El CLI puede intentar habilitar APIs y ajustar IAM al preparar un deploy;
**no usar deploy/dry-run como auditoría de solo lectura**. Tampoco crear SA/roles
de declarative security: este codebase usa su identidad explícita existente.

El callable tiene `invoker:'public'`: “cerrado” significa lógica remota desactivada,
no red privada. SDK exige Auth/App Check y el flag cierra antes de Admin. La política
HTTPS de invocación puede requerir `allUsers` en ese servicio, **nunca en datos**.
Si una política de organización lo impide, es un bloqueo a revisar: no desactivar
restricciones de organización ni sustituirlas con Owner/Editor automáticamente.

## 4. Preparación y activación del primer deploy cerrado

1. Propietario ejecuta auditoría, confirma roles/condición y resuelve desconocidos.
   Autoriza y ejecuta la prueba IAM sintética, o deja documentado como bloqueo
   pendiente su acceso efectivo. Validar operador, builder real y service agents.
2. Revisar APIs necesarias: Firestore, Storage, Functions, Run, Build, AR, App Check
   e IAMCredentials solo para la prueba. El propietario autoriza habilitaciones o
   grants faltantes por separado; no se ejecutan en esta PR. Confirmar tarifas,
   alertas 100 MXN y retención/soft delete/build sources/artefactos.
3. Seguir la instalación separada de raíz (Node 24.15+) y backend (Node 22) indicada
   arriba, ejecutar checks y `npm run prepare:remote-staging:closed`. Genera artefacto privado con hashes,
   comprueba cierre y rechaza `.env` de activación; no altera flags ni despliega.
4. **Pedir autorización expresa de despliegue** sobre SHA/artefacto/identidades.
   Esta PR conserva `deploymentAuthorized:false`; incluso con variables de
   consentimiento el hook rechaza deploy. Tras aprobación, una modificación
   revisada posterior cambiará solo ese permiso local a true y reconstruirá el
   artefacto. `remoteEnabled:false`, cliente apagado y allowlist vacía permanecen.
5. Solo entonces, sesión del desplegador autorizado, sin credenciales JSON, usando
   proyecto fijo y seleccionando **únicamente Functions del codebase**:

   ```sh
   env GCLOUD_PROJECT=fullhouse-staging \
     FULLHOUSE_AUTHORIZE_STAGING_DEPLOY=fullhouse-staging \
     npx firebase deploy --project fullhouse-staging \
       --config firebase.remote-staging.json --only functions:remote-staging-v1
   ```

   **No ejecutar ahora:** sigue bloqueado. No usar `--force`. No desplegar reglas,
   Hosting/Pages, no conceder roles a demanda ni borrar funciones inesperadas.
   Revisar cualquier prompt/cambio fuera del codebase antes de continuar.

## 5. Validación posterior y reversión

- Inspeccionar función/Run: us-central1, Node 22, SA runtime exacta, ejecutor de
  build, min 0/max 1, concurrencia 1, memoria/CPU/timeout preparados. Registrar
  build ID, imagen/revisión, SHA aprobado y hash del artefacto; comprobar env sin
  activación, sin imprimir secretos. No confundir éxito del CLI con prueba de IAM.
- Llamada sin credenciales/App Check debe ser rechazada por SDK; un 401 demuestra
  esa barrera, **no** que se ejercitó el flag de backend cerrado. Si se prepara una
  prueba con Auth/App Check válidos, esperar UNAVAILABLE sin acceso Admin/datos;
  si esos tokens no están disponibles, dejar la comprobación como pendiente.
  No pedir/pegar tokens en ChatGPT ni incluirlos en repo/logs.
- Verificar deny-all de datos y que el Hosting actual siga local. No crear accesos,
  grants Premium, controles enabled:true ni conectar el adapter. Ensayo positivo
  con usuarios ficticios requerirá otra autorización.
- Ante fallo: detenerse y conservar salida controlada/fase/build/recibos. Primera
  instalación puede dejar Run/build/AR/fuentes aunque falle. No hay versión anterior
  a la cual volver ni rollback automático de datos. El backend permanece cerrado;
  no bajar validaciones para conseguir deploy.
- Revertir futuras autorizaciones locales por PR, mantener cliente/backend apagados;
  si hace falta otro deploy o retirar solo la función nueva, solicitar permiso.
  No tocar base/bucket ni limpiar datos, fuentes de builds, logs o artefactos sin
  revisión. Runtime no recibe delete. Retirar impersonación temporal con el dueño;
  no desvincular billing ni desactivar APIs en automático.

## Costes y evidencia

Un deploy cerrado todavía puede consumir **Cloud Build**, guardar imágenes AR y
fuentes en Storage, producir logs y crear infraestructura Run/Functions. min 0 no
garantiza coste cero. Tests de IAM consumen llamadas Firestore/Storage y pueden
dejar unos pocos archivos sintéticos; los accesos pueden generar audit logs.
Soft delete/retención y versiones de artefactos pueden seguir cobrando después.
App Check/reCAPTCHA e invocaciones rechazadas tampoco se presuponen gratuitas.
Las alertas de ~100 MXN tienen retraso y no detienen automáticamente el gasto.

Referencias oficiales: [Firestore IAM](https://cloud.google.com/firestore/native/docs/security/iam),
[Storage permisos](https://cloud.google.com/storage/docs/access-control/iam-permissions),
[condiciones](https://cloud.google.com/storage/docs/access-control/iam-conditions),
[Functions IAM](https://cloud.google.com/functions/docs/concepts/iam),
[build identity](https://cloud.google.com/functions/docs/securing/build-service-account).
El proxy de este entorno rechazó esas páginas con **403**. No se inventan tarifas
vigentes ni se certifican permisos reales. Se inspeccionaron SDKs y CLI fijados;
la fuente oficial pública `googleapis/googleapis/google/firestore/v1/firestore.proto`
fue accesible para contrastar RPCs, no para demostrar un grant IAM.

Codex: pruebas específicas con HTTP/puertos simulados y construcción de SDK sin
red. Auditor real no ejecutado: sin gcloud/sesión local, salida 2 antes de consultar.
Prueba efectiva real **no ejecutada ni autorizada**; preparación cerrada solo local.
Los resultados de emuladores de 3C.2 informados por el propietario (3/3 y 4/4) se
conservan y no acreditan IAM.

| Verificación inicial de 3C.3, anterior a esta revisión, Node 22.23.5 | Resultado histórico |
| --- | --- |
| `npm run test:remote-staging:iam` | **14/14**; repetida tras los últimos ajustes de salida/informe |
| `npm test` | **587 aprobadas, 0 fallos, 6 TODO** (593 casos); incluye 22 preflight y 17 staging anteriores |
| `npm run check` | TypeScript y app.js sincronizados; sin escribir archivos |
| `npm run check:remote` | Validador compartido idéntico a v1 público y sintaxis correcta |
| `npm run check:remote-client` | Tipos correctos |
| `npm run check:history-contract` | Tipos correctos, v2 aislado |
| `npm run check:remote-staging:node22` | SDK gcfv2 cerrado y HTTP loopback 401 sin tokens, sin acceso a servicios reales |
| `npm run prepare:remote-staging:closed` | Artefacto/hash preparados localmente; deploy/backend/cliente siguen false |

No se repitieron suites de emuladores ni navegador: esta entrega no cambia backend
v1, reglas, UI o persistencia; los tests nuevos prueban herramientas preparatorias.
No se declara resuelto BUG-05 ni se activa v2.
Firefox/WebKit/dispositivos físicos y Functions desplegado no probados aquí.

**Bloqueos actualizados antes de desplegar:** autorización de APIs pendientes (Functions,
Build y Run informadas SERVICE_DISABLED; también revisar bootstrap del CLI),
build elegido/agentes y resto de acceso administrativo, políticas
organizativas/URLs públicas, retención/costes, autorización explícita y cambio
revisado del gate. El POST de accountPolicy **ya fue observado correctamente**;
primer HTTPS y actAs del runtime también confirmados. No justifican grants nuevos.
Las asignaciones directas están aprobadas en su alcance; la auditoría global sigue
incompleta. PR #26 se fusionó como preparación desactivada. El probe del propietario
ya aporta evidencia efectiva de la condición en el ensayo; no repetirlo ni ampliar
roles por inercia. La preparación siguiente mantiene bloqueado el deploy.
