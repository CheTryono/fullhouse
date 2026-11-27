# Comercial · preparación del primer despliegue cerrado de Functions

Estado al **26 de noviembre de 2026**, base `f196350` (PR #26 fusionada).
Rama `feat/commercial-closed-functions-readiness`. **Preparación revisable, sin
despliegue, habilitación de APIs, cambios IAM ni limpieza de datos.**
`deploymentAuthorized:false`, `remoteEnabled:false` y cliente `enabled:false`
continúan vigentes. Planner público sigue local/v1, sin motor histórico v2.

## 1. Evidencia real del propietario

El propietario ejecutó el probe en Google Cloud Shell sobre `f196350`, con Node
**22.23.5** / npm **10.9.9** y `npm ci --prefix remote --engine-strict` correcto.
Proporcionó el registro existente: **no es una ejecución ni inspección de Codex**.

| Dato | Resultado comunicado |
| --- | --- |
| Estado | `SYNTHETIC_IAM_PROBE_PASSED` |
| Proyecto / identidad | `fullhouse-staging` / `fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com` |
| Run ID | `c955a4a6-a4ac-4138-a415-51efb2ce3cc9` |
| UID sintético | `iam_probe_c955a4a6a4ac4138a41551efb2ce3cc9` |
| Primera revisión / operación A | `iam_probe_c955a4a6-a4ac-4138-a415-51efb2ce3cc9_a` |
| Segunda revisión / operación B | `iam_probe_c955a4a6-a4ac-4138-a415-51efb2ce3cc9_b` |
| Recibo confirmado | B, `sequence:2`, `baseRevision:A` |
| Hash de respaldo del recibo | `95e2f8aaa207c29e15dde2243417db9b707ac5ac39072ba99242a03e48b94ccd` |

Se comprobaron lecturas de controles, transacción, dos revisiones con fotografía,
recibos, reintento idempotente, conflicto obsoleto, rollback y denegaciones de
crear/leer fuera de `users/` y listar objetos. Esto aporta evidencia efectiva de
los **cuatro permisos Firestore y dos Storage con condición** en ese ensayo; no
justifica ampliar los roles runtime actuales. No certifica IAM global/herencia,
Auth/App Check del endpoint, Premium, capacidad, carga, costes o el despliegue.

El propietario confirmó retirar la asignación temporal **Fullhouse Staging Token
Probe** del operador. No se volvió a emitir un token ni ejecutar el probe aquí.
Retirar el binding impide nuevas emisiones por esa concesión; los tokens ya
emitidos duraban 900 s y no se revocan instantáneamente al retirarlo. No hace falta
volver a conceder impersonación para preparar/desplegar ordinariamente Functions.

### Datos conservados para una limpieza futura independiente

Usando el UID y A/B **exactos** de la tabla, el reporte conserva siete documentos:

- `users/{UID}/storage/head`
- `users/{UID}/operations/{A}` y `users/{UID}/operations/{B}`
- `users/{UID}/revisions/{A}` y `users/{UID}/revisions/{B}`
- `users/{UID}/mediaUsage/iam-probe`
- `stagingAccess/{UID}` (desactivado)

Prefijo Storage informado: `users/{UID}/`. El código escribe snapshots en
`users/{UID}/revisions/{A|B}.json` y evidencia direccionada por hash; enumerar y
comprobar claves/generaciones antes de una eventual limpieza autorizada. La
operación `_stale` no obtuvo un recibo confirmado. El intento negativo
`iam-probe-outside/{runId}.txt` fue denegado; no inferir una inspección de ausencia
a partir de esa denegación. **No se elimina nada en esta entrega.** Cualquier
limpieza futura necesita alcance aprobado, inspección, conservación del resultado
y privilegios temporales de borrado ajenos al runtime. Soft delete de siete días
puede conservar bytes/costes tras un borrado posterior.

## 2. Advertencias de listeners: investigación local

El registro de Cloud Shell muestra repetidos picos de **11 listeners `error` y
`close` en `PassThrough`**, durante descarga/verificación de revisiones. No incluye
`--trace-warnings`; no se atribuye una traza real que el propietario no proporcionó.

`npm run diagnose:storage-listeners` reproduce la misma firma con el SDK fijado
**@google-cloud/storage 8.4.0**, OAuth sintético en memoria y servidor exclusivamente
`127.0.0.1`. No usa ADC, credenciales reales, Firebase ni recursos externos.
Rechaza `STORAGE_EMULATOR_HOST` para impedir redirecciones ambientales. Ejecutar
con dependencias de `remote/` instaladas; Node 22 es la referencia del backend.

| Ensayo local de Codex | Node 22.23.5 | Node 24.22.1 |
| --- | --- | --- |
| Guardar / metadata / descargar, 20 rondas | 60 peticiones | 60 peticiones |
| Bytes y CRC32C | Correctos | Correctos |
| Cuerpo retrasado 10 ms tras headers | 40 advertencias / 20 streams | 40 advertencias / 20 streams |
| Máximo observado por evento | 11 | 11 |
| Streams observados abiertos al terminar | 0 | 0 |
| Listeners por evento en streams terminados, máximo | 8 | 8 |
| Streams recolectados tras solicitar GC | 20/20 | 20/20 |

La traza **local** señala `teeny-request/build/src/index.js:461:43`, en la composición
de pipelines de descarga. Las advertencias aparecen en streams distintos, no como
un contador acumulado en un emisor duradero. El control con cuerpo inmediato
también conserva bytes y cierre. **No se observó fuga persistente en ese ensayo**;
GC no es una garantía temporal y el diagnóstico no demuestra ausencia de fugas en
errores, cargas grandes o todos los caminos del SDK. Tampoco demuestra consumo de
memoria de un proceso desplegado.

Por tanto, **no se modifica el SDK, no se suben límites de listeners ni se
silencian advertencias**. Dos regresiones verifican datos/cierre y que los picos
permanezcan acotados en este fixture; no exigen conservar el defecto si una futura
versión lo corrige. No se reejecutó el probe real. Revisar volumen de logs y
comportamiento de errores/carga antes de activar datos de usuarios; el endpoint
cerrado no inicializa estos clientes.

## 3. Preflight de solo lectura y bloqueo restante

```sh
npm run audit:remote-staging:iam -- --plan
# Solo el propietario, con su sesión habitual y sin compartir tokens:
npm run audit:remote-staging:iam -- --run
```

El auditor añade siete GET exactos de Service Usage en el proyecto
`664973716762`: Artifact Registry, Cloud Build, Cloud Run, Cloud Functions,
Eventarc, Pub/Sub y Storage. Reporta `ENABLED`, `DISABLED` o `UNKNOWN`, comprueba
nombre canónico y devuelve salida 2 si las APIs están deshabilitadas/no verificadas,
faltan observaciones o las asignaciones directas no coinciden. **Ni salida 0 ni
`complete:true` son autorización de despliegue o aprobación global de IAM.**

Última auditoría real comunicada: asignaciones directas aprobadas, pero Functions,
Build y Run devolvieron `403 SERVICE_DISABLED`. No hay inventario posterior de esas
APIs en esta entrega. El probe prueba acceso a datos; no prueba que aquellas APIs
se hayan habilitado. Estado de AR/Eventarc/PubSub requiere lectura. Un 403/404 sigue
siendo desconocido respecto a existencia de recursos; no se crea nada para volver
el informe completo. No se ejecutó el auditor real desde Codex.

### Hallazgo del CLI que requiere autorización explícita

Firebase Tools **15.37.0**, `deploy/functions/prepare.js`, prepara Run, Eventarc,
Pub/Sub y Storage y solicita identidades de Eventarc/PubSub para **todo gcfv2**,
incluso un callable HTTP. Una regresión llama a ese método del CLI con los puertos
de habilitación/identidades sustituidos y confirma el comportamiento sin red.
Esto corrige la afirmación anterior de que el procedimiento podía omitir totalmente
Eventarc/PubSub. **La aplicación no incorpora triggers, topics ni suscripciones**,
pero el bootstrap del CLI debe estar contemplado en el consentimiento. No parchear
el CLI ni dejar que ejecute cambios no revisados. No necesita Secret Manager,
Scheduler, Tasks o nuevos servicios comerciales para este código.

## 4. Identidades y permisos que revisar

| Identidad | Comprobación mínima pendiente / evidencia |
| --- | --- |
| Runtime `fullhouse-remote-runtime@…` | Mantener los roles de datos probados. No requiere deploy, build, lista, delete ni Token Creator |
| Operador de despliegue | `cloudfunctions.functions.setIamPolicy` y actAs sobre runtime ya confirmados por propietario. Revisar permisos de creación/actualización de función, carga de fuente y política del servicio Run; no se conceden automáticamente |
| Ejecutor real de Build | **Todavía desconocido.** Default de Build es candidato, no selección confirmada. Identificarlo tras habilitar la API y comprobar la selección antes del deploy; no reutilizar el runtime |
| Functions service agent | `service-664973716762@gcf-admin-robot.iam.gserviceaccount.com`, revisar `roles/cloudfunctions.serviceAgent` |
| Build service agent | `service-664973716762@gcp-sa-cloudbuild.iam.gserviceaccount.com`, revisar `roles/cloudbuild.serviceAgent`; no confundirlo con el ejecutor |
| Run service agent | `service-664973716762@serverless-robot-prod.iam.gserviceaccount.com`, revisar `roles/run.serviceAgent` |
| Bootstrap Eventarc / PubSub | `service-664973716762@gcp-sa-eventarc.iam.gserviceaccount.com` / `service-664973716762@gcp-sa-pubsub.iam.gserviceaccount.com`; revisar roles de agente gestionados y permiso del operador para provisionarlos. No otorgarlos al runtime |

El auditor informa bindings directos de esas identidades desde la política del
proyecto; una lista vacía **no prueba ausencia de la identidad ni sus permisos
heredados/efectivos**. No consulta ni modifica políticas organizativas.

Para el ejecutor de Build, revisar lectura del bucket **de fuentes de build**,
lectura/escritura del repositorio AR y escritura de logs: como referencia,
`roles/storage.objectViewer` sobre fuentes, `roles/artifactregistry.writer` sobre
el repositorio y `roles/logging.logWriter`. Confirmar si hacen falta permisos de
bucket/logs adicionales para la configuración elegida; no proclamar esos tres roles
como prueba suficiente sin verificar la selección y los recursos reales. Si el
recurso aún no existe, preparar un alcance concreto para su creación autorizada,
no sustituirlo con Storage Admin/Editor. El operador necesita actAs sobre un build
SA cuando la selección lo requiera; concederlo solo allí y tras comprobarlo.

No asignar Owner/Editor ni roles de service agent a humanos/runtime. No conceder
IAM de proyecto al CLI para que arregle permisos automáticamente. Cualquier cambio
necesita propuesta con identidad, recurso, permiso faltante y autorización separada.

## 5. Secuencia manual hasta el primer deploy cerrado

1. **Ahora, sin cambios:** repetir el auditor actualizado en Cloud Shell. Revisar
   APIs, cuenta runtime, roles y binding temporal retirado. No repetir el probe
   solo para obtener otra traza. Conservar resultados sanitizados.
2. **Siguiente autorización mínima:** habilitar exclusivamente APIs faltantes y
   revisar sus identidades: AR si falta → Build → Run → Functions; contemplar
   Eventarc/PubSub que el CLI exige y Storage ya usado. Revisar dependencias antes
   de aceptar. Esta autorización no incluye un build/deploy ni acceso de usuarios.
   No se otorga `serviceusage.services.enable` al runtime.
3. **Después de las habilitaciones:** repetir lectura. Identificar builder real,
   agentes y sus scopes de fuentes/AR/logs. Si falta algo, presentar el grant mínimo
   al propietario. Revisar política de organización sobre invocación `allUsers`
   del servicio Run específico; no modificar restricciones para salvar un error.
4. **Preparación local:** herramientas raíz con Node 24.15+ (rama 24), backend y
   prueba SDK con Node 22. Ejecutar checks y `npm run prepare:remote-staging:closed`;
   conservar SHA, hash del manifiesto y revisar allowlist de archivos. Ninguna
   credencial, diagnóstico o laboratorio entra en el artefacto. No cambiar las
   dependencias por errores de acceso.
5. **Autorización distinta para el despliegue:** aprobar coste/alcance, APIs,
   identidades y artefacto. Solo entonces revisar un cambio limitado de
   `deploymentAuthorized`, manteniendo `remoteEnabled:false`, cliente apagado y
   allowlist de cuentas vacía. **Esta PR no realiza ese cambio.** El hook actual
   rechaza el deploy incluso con la variable de consentimiento.
6. **Comando futuro, todavía bloqueado y no ejecutado:** con Node 22 y el operador
   autorizado, solo ese codebase. No usar `--force`, no desplegar reglas ni Hosting:

   ```sh
   env GCLOUD_PROJECT=fullhouse-staging \
     FULLHOUSE_AUTHORIZE_STAGING_DEPLOY=fullhouse-staging \
     npx firebase deploy --project fullhouse-staging \
       --config firebase.remote-staging.json --only functions:remote-staging-v1
   ```

El CLI puede habilitar APIs, crear fuentes/builds/repositorios y ajustar IAM durante
`deploy`; **no es un dry-run ni auditoría**. Detenerse ante cambios no autorizados.
Revisar también cualquier propuesta de política de limpieza de artefactos: no
aceptarla automáticamente como parte del ensayo.

## 6. Validación posterior, costes y reversión

Tras el deploy autorizado: comprobar us-central1, Node 22, runtime SA exacta,
min 0/max 1, concurrencia 1, 512 MiB, CPU `gcf_gen1`, timeout 60 s; registrar
build ID, ejecutor efectivo, revisión/imagen/digest, SHA y hash del manifiesto.
Verificar que no haya variable de activación ni acceso de cuentas habilitado.

El endpoint usa `invoker:'public'`: **cerrado en lógica de datos, no privado en red**.
App Check está exigido por SDK y Auth por el handler activo; el código cerrado
rechaza antes de inicializar Admin. Una llamada sin Auth/App Check debe rechazarse;
un 401 no demuestra por separado App Check ni ejercicio del flag cerrado. La
prueba positiva con tokens Auth/App Check válidos y cuentas ficticias debe esperar
`UNAVAILABLE`, sin acceso Admin; queda pendiente y necesita preparación explícita.
No guardar/compartir tokens. Planner/Hosting siguen locales y reglas deny-all de
datos siguen intactas; ningún resultado habilita usuarios o Premium.

El primer deploy puede consumir **Cloud Build**, fuentes Storage, imágenes
**Artifact Registry**, Run/Functions, logs y tráfico, aun con minInstances 0 y
backend cerrado. Las APIs/agentes no equivalen por sí solos a carga facturable,
pero facilitan crear recursos que sí cobran. Invocaciones rechazadas, App Check /
reCAPTCHA Enterprise y retención/soft delete pueden añadir costes. Las alertas de
~100 MXN **no son un límite de gasto**; revisar presupuesto, consumo y precios en
Console antes de autorizar. No se presentan tarifas numéricas como verificadas:
el acceso a las páginas Google Cloud está bloqueado en este entorno.

Ante un fallo: detenerse, conservar fase/build/recibo/digest y comprobar qué sí se
creó. Primer deploy no tiene versión anterior garantizada a la que volver. No
anunciar rollback si una operación pudo finalizar; inspeccionar estado primero.
Mantener cliente/backend apagados; otro deploy o retirada de función requiere
autorización específica. No borrar base, bucket, fotos, prueba sintética, fuentes,
artefactos o logs, ni desvincular billing/deshabilitar APIs automáticamente.
Revertir una autorización local no cambia un servicio ya desplegado.

## 7. Verificaciones de esta entrega

Los resultados locales y los de Cloud Shell se registran por separado. Pruebas
de emuladores anteriores (reglas 3/3, medios 4/4) y suite del propietario en PR #26
(592 aprobados, seis TODO) siguen siendo evidencia histórica, no repeticiones
de Codex ni validación del primer deploy.

| Ejecución de Codex sobre esta entrega | Resultado |
| --- | --- |
| `npm run test:remote-staging:iam`, Node 24.22.1 | **20/20**, sin fallos, omitidas ni TODO; puertos HTTP/servicio simulados y bootstrap del CLI sin red |
| `npm test`, Node 24.22.1 | **603 casos: 597 aprobados, 0 fallos, 6 TODO previos**, 47.946 s; incluye las dos regresiones de listeners |
| `npm run check` | Correcto; TypeScript/app.js sincronizados sin escribir archivos |
| `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Correctos; validación v1 y tipos conservados |
| `check:remote-staging:node22`, Node 22.23.5 | Correcto; SDK gcfv2 real, región/SA/memoria/CPU/timeout/límites, UNAVAILABLE y HTTP loopback 401 |
| `prepare:remote-staging:closed` | Artefacto/hash locales preparados; cliente/backend/deploy false |
| Hook de deploy con variable de consentimiento | Rechazo esperado; no ejecución del CLI ni servicios |
| Plan del auditor/probe y comparación con origin/main | Solo planes, siete GET de APIs; flags y archivos públicos/backend/reglas/workflows intactos |

Las dos ejecuciones diagnósticas de 20 rondas de la tabla anterior terminaron en
Node 22 y 24. Dependencias/lockfiles no cambiaron; no se repitió una instalación
limpia ni se atribuye una nueva instalación a esta PR. La instalación backend
limpia Node 22 del propietario permanece como evidencia separada.

No se ejecutaron consultas API/IAM reales, probe, emuladores o navegador en esta
entrega: cambian preflight/diagnóstico, no UI, backend de datos ni reglas. Se
conservan los seis TODO de infraestructura v2 aislada; las guardas v1 de PR #19
siguen verificadas y no equivalen a activar historial inmutable v2. Firefox,
WebKit, dispositivos físicos y un endpoint desplegado siguen sin probarse aquí.

Referencias para revisión manual: [APIs Functions](https://firebase.google.com/docs/functions/get-started),
[cuenta de build](https://cloud.google.com/functions/docs/securing/build-service-account),
[service agents](https://cloud.google.com/iam/docs/service-agents),
[precios](https://firebase.google.com/pricing). Fuentes verificadas localmente:
Firebase Tools 15.37.0 (`prepare.js`, `ensureApiEnabled.js`), Functions SDK 7.4.0,
Storage SDK 8.4.0 y teeny-request 11.1.1 fijados por los lockfiles.
