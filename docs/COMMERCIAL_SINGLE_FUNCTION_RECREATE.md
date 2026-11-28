# remoteV1: eliminación dirigida y nueva creación, separadas

Fase independiente dentro de PR #33, rama `feat/commercial-failed-function-recovery`.
**Código preparado, sin autorizar ni ejecutar operaciones reales.** No modifica
el backend, el cliente, IAM, reglas, Hosting o el ejecutor original de creación.

## Evidencia y decisión

El propietario ejecutó el diagnóstico de `f951864` en Cloud Shell y comunicó en
[PR #33](https://github.com/CheTryono/fullhouse/pull/33): 57 verificaciones correctas,
26 campos ausentes, una incompatibilidad, cero consultas no verificadas y contrato
bloqueado. Faltan casi todo serviceConfig, imágenes y procedencia del build; la
fuente de la función usa un bucket distinto al esperado, sin valor comunicado.
Es evidencia del propietario, no una inspección real realizada por Codex.

Se abandona PATCH para este objeto incompleto sin relajar sus guardas. El nuevo
controlador `scripts/remote-staging-recreate.cjs` separa las condiciones de borrar
una función FAILED de las necesarias para actualizar su definición.

| Hecho | Para DELETE | Para nueva creación |
| --- | --- | --- |
| Proyecto/número, nombre, GEN2/FAILED, fechas y build anterior exactos | Obligatorios | Se exige ausencia real de función y Run |
| Build `a690a410-ec8f-4bd9-917f-581ee466b433` | ID y estado terminal verificables | No se reutiliza como build de la nueva release |
| serviceConfig anterior | No se reconstruye ni se certifica | Parámetros futuros explícitos y cerrados |
| Imágenes/procedencia anterior no devueltas | Limitación explícita; no bloquean por sí solas | No se presentan como evidencia de la nueva compilación |
| Bucket anterior distinto | Observado/preservado; nunca se usa como destino de borrado o nueva fuente | Siempre el bucket dedicado del contrato |
| Permisos, operaciones y Run | Lecturas verificadas, sin pendientes y Run NOT_FOUND | Nuevo preflight original, sin fingir function:null |
| Datos de usuarios | No se leen ni se suponen inexistentes | No se importan, migran ni activan |

## Un comando de inspección

Desde la rama actualizada y el Node22 ya utilizado, sin repetir el diagnóstico
anterior, instalaciones o baterías de pruebas:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/remote-staging-recreate.cjs --inspect
```

Antes del borrado devuelve `phase: delete`, condiciones bloqueadas o
`readyForReview:true` con `deletePlanHash`. Tras el borrado verificado, **el mismo
comando**, ejecutado de nuevo por el propietario, puede devolver `phase: create`
y `createPlanHash`. No ejecuta ninguna acción ni selecciona automáticamente una
mutación. `authorized:false` permanece en ambos informes.

Las consultas son metadata: proyecto/número, testIamPermissions, función completa
en RAM, build por ID, Run, lista completa de operaciones y relectura de función.
El propio comando verifica antes SDK592 y perfil CLI sin overrides/impersonación,
también para la inspección, antes de obtener el token del operador.
No hay consultas a documentos, cuentas Auth, objetos/fotos o contenido de buckets.
Run 403, 404 sin NOT_FOUND o errores de API son desconocidos, nunca inexistencia.
Se rechazan operaciones en curso/desconocidas y paginación incompleta (máximo diez
páginas de cien). El resumen omite JSON completo, variables, tokens y datos privados.

El permiso de delete y los de create se comprueban en la misma consulta; el
informe muestra `creationChecks.permissionsMissing` antes de borrar. La auditoría
IAM completa de primera creación se difiere hasta que la función realmente no
exista, para evitar repetirla innecesariamente durante la preparación de DELETE.
Las lecturas frescas antes de cada mutación siguen siendo obligatorias.

## Bucket observado y evidencia equivalente

El informe muestra solo el nombre válido del bucket observado. No se asume que
el mismatch sea inseguro ni se permite arbitrariamente como nueva fuente.
Únicamente se pueden consultar metadatos de estos dos nombres exactos:

- `fullhouse-staging-build-sources-664973716762`.
- `gcf-v2-sources-664973716762-us-central1`.

Una coincidencia de nombre **no demuestra procedencia**. La corroboración exige
metadata del bucket con el número del proyecto y región correctos, además de
`function.buildConfig.sourceProvenance.resolvedStorageSource` coincidente en
bucket, objeto y generación. Este campo output-only se describe en el esquema
oficial Functions v2 incluido en SDK592: `BuildConfig`, `SourceProvenance` y
`StorageSource` (`cloudfunctions_v2_messages.py`). Es metadata de Google, no un
valor añadido desde nuestra configuración. No prueba los bytes compilados.

Si esa evidencia no existe, se mantiene `UNVERIFIED`/`PRESERVED`. Un bucket no
incluido en la lista ni siquiera se consulta; ninguno se borra o modifica. No se
conceden permisos para investigar imágenes o fuentes antiguas. La ausencia de
`results.images`/`sourceProvenance` del build se conserva como limitación. Para
eliminar **la función concreta** no es necesaria una prueba de aquellos bytes.

## Autorizaciones pendientes

1. **Revisión del código y del expediente real.** Confirmar el target exacto
   `projects/fullhouse-staging/locations/us-central1/functions/remoteV1`, GEN2
   FAILED, sus fechas y build anterior; Run no operativo/NOT_FOUND y operaciones
   sin pendientes. Aceptar expresamente que la configuración runtime previa no
   está acreditada. No hay un hash real de borrado hasta ejecutar la inspección.
2. **Revisión y preservación de datos.** Confirmar que no hay usuarios reales
   activos y revisar respaldos si hay información personal. El informe no prueba
   bases/buckets vacíos: existen datos sintéticos retenidos del ensayo IAM. No hay
   que borrarlos ni leer datos privados para preparar este expediente.
3. **Autorizar solo DELETE.** Aprobar su `deletePlanHash`, la release cerrada y una
   ventana exclusiva. El alcance es esa función; el control plane puede retirar
   recursos gestionados propios de la función, como Run. No se solicita borrar
   Firestore, Storage, Authentication, cuentas/roles IAM, repositorios, builds o
   logs. Si falta un permiso, se informa; no se concede ni se pide Owner/Editor.
4. **Autorizar CREATE por separado.** Solo después de confirmar el borrado y
   obtener el nuevo `createPlanHash` con ausencia real de función/Run y preflight
   original. Aprobar el ejecutor original, release, costes y binding Invoker
   `allUsers` exclusivamente en el nuevo servicio. App Check/Auth siguen activos,
   backend/cliente/UIDs siguen cerrados. Una aprobación de DELETE no sirve para CREATE.

DELETE requiere get/delete de Functions, operations.get/list, builds.get,
run.services.get y serviceusage.services.use. CREATE conserva sus permisos
originales, actAs, fuentes/Artifact Registry y agentes. Las pruebas de permisos
se hacen sobre el proyecto: un grant condicionado que no aparezca exige revisión
manual de su alcance, no ampliación automática de IAM. No se usan claves JSON,
impersonación ni permisos del runtime para administrar el despliegue.

SHA-256 del artefacto cerrado, sin cambios:

```text
1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af
```

Los hashes de fase vinculan esa release, fase, metadata original y archivos de
control. No son firmas ni consentimiento. No se generan variables de aprobación
automáticamente a partir de la propia inspección. No reutilizar `recoveryHash`
de PATCH ni una huella sintética como aprobación de estas fases.

## Comandos futuros, todavía NO autorizados

Solo tras revisión/consentimiento para DELETE. Los placeholders no hexadecimales
fallan antes de obtener credenciales o ejecutar comandos:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  FULLHOUSE_AUTHORIZE_SINGLE_FUNCTION_DELETE=fullhouse-staging \
  FULLHOUSE_APPROVED_DELETE_PLAN=HASH_DELETE_64_REVISADO \
  FULLHOUSE_APPROVED_GCLOUD_RELEASE=HASH_RELEASE_64_REVISADO \
  FULLHOUSE_RECREATE_EXCLUSIVE_WINDOW=fullhouse-staging \
  FULLHOUSE_ACK_RECREATE_DATA_REVIEW=fullhouse-staging \
  node scripts/remote-staging-recreate.cjs --delete
```

Este comando nunca crea. Después se debe ejecutar `--inspect`, revisar el resultado
y obtener otra autorización antes de la creación:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  FULLHOUSE_AUTHORIZE_RECREATE_CREATE=fullhouse-staging \
  FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY=fullhouse-staging \
  FULLHOUSE_APPROVED_CREATE_PLAN=HASH_CREATE_64_REVISADO \
  FULLHOUSE_APPROVED_GCLOUD_RELEASE=HASH_RELEASE_64_REVISADO \
  FULLHOUSE_RECREATE_EXCLUSIVE_WINDOW=fullhouse-staging \
  FULLHOUSE_ACK_RECREATE_DATA_REVIEW=fullhouse-staging \
  node scripts/remote-staging-recreate.cjs --create
```

No se aceptan flags de destino, force, scripts de limpieza ni combinación de
`--delete --create`. El nuevo CREATE delega a `g.deployClosed` sin proporcionar
una auditoría ficticia: conserva la barrera original de primera creación y hace
otro preflight real antes de subir código.

## Atomicidad, respuesta y recuperación

Node22/SDK592, configuración cerrada y consentimientos se verifican antes de
acceder a credenciales. Se comparan dos expedientes frescos completos contra la
huella aprobada. **No hay CAS**: el esquema oficial DELETE v2 solo admite `name`,
sin etag/generación. La declaración de ventana exclusiva no es un lock. No usar
el procedimiento si otro operador/automatización puede cambiar el recurso en
esa ventana. El original `gcloud deploy` también es upsert; conserva ese límite.

Antes del único HTTP DELETE se escribe y fsync un recibo local con creación
exclusiva (`wx`, 0600) bajo `dist-remote-gcloud-closed-delete-receipts/`, ignorado
por Git. Un fallo de capacidad detiene la petición. No contiene token ni datos.
El mismo expediente no se reenvía si ya hay un intento local; no se borra el recibo.
Esto no es un registro global: perder el workspace/recibo no prueba que no hubo
operación. No garantiza supervivencia a pérdida del disco o del perfil.

Solo se envía `DELETE https://cloudfunctions.googleapis.com/v2/.../functions/remoteV1`.
Se verifica el nombre de operación/proyecto/región, target/tipo si se devuelven,
ausencia de error, `done:true` y respuesta `google.protobuf.Empty`. La espera
solo hace GET (máximo 120 consultas con pausa de un segundo, cada consulta con
timeout 15s). Agotar la espera deja estado **incierto**, sin otro DELETE.
La operación se comunica por stderr y se conserva en el recibo al recibirse.

Después se exige función y Run NOT_FOUND y operaciones completas sin pendientes.
Un 403, timeout, acuse perdido, servicio residual o error de lectura nunca se
presenta como rollback ni como inexistencia. No se borran otros recursos para
desbloquear. Inspeccionar con el mismo comando antes de cualquier decisión.

La creación conserva runtime/builder dedicados, repo/bucket de fuentes, Node22,
us-central1, 512Mi, CPU 0.3333, min0/max1, concurrencia1, timeout60 y variables
cerradas. El verificador original de **nuevo build** sigue exigiendo imágenes y
procedencia: si tampoco se devuelven tras crear, puede haber un servicio ACTIVE
con confirmación incompleta. No anunciar éxito ni desplegar otra vez; resolver
esa verificación mediante lecturas. Esta entrega no relaja ese verificador ni
demuestra que Google devolverá esos campos en la próxima compilación.

## Costes y límites

No se habilitan servicios ni facturación ni se cambian alertas. Eliminar la
función no elimina costes retenidos de fuentes/imágenes/logs. La creación puede
consumir Cloud Build, Artifact Registry, Storage, Cloud Run y logging. Incluso
el endpoint cerrado puede generar costes. El presupuesto aproximado de 100 MXN
y sus alertas **no son un límite duro**. Revisar facturación después del ensayo;
no se implementa un cierre automático ni se amplía IAM por un fallo.

## Verificación

Ejecutado por Codex con puertos API/CLI sintéticos y directorios temporales:

| Comprobación | Resultado |
| --- | --- |
| Nueva suite `test:remote-staging:recreate` | **25/25** con Node24.22.1 y **25/25** con Node22.23.5 |
| Suite general `npm test`, Node24.22.1 | **681 casos: 675 aprobados, 0 fallos, 0 omitidos, seis TODO previos**, 41.584 s |
| `check`, `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Aprobadas; app.tsx/app.js sincronizados sin escribirlos |
| Aislamiento y release | Backend, cliente, UIDs, ejecutor original, reglas/IAM y workflow intactos; SHA-256 de PR32 conservado |

La suite general corresponde al checkpoint `9f4ce83`. Después se reforzó solo
la validación del perfil CLI del inspector antes del token y se repitieron las
25 pruebas afectadas en Node24/22, aprobadas. Las comprobaciones no afectadas
conservan sus resultados; no se repiten por cambiar esa preparación de lectura.

Se comprueban entrada/scope/permisos, metadata omitida y fuentes no atestadas,
estado cambiado, separación de consentimientos y fases, cuota del recibo local,
respuesta/polling de operación, error/acuse perdido/lectura posterior inciertos,
una sola petición DELETE, bloqueo de reenvío y ausencia final. Hay una prueba del
inspector CLI completo con la forma FAILED comunicada, sin atribuir la copia
sintética a una nueva consulta real.

No se repiten pruebas reales ya comunicadas ni ensayos SDK/Framework del backend
intacto. El nuevo DELETE usa REST v2 y su esquema oficial, no el cuerpo mutante
de gcloud. No se ejecutaron inspecciones, llamadas al endpoint, eliminación,
despliegue o cambios IAM reales. Las dos huellas de fase reales **no existen aún**:
se obtendrán de las inspecciones del propietario, sin convertir resultados
sintéticos en autorizaciones.
