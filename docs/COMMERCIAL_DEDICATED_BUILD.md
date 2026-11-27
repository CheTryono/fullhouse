# Ejecutor dedicado para el primer build de Fullhouse Staging

Preparación sobre `origin/main` **06d77e9**, PR #27 fusionada. Rama
`feat/commercial-dedicated-build-staging`. **No se crea ninguna cuenta/recurso,
modifica IAM, retira Editor ni ejecuta deploy.** Las tres barreras siguen cerradas:
`deploymentAuthorized:false`, `remoteEnabled:false`, cliente `enabled:false`.

## 1. Nueva evidencia del propietario

El propietario repitió la auditoría de PR #27: siete APIs `ENABLED`,
`directPolicy:matches-minimal-proposal`, `issues:[]`, impersonación temporal
retirada. `function:null` con HTTP 404 se conserva como recurso no verificado,
compatible con un primer deploy todavía pendiente, no prueba universal de ausencia.
No proporcionó el SHA/Node/duración de esta repetición; no se infieren.

Build informa como candidata default
`664973716762-compute@developer.gserviceaccount.com`, con **roles/editor a nivel
proyecto**. `buildSelection.verifiedForNextDeploy:false`. Las identidades
administradas fueron observadas; eso no demuestra por sí solo todos sus permisos.
Estos resultados son **informe del propietario**, no consultas reales de Codex.
Actualizan el inventario anterior de APIs deshabilitadas; no habilitan el deploy.

No se retira Editor: primero inventariar qué otras cargas usan esa cuenta y su
política efectiva. Preparar un builder dedicado evita depender de modificarla.

## 2. Resultado sobre Firebase CLI 15.37.0

**No se puede seleccionar explícitamente un builder dedicado mediante el flujo
Functions de esta versión fijada.** Se comprobó el paquete instalado y su código:

- `commands/deploy.js` no registra `--build-service-account`.
- `LocalFunctionConfig` rechaza propiedades adicionales; no admite
  `buildServiceAccount`. No añadir campos inventados a `firebase.json`.
- `gcp/cloudfunctionsv2.functionFromEndpoint()` construye `buildConfig` sin
  `serviceAccount`, incluso si recibe campos candidatos añadidos al endpoint.
- `serviceAccount` sí llega a **serviceConfig.serviceAccountEmail**: es el runtime,
  no el builder. Cambiarlo no resuelve el problema y rompería la separación IAM.
- La lectura de una función tampoco expone el builder en el endpoint interno.
  `preserveExternalChanges` no aporta selección/verificación explícita. La omisión
  en ese modelo **no demuestra** que una actualización posterior borre el campo
  en el servidor: no se ensayaron updates reales ni se presupone ese efecto.

La API oficial Cloud Functions v2 sí admite
`buildConfig.serviceAccount = projects/fullhouse-staging/serviceAccounts/EMAIL`.
La alternativa es un procedimiento revisado mediante esa API o `gcloud functions
deploy --build-service-account`, **no una opción Firebase**. No se actualiza ni
parchea el CLI, no se cambia el default del proyecto y no se implementa otro
deploy en esta PR. No crear primero con gcloud y asumir después que Firebase
verificará automáticamente la identidad: el flujo posterior también requiere
un contrato de selección y comprobación propio.

### Barreras y comprobaciones implementadas

`scripts/remote-staging-build-identity.cjs` define una propuesta única y puertos
puros. `npm run plan:remote-staging:build` inspecciona el conversor local y produce
un **plan no ejecutable**; no admite `--run` ni credenciales. La cuenta propuesta
todavía no se considera existente.

- `assertBuildIdentity()` acepta únicamente la función/proyecto/región, Node 22,
  builder completo y runtime separado exactos. Rechaza cuenta omitida, default
  Compute/legacy, runtime usado como builder, email sin formato de recurso y
  proyectos ajenos. **Solo comprueba selección**, no IAM o payload completo.
- El hook de `firebase.remote-staging.json` conserva su bloqueo por autorización
  y añade otro bloqueo explícito del transporte Firebase 15.37.0. Aun con flag de
  deploy abierto y variables de consentimiento, esa ruta se detiene antes de
  subir/construir código. Cambiar solo el flag ya no sería suficiente.
- No hay nueva ruta de red/despliegue que permita eludir el bloqueo. Las pruebas
  llaman al conversor real y al hook con un flag abierto solo en un contexto de
  test en memoria; no alteran los archivos de configuración.

La garantía cubre **las rutas de este repositorio**. Una persona con permisos puede
usar Console u otras herramientas ignorando el hook; las pruebas no revocan esos
permisos ni prueban que Google ejecutó un build inexistente. Un futuro transporte
debe verificar el campo **antes** de enviar la petición; comprobar después no
impide que un build incorrecto ya haya corrido.

## 3. Cuenta y alcances propuestos

Cuenta: **fullhouse-remote-build@fullhouse-staging.iam.gserviceaccount.com**.
Sin claves JSON, sin roles de datos, distinta del runtime y de los service agents.

| Necesidad del builder | Alcance propuesto / precaución |
| --- | --- |
| Leer ZIP/código fuente | `roles/storage.objectViewer` **solo sobre el bucket o buckets de fuentes efectivos**. No en proyecto ni sobre `fullhouse-staging.firebasestorage.app`, que contiene datos de usuarios |
| Descargar cachés/imágenes y publicar imagen | `roles/artifactregistry.writer` **solo sobre el repositorio Docker de funciones**, us-central1. Incluye lectura/escritura, no administración/creación de repositorios |
| Escribir logs de build | `roles/logging.logWriter` en `fullhouse-staging`, con salida de logs compatible con cuenta de build propia |

Son roles predefinidos de alcance práctico; no una demostración de mínimos por
cada RPC. No usar `roles/editor`, Owner, Storage Admin, Cloud Build Editor ni
`cloudbuild.builds.builder` global para resolver errores a ciegas. El builder no
necesita acceso Firestore, `users/`, permisos runtime, crear buckets/repositorios,
conceder IAM, emitir tokens ni desplegar la aplicación.

**Los nombres reales de fuentes y repositorio todavía no están verificados.** No
asignar permisos sobre nombres supuestos. Un despliegue GCFv2 puede usar un bucket
gestionado `gcf-v2-sources-…`, y un bucket de staging de subida no necesariamente
es el objeto/bucket final leído por Build. La API devuelve `storageSource` y su
generación; el futuro procedimiento debe fijar y revisar esa procedencia y
cualquier copia intermedia antes de construir.

Consultar primero recursos existentes. Si aún no existe un destino acotable,
proponer y autorizar explícitamente la preparación del bucket de fuentes y
repositorio en us-central1, después fijarlos en el procedimiento. No lanzar un
build con Compute/Editor para descubrirlos ni conceder Object Viewer de proyecto
como sustituto. El repositorio GCF habitual es `gcf-artifacts`; su existencia no
se deduce de haber habilitado la API. Un repositorio propio debe comprobar sus
requisitos y selección explícita antes de elegirlo.

Con SA propia, Build necesita salida de logs válida: Cloud Logging con su permiso
de escritura o un bucket de logs propio expresamente autorizado. No asumir acceso
al bucket de logs predeterminado de Google ni añadir permisos Storage de proyecto
para conseguirlo. La configuración efectiva del primer job sigue pendiente.

## 4. Operador y service agents

| Identidad | Función / revisión |
| --- | --- |
| Operador | Conservar los permisos Functions/Run y actAs de runtime ya revisados. Para usar el builder seleccionado, comprobar **iam.serviceAccounts.actAs sobre esa SA exacta**; si falta, proponer `roles/iam.serviceAccountUser` solo en ella. No Token Creator ni claves. No dar actAs de proyecto o sobre Compute por comodidad |
| Functions agent | `service-664973716762@gcf-admin-robot.iam.gserviceaccount.com`, rol gestionado `roles/cloudfunctions.serviceAgent`; orquesta fuente/build/despliegue. Revisar asignación y restricciones del mismo proyecto |
| Build agent | `service-664973716762@gcp-sa-cloudbuild.iam.gserviceaccount.com`, `roles/cloudbuild.serviceAgent`; infraestructura y uso de la identidad de build. **No es el ejecutor**. En el mismo proyecto, revisar su rol gestionado antes de proponer grants de tokens adicionales |
| Run agent | `service-664973716762@serverless-robot-prod.iam.gserviceaccount.com`, `roles/run.serviceAgent`; operación/imagen/runtime del servicio, no compilación |
| Eventarc / PubSub agents | `service-664973716762@gcp-sa-eventarc.iam.gserviceaccount.com` / `service-664973716762@gcp-sa-pubsub.iam.gserviceaccount.com`, revisar roles gestionados correspondientes. El bootstrap del CLI ya fue observado; no añade triggers ni exige al runtime Eventarc Receiver, Publisher o Token Creator por este callable HTTP |

Los roles de service agent son para identidades administradas, no humanos, builder
o runtime. Observar la cuenta o un binding no demuestra permisos heredados,
deny/PAB, org policy o acceso efectivo. No conceder automáticamente Token Creator
para resolver un error de Build; localizar primero identidad, recurso y permiso.
Crear la SA y conceder sus bindings exige permisos administrativos del propietario,
no del runtime. El ejecutor dedicado no es la identidad operadora del despliegue.

Si el procedimiento futuro sube un ZIP a un bucket propio, quien lo sube necesita
`storage.objects.create` acotado a esas fuentes; no se concede al runtime ni a todo
el proyecto. Usar nombres/generaciones inmutables evita necesitar sobrescrituras.
Para comprobar el job posterior, el inspector necesita `cloudbuild.builds.get`
sobre staging y acceso de lectura a sus logs. Revisar permisos existentes antes
de proponer estos accesos; no equivalen a Cloud Build Editor. La selección de la
SA por sí sola no verifica permisos de subir fuentes o inspeccionar el job.

El auditor añade GET de la SA dedicada, POST getIamPolicy y testIamPermissions
de actAs, todos de lectura. Separa default observado, roles directos Editor/Owner,
propuesta dedicada y actAs del operador. No imprime miembros de su política. Los
403/404 son **unknown**, no ausencia; `readyForDeploy` permanece false porque no
certifica los scopes de fuentes/AR, IAM heredado ni un transporte autorizado.

## 5. Procedimiento manual concreto, por autorizaciones

1. **Sin cambios:** desde la rama de esta PR, ejecutar con la sesión del propietario:

   ```sh
   npm run plan:remote-staging:build
   npm run audit:remote-staging:iam -- --run
   gcloud version
   gcloud functions deploy --help
   ```

   Verificar en la ayuda local `--build-service-account` y su formato completo.
   No ejecutar deploy, dry-run, impersonación ni copiar tokens. La cuenta dedicada
   puede seguir sin verificarse; eso bloquea, no se corrige automáticamente.

2. **Siguiente acción mínima, requiere autorización del propietario:** crear
   únicamente la SA, sin claves ni roles en los pasos opcionales de Console:
   Google Cloud → IAM y administración → Cuentas de servicio → Crear cuenta,
   proyecto `fullhouse-staging`, ID `fullhouse-remote-build`. Equivalente futuro:

   ```sh
   gcloud iam service-accounts create fullhouse-remote-build \
     --project fullhouse-staging --display-name="Fullhouse Staging Build"
   ```

   **No ejecutado ni autorizado automáticamente por esta PR.** No cambiar Compute.
   Repetir el auditor tras la creación; no hace falta volver a conceder el permiso
   temporal del probe runtime, ya retirado.

3. **Scopes, antes de grants:** inspeccionar fuentes y repositorio. Si requieren
   creación, solicitar autorización separada con nombres exactos/región/costes.
   Revisar provenance de la fuente y salida de logs del transporte elegido. No
   conceder sobre el bucket de fotografías, todos los buckets o todos los repos.
4. **Bindings concretos, tras aprobación:** en IAM del bucket de fuentes asignar
   Object Viewer al builder; en permisos del repositorio AR asignar Writer;
   Logging Writer solo en staging. Comprobar los permisos efectivos del operador
   y, **solo si falta**, Service Account User sobre la SA dedicada. Revisar agents
   y sus roles gestionados; no asignar nuevos grants por un 403 sin diagnóstico.
5. **Transporte, otra PR/autorización:** preparar Cloud Functions v2/gcloud con
   `buildConfig.serviceAccount` explícito y todos los parámetros cerrados del
   artefacto (Node 22, runtime SA, us-central1, límites, App Check, CORS, variables,
   cuenta de invocación, fuentes e integridad). No se proporciona un comando de
   deploy listo para ejecutar: falta ese transporte completo y su prueba. El
   `--build-service-account` **aislado** no conserva los demás parámetros.
6. **Solo después, ensayo cerrado autorizado:** validar selección antes de POST,
   luego comprobar `function.buildConfig.serviceAccount` y el **serviceAccount del
   job Build real**, source/provenance, imagen/digest y logs. Ambos deben señalar
   la SA dedicada. Si falta o difiere: detener reintentos, conservar estado y no
   abrir usuarios; una comprobación posterior no anula un build ya consumido.

## 6. Costes, reversión y límites

Crear únicamente una SA no inicia builds, instancias o almacenamiento. Preparar
fuentes/repos y compilar sí puede consumir Storage, Build, Artifact Registry,
logs y Run; no hay promesa de gasto cero ni tope duro de ~100 MXN. Revisar cuotas,
retención y alertas antes de autorizar recursos. No se cambian precios/presupuesto.

La reversión de esta preparación no debe abrir el hook antiguo: conservar el
rechazo del builder predeterminado. No retirar Editor ni borrar cuentas/objetos.
Si luego se autorizan bindings, registrar exactamente cuáles se añadieron y
retirar solo esos con revisión de dependencias. Ante resultado incierto de un
build/deploy, inspeccionar antes de reintentar. Backend/cliente continúan apagados;
no hay rollback automático de una primera función ni limpieza autorizada.

## 7. Pruebas y fuentes

`npm run test:remote-staging:build`: ocho casos sobre conversor y esquema fijados,
omisión del builder en el modelo de lectura, selección exacta, hook aun con
flag abierto en memoria, IAM de dedicado, default Compute/Editor, 403/404 y plan
no ejecutable. `npm run test:remote-staging:iam`: veinte casos existentes. No son
pruebas reales de permisos ni crean builds. El dato del propietario sobre
APIs/Editor se conserva separado.

| Ejecución de Codex sobre este código | Resultado |
| --- | --- |
| Suite específica de build, Node 24.22.1 | **8/8**, sin fallos, omitidas o TODO |
| Mismos ocho casos con Node 22.23.5 | **8/8**, solo SDK/conversor/puertos simulados; no prueba de deploy |
| Suite IAM anterior, Node 24.22.1 | **20/20**, con las nuevas lecturas inyectadas |
| `npm test`, Node 24.22.1 | **611 casos: 605 aprobados, 0 fallos, 6 TODO previos**, 50.293 s |
| `npm run check` | Correcto; fuente pública y app.js sincronizados, sin escribirlos |
| `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Correctos |
| `check:remote-staging:node22` con Node 22.23.5 | SDK cerrado/identidad runtime/límites y HTTP loopback correctos |
| Plan y preparación local de artefacto | Correctos, tres banderas apagadas; transporte no autorizado |

No se repitieron instalaciones limpias (dependencias/locks intactos), emuladores,
navegadores, auditoría real ni probe IAM. No hay UI/reglas/backend de datos
modificados. No se declara un primer job aprobado ni activación de usuarios.

Fuente oficial accesible: [BuildConfig de Cloud Functions v2](https://github.com/googleapis/googleapis/blob/master/google/cloud/functions/v2/functions.proto),
campo `service_account`, formato `projects/{projectId}/serviceAccounts/{email}`.
Las páginas [build identity](https://cloud.google.com/functions/docs/securing/build-service-account)
y [gcloud deploy](https://cloud.google.com/sdk/gcloud/reference/functions/deploy)
fueron bloqueadas por el proxy; no se presentan como lectura web verificada.
Se contrastó el código instalado Firebase Tools 15.37.0. Un espejo no oficial del
Cloud SDK también contiene `AddBuildServiceAccountFlag`; es evidencia auxiliar,
**no sustituto de comprobar ayuda/versión oficial en Cloud Shell**. No se añadió el
espejo, un SDK distinto ni código de despliegue al repositorio.
