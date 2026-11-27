# Primer ensayo cerrado mediante Cloud Functions v2 / gcloud

Base `ef897a9`, PR #28 fusionada; rama `feat/commercial-gcloud-closed-deploy`.
**Esta PR no despliega, crea recursos ni modifica IAM.** Se mantienen
`deploymentAuthorized:false`, `remoteEnabled:false` y cliente desconectado.
El transporte Firebase CLI 15.37.0 sigue bloqueado; no se parchea ni actualiza.

## Estado comunicado por el propietario

Cuenta `fullhouse-remote-build@fullhouse-staging.iam.gserviceaccount.com`, repositorio
Docker `fullhouse-remote-functions` en us-central1 y bucket privado
`fullhouse-staging-build-sources-664973716762` creados y verificados manualmente.
El builder tiene Writer solo en ese repositorio, Object Viewer solo en fuentes y
Logging Writer en el proyecto. ActAs del operador sobre el builder confirmado.
SDK 592.0.0 reconoce las tres opciones. Es **evidencia del propietario**, no una
inspección real ni prueba de permisos ejecutada por Codex. No se comunicó una
prueba de `storage.objects.create` del operador ni de lectura de copias internas.
La cuenta Compute con Editor permanece intacta.

## Qué se verificó realmente

Codex recuperó los componentes **oficiales 592.0.0** desde el manifiesto
[versionado de Google](https://dl.google.com/dl/cloudsdk/channels/rapid/components-v592.0.0.json),
comprobando tamaños y SHA-256 antes de extraerlos en `/tmp`. Core:
`2de2eb7c365cbeaa2410e92d1080234957b662458229d45af5371a5853d671e1`;
gcloud-deps: `cf73aa27751a2dcd7c749d78246c4c125122d7b4eb81e7b5c56ec000366119ee`.
No se introdujo el SDK en Git ni se utilizó una sesión autenticada.

El ensayo `test:remote-staging:gcloud-sdk` usa el parser y los helpers originales
de 592.0.0 **sustituyendo por completo el cuerpo mutante de Run**. El cliente de
subida se sustituye por un puerto que inspecciona el ZIP; los sockets están
bloqueados y se exige **cero intentos de red**. No se llama a Create/UpdateFunction,
habilitación de APIs, IAM o polling real. No es un dry-run de despliegue.

Se aceptaron **juntas** `--build-service-account`, `--docker-repository` y
`--stage-bucket`, con todos los demás argumentos del plan, y se comprobó:

| Selección | Petición construida por el SDK original |
| --- | --- |
| Builder | `buildConfig.serviceAccount = projects/fullhouse-staging/serviceAccounts/fullhouse-remote-build@fullhouse-staging.iam.gserviceaccount.com` |
| Runtime | `serviceConfig.serviceAccountEmail = fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com` |
| Imágenes | `buildConfig.dockerRepository = projects/fullhouse-staging/locations/us-central1/repositories/fullhouse-remote-functions` |
| Fuentes | `buildConfig.source.storageSource.bucket = fullhouse-staging-build-sources-664973716762`, objeto ZIP generado por el SDK |
| Ejecución | Node 22, entry point `remoteV1`, 512Mi, CPU `0.3333`, min 0/max 1, concurrencia 1, timeout 60 s, ingress all |
| Backend | Variable de activación `0`, UIDs vacíos, configuración Firebase del mismo proyecto y `LOG_EXECUTION_ID=true` |
| Build | `GOOGLE_NODE_RUN_SCRIPTS` vacío, igual que el transporte Firebase anterior |
| Identificación | Labels callable/codebase y hash de release |

**Esto demuestra empaquetado y transformación local de opciones, no aceptación
del servidor, IAM efectivo o funcionamiento de las copias internas.** Esas partes
requieren el primer ensayo real autorizado. SDK Functions/Admin y código del
handler no cambiaron.

## Artefacto y controles

`npm run prepare:remote-staging:gcloud` genera un plan local y un directorio
ignorado en Git, `dist-remote-gcloud-closed`. Contiene solo los nueve archivos del
backend revisado, `build.json` y `.gcloudignore`: **once archivos**. La prueba SDK
comprime ese directorio y compara **cada archivo/hash**, no solo el número total.
No incluye node_modules, laboratorios, datos v1, fotos, configuración del cliente
ni claves. El JSON de variables queda fuera del ZIP y contiene solo datos públicos
y banderas cerradas. Archivos ajenos/enlaces/variables alteradas se rechazan y
conservan; no se reparan o borran silenciosamente.

El hash de release vincula archivos, variables, parámetros e implementación del
control local. No es una firma/autenticación frente a un operador malicioso. El
ejecutor rechaza overrides de endpoints/credenciales, impersonación y trazas HTTP
en entorno/configuración CLI; no modifica la configuración personal. Proyecto de
recursos y `--billing-project` se fijan en `fullhouse-staging`, sin tocar otros
proyectos. No cambiar esa configuración mientras se prepara/confirma el ensayo.

El primer ensayo local descubrió que una allowlist iniciada solo con `*` excluía
también la raíz `.` en el ZIP de este SDK, dejándolo vacío. Se añadió `!.`; la
comparación del ZIP completo demuestra la corrección. No se relajó la allowlist.

`cpu:'gcf_gen1'` del callable equivale a **0.3333** para 512 MiB en Firebase Tools
15.37.0. Se conserva explícitamente ese valor, no el default de CPU de gcloud.
App Check, CORS y validación Auth están en el handler SDK empaquetado, no en un
flag inventado de gcloud. La prueba sobre **ese artefacto** con Node 22 usa
loopback y verificadores JWT sintéticos: App Check ausente/inválido e ID token
inválido son rechazados; con ambos puertos válidos se obtiene `UNAVAILABLE` y no
se cargan clientes Firestore/Storage. CORS conserva ambos orígenes de staging.
No demuestra validación real de certificados/tokens o el flujo de usuarios activo.

`--allow-unauthenticated` conserva la pasarela callable pública: aplica el binding
Run Invoker de `allUsers` **solo al servicio**, no a Firestore/Storage. No elimina
Auth/App Check del SDK ni abre la lógica apagada. El futuro consentimiento debe
incluir expresamente ese cambio IAM del endpoint; **no se ejecuta ahora**.

## Permisos: qué está confirmado y qué falta

| Identidad | Alcance / revisión mínima |
| --- | --- |
| Builder dedicado | Conservar Viewer en fuentes, Writer en repositorio y Logging Writer del propietario; no datos de usuarios, delete, Owner o Editor |
| Operador que sube el ZIP | **`storage.objects.create` en el bucket de fuentes**. ActAs y el Viewer del builder no lo conceden. Si falta, proponer Object Creator solo en ese bucket, tras autorización; no Object Admin ni permisos de borrado |
| Operador de deploy | ActAs sobre builder y runtime; Functions get/create/sourceCodeSet; `serviceusage.services.use` en staging por el proyecto de cuota explícito; permisos de política de invocación Run sobre el servicio. Verificar sin ampliar a todo el proyecto por un test condicionado desconocido |
| Inspector posterior | `cloudbuild.builds.get`, lectura de metadata/política Run y acceso a logs. No equivale a Cloud Build Editor |
| Functions service agent | Rol gestionado `roles/cloudfunctions.serviceAgent`; orquesta build/servicio y puede copiar fuentes. Revisar su binding, no trasladarlo al builder |
| Build service agent | `roles/cloudbuild.serviceAgent`, separado del ejecutor. No volver a dar Token Creator al operador ni utilizar el token del antiguo probe |
| Run service agent | `roles/run.serviceAgent`, operación/pull de imagen; no es el builder |
| Eventarc/PubSub | Conservar lo observado. Este deploy es HTTP, sin triggers: no añadir Event Receiver/Publisher/Token Creator al runtime |

### `roles/run.builder`

No se concede por reflejo. Es una colección de permisos, no un requisito que se
satisfaga solamente por el nombre del rol ni un selector de identidad. Aquí se
usa **Cloud Functions v2**, no `gcloud run deploy --source`. El SDK inspeccionado
no exige ese rol por nombre para el builder dedicado; su advertencia de rol
`cloudbuild.builds.builder` se refiere al default Compute.

El auditor añade GET de la definición oficial `roles/run.builder`, además de las
políticas/metadata de fuentes y repositorio y un test **de solo lectura** del
permiso de subida del operador. Si no puede leer la definición, informa desconocido.
No afirma que el conjunto granular baste para todas las operaciones internas de
GCF. Comparar permisos/RPC/recursos ante un fallo concreto; proponer únicamente el
permiso faltante y su alcance antes de cualquier grant. Ni Run Builder ni Cloud
Build Builder a nivel proyecto son una solución automática a ese posible fallo.

### Fuentes internas y límites de la prueba

El código oficial `UploadToStageBucket` sube un ZIP mediante `objects.Insert` al
bucket indicado; no usa `GenerateUploadUrl` en esa rama. El nombre incluye un
sufijo aleatorio: **no es una identidad idempotente de despliegue** y una segunda
ejecución puede dejar otro objeto/build. No repetir automáticamente.

`--stage-bucket` **no promete** que el servidor GCF nunca cree/copie fuentes a otro
bucket. Ejemplo habitual: `gcf-v2-sources-664973716762-us-central1`; no se afirma
que ya exista ni que ese nombre sea toda la procedencia real. Inspeccionar
`build.sourceProvenance.resolvedStorageSource` y su generación después del ensayo.
Un 403/404 no se interpreta como ausencia ni se amplía IAM automáticamente.
Si el builder no puede leer una copia interna, el primer build puede fallar;
detenerse, identificar recurso/permiso y pedir un grant acotado. **Nunca usar
Compute/Editor o Viewer de todos los buckets para conseguir que pase.**

## Procedimiento manual y autorizaciones

1. **Ahora, solo lectura:** actualizar la rama y ejecutar:

   ```sh
   npm run audit:remote-staging:iam -- --run
   ```

   Revisar `gcloudResources.checks`, especialmente **operatorCanUpload**, fuentes
   privadas/us-central1/proyecto, Writer/Viewer/Logging, actAs y agentes. El
   reporte sigue sin certificar IAM heredado/deny/PAB. `function:404` permanece
   desconocido en el inventario; no crear una función para volver complete:true.
   Este es el **siguiente paso manual indispensable**. Confirmar también
   `serviceusage.services.use` del operador en staging. Si falta subida/cuota,
   proponer únicamente el grant necesario; si ya está permitido, no añadir roles.

2. **Preparación local, sin autorización de deploy:** herramientas raíz Node 24;
   backend/ensayo Node 22. Mantener el SDK 592.0.0 y su instalación oficial:

   ```sh
   env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/remote-staging-gcloud.cjs > /tmp/fullhouse-gcloud-plan.json
   FULLHOUSE_GCLOUD_SDK_ROOT="$(gcloud info --format='value(installation.sdk_root)')" npm run test:remote-staging:gcloud-sdk
   # Con Node 22:
   npm run check:remote-staging:gcloud-node22
   ```

   El ensayo SDK usa configuración vacía, sin credenciales y red bloqueada. Si el
   SDK no está instalado, falla expresamente: no lo cuenta como aprobado. No usar
   `gcloud deploy --dry-run` como auditor ni copiar tokens/JSON privados a Git.

3. **Autorización posterior y PR limitada:** solo tras revisar preflight, artefacto
   y costes, autorizar el primer ensayo cerrado y cambiar de manera revisable
   `deploymentAuthorized`; backend, cliente y UIDs **siguen cerrados**. Aprobar
   expresamente creación de función/Run/build/imágenes/fuentes internas y binding
   invoker público del servicio. Esta PR **no cambia esa bandera**.
   Tras ese cambio, regenerar/guardar el plan y revisar su hash: settings forma
   parte del artefacto, por lo que el plan previo con flag false no es el mismo.
   El ejecutor exige el **hash exacto aprobado**, no despliega otro candidato.

4. **Comando futuro, bloqueado ahora**, con Node 22 y sesión personal del operador:

   ```sh
   env -u GOOGLE_APPLICATION_CREDENTIALS \
     FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY=fullhouse-staging \
     FULLHOUSE_APPROVED_GCLOUD_RELEASE=HASH_SHA256_REVISADO \
     node scripts/remote-staging-gcloud.cjs --deploy
   ```

   No admite flags libres: reconstruye argv con proyecto, identidades, bucket,
   repositorio y límites exactos. Requiere versión 592.0.0 y preflight fresco antes
   de subir. El hook Firebase sigue rechazando su transporte. Prohibido usarlo para
   editar una función existente: se rechaza si el auditor la observa.
   **gcloud es upsert y no aporta CAS/create-only**: la lectura previa no elimina
   la carrera con otro despliegue. El propietario debe comprobar el target y
   congelar cambios concurrentes de CLI/IAM/función durante este primer ensayo.
   El 404 no se convierte en garantía universal de inexistencia.

## Confirmación, recuperación y reversión

Tras el comando, el ejecutor inspecciona **ese job**, no el más reciente: función
ACTIVE/GEN_2, Node 22, ambas identidades, repo, fuente, memoria/CPU/límites/env/label;
job SUCCESS con builder dedicado; imágenes del repo esperado con digest y fuente
resuelta con generación; política pública de invocación del servicio. Ausencia o
normalización inesperada bloquea la confirmación. La salida
`CLOSED_RELEASE_METADATA_VERIFIED` acredita metadata, **no datos de usuarios**.
Quedan comprobar dueño/bytes de la procedencia resuelta y pruebas reales negativas
y positivas Auth/App Check con cuentas ficticias. No conectar Hosting/Planner.

Si falla el comando o una lectura posterior, el ZIP/build/función **puede existir**.
Se devuelve incertidumbre, sin reintento ni afirmación de rollback. Conservar SHA,
plan/hash, build ID, imágenes/digests y logs sanitizados fuera de Git. Para verificar
lecturas guardadas explícitamente, sin tocar la nube:

```sh
node scripts/verify-remote-gcloud-closed.cjs /tmp/fullhouse-gcloud-plan.json /tmp/function.json /tmp/build.json /tmp/invoker.json
```

No se borran fuentes, imágenes, logs o datos sintéticos. Primera release no tiene
antecesora garantizada. Mantener apagado el backend/cliente; retirar invoker,
eliminar función o desplegar otra imagen necesita autorización separada. Volver
a poner el flag local en false **no revierte** un servicio ya creado. No desactivar
APIs, retirar Editor o desvincular billing como limpieza automática.

Build, AR, fuentes/retención, Run, logs y solicitudes pueden costar incluso con
backend apagado y min 0/max 1. Los ~100 MXN/alertas no son un límite de gasto.
No se autorizan recursos/cargos desde esta preparación.

## Resultados de esta PR

| Ejecución de Codex sobre el código final | Resultado |
| --- | --- |
| Suite gcloud, Node 24.22.1 | **9/9**, puertos simulados y artefactos sintéticos |
| Mismos casos con Node 22.23.5 | **9/9**, sin tocar la configuración del repositorio |
| Selección de builder / IAM | **8/8 y 20/20**, también incluidos en la suite general final |
| SDK oficial 592.0.0 offline | Parser/helpers y ZIP de once archivos por hash correctos; **0 intentos de red** |
| Artefacto real con Node 22.23.5 | Capacidad, App Check, Auth inválida, CORS y UNAVAILABLE correctos; JWT sintético, loopback y sin clientes de datos |
| `npm test` final | **620 casos: 614 aprobados, 0 fallos, 6 TODO previos**, 48.542 s |
| `npm run check` | Correcto; fuente y app.js sincronizados sin escribirlos |
| `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Correctos |
| Comparación con origin/main / flags | Backend/reglas/cliente/Hosting/Pages/workflow intactos; tres banderas false |

No consultas IAM reales, builds reales, emuladores o navegador en esta entrega;
UI/backend de datos/reglas/Hosting/Pages no cambian. No se repitieron instalaciones
limpias: dependencias y locks no cambiaron. Se conservan seis TODO v2; no se declara
resuelto el historial público ni se activa ningún almacenamiento nuevo.

Fuentes: SDK oficial 592.0.0 (`functions/v2/deploy/command.py`, `source_util.py`,
`service_account_util.py`, `api_enablement.py` y ayuda local), Firebase Tools
15.37.0 (`memoryToGen1Cpu`), Functions SDK 7.4.0 y Admin 14.5.1 fijados. Las páginas
web de Google Cloud y el GET público no autenticado del rol fueron bloqueados
por el proxy; no se inventa una consulta real del rol ni sus permisos actuales.
