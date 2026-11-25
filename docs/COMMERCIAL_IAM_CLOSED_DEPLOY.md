# Comercial 3C.3 · IAM y primer despliegue cerrado

Base `f1cd384` (PR #25/3C.2 fusionada). Preparación, **sin deploy ni cambios IAM**.
Se conservan `deploymentAuthorized:false`, `remoteEnabled:false`, cliente
`enabled:false`/`appCheckSiteKey:null`, controles, cuotas, CAS, recibos y respaldos v1.
No cambia Planner, Hosting, Pages, fuentes locales ni historial experimental v2.

## Estado aportado por el propietario

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
No demuestra aún permisos efectivos, edición/localización observadas por API,
configuración completa de App Check, soft delete o las identidades de build.
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

Cloud Shell, Node 22 y repositorio en esta rama:

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

Para este callable HTTP no se incorporan Eventarc, Pub/Sub, schedulers ni permisos
de sus agentes. No habilitar servicios extra para satisfacer una receta genérica.
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
3. Cloud Shell con Node 22: `npm ci`, `npm --prefix remote ci`, checks de pruebas,
   `npm run prepare:remote-staging:closed`. Genera artefacto privado con hashes,
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

| Verificación ejecutada por Codex, Node 22.23.5 | Resultado |
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

**Bloqueos antes de desplegar:** auditoría real/condición efectiva y prueba sintética
autorizada, permisos del operador (incluido primer HTTPS) y build elegido, agentes,
políticas organizativas/URLs públicas, APIs/retención/costes, autorización explícita
y cambio revisado del gate. La PR es preparación; no habilita el primer deploy.
