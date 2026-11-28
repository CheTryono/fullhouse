# Verificación retrospectiva de remoteV1 ACTIVE (issue #34)

Esta entrega solo inspecciona. No modifica el artefacto, los ejecutores de
deploy/delete/create, IAM, datos, usuarios, Hosting ni el cliente. Base:
`7e613727dec05972a7f495601c64be8f1fa15f52`. La autorización de despliegue ya
existente no se amplía: el nuevo comando no tiene ruta de escritura en Google.

## Evidencia real comunicada por el propietario

[Issue #34](https://github.com/CheTryono/fullhouse/issues/34): después del CREATE
autorizado, Functions `remoteV1` GEN2 está ACTIVE, Run `remotev1` Ready y el build
`b378e9e0-e8f6-4604-814e-6dd3eef33b45` SUCCESS con builder dedicado. El wrapper
acabó en STOPPED después de que gcloud mostrara `Done.`. **No repetir el deploy**.

Google devuelve como fuente resuelta de Functions:

```text
gcf-v2-sources-664973716762-us-central1
remoteV1/function-source.zip
generation 1795844784903748
```

Es diferente del bucket de subida original. Cloud Build no devolvió
`results.images` y devolvió `sourceProvenance: {}`. No son pruebas de ausencia
de fuente/imagen. El verificador anterior exige esos campos y la coincidencia
literal con el bucket de subida: hay varios motivos de rechazo posibles; su
mensaje genérico no identifica cuál fue el primer throw.

Esta evidencia pertenece al **propietario**. Codex leyó el issue y ejecutó pruebas
locales sintéticas; **no consultó el proyecto real**. No se conoce todavía el
digest/revisión efectivo ni se han comparado los bytes reales de ese ZIP.

## Qué comprueba el nuevo diagnóstico

`scripts/verify-remote-staging-release.cjs` es independiente del deploy. Primero
valida entorno/perfil local, SDK 592.0.0 y el hash completo del artefacto local:

```text
1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af
```

No hay nueva release ni nuevo hash de autorización. Los once archivos, variables
y control del ejecutor original permanecen iguales. Después realiza únicamente
GET autenticados a recursos fijos de `fullhouse-staging`:

| Evidencia | Verificación |
| --- | --- |
| Proyecto | ID y número `664973716762` exactos antes de continuar |
| Functions | ACTIVE/GEN2, build exacto, Node22, entrypoint, identidades, repo, etiquetas, capacidad, variables y ausencia de configuración adicional no autorizada |
| Cloud Build | Job por ID, SUCCESS y builder dedicado; no se selecciona el build más reciente |
| Fuente | `Function.buildConfig.sourceProvenance.resolvedStorageSource` output-only con bucket/objeto/generación exactos; fuente declarada consistente |
| Storage de código | Propiedad/región del bucket y metadata del objeto antes de descargar esa generación; nunca se leen objetos de usuarios |
| Bytes | ZIP en RAM, sin extracción: allowlist exacta de once archivos, tamaños, CRC y SHA-256 de **cada archivo** iguales al plan local aprobado |
| Run | Servicio reconciliado y Ready/ConfigurationsReady/RoutesReady; una revisión resuelta con 100% del tráfico, sin split/tag ni reemplazo pendiente |
| Vínculo de procedencia | `Function.serviceConfig.revision` output-only debe coincidir con la revisión sirviendo tráfico y con el build de esa misma Function; no se deduce por fecha/nombre/label |
| Imagen | `Revision.status.imageDigest` inmutable y `DockerImage.uri/name` del mismo digest en Artifact Registry, repositorio permitido; no basta un tag |
| Configuración efectiva | Cuenta runtime, entorno cerrado, memoria/CPU, escalado, timeout, concurrencia, ingress y política invoker del servicio/revisión |
| Estabilidad | Relectura de Function, servicio, revisión y política; cualquier diferencia o lectura final fallida bloquea |

Las anotaciones de build de Run y los campos de imágenes/procedencia de Build,
**si aparecen**, también deben ser consistentes. Los campos ausentes se conservan
como ausentes, sin rellenarlos. Si `serviceConfig.revision` o el digest no están
disponibles, se informa el bloqueo: no se asocia por similitud o proximidad temporal.

El ZIP se limita a 8 MiB **de código**, independiente del límite del respaldo v1.
Las respuestas de metadata se limitan a 2 MiB y cada GET a 30 segundos, sin
reintentos. El tamaño descomprimido de cada entrada está acotado al esperado.
ZIP64, cifrado, enlaces, nombres ajenos/duplicados, solapamientos, truncamientos,
CRC/hash incorrectos y formatos no soportados se rechazan. No se instala otra
dependencia. Se usa `zlib.crc32` disponible en Node22/24.

Las cantidades de Run se comparan conservadoramente: 512 MiB y CPU `0.3333`
(o representaciones numéricamente iguales). No se acepta una diferencia de
capacidad suponiendo una normalización no demostrada. El informe reúne todas
las discrepancias para revisarlas juntas.

## Qué significa el resultado

- `verified`: requisito comprobado contra su fuente.
- `missing`: Google no devolvió el campo o no hubo respuesta utilizable.
- `mismatch`: contradicción o contenido distinto.
- `unverified`: evidencia/lectura/formato insuficiente; HTTP403/404 no se convierten en ausencia confirmada.
- `not equivalent`: la evidencia disponible no tiene la misma fuerza que una atestación criptográfica de compilación.

El estado global es `verified` solo si pasan **todos los requisitos obligatorios**.
Su alcance explícito es `official-control-plane-links-and-approved-source-bytes`:
enlaza fuente aprobada, build, revisión e imagen mediante campos oficiales de
Google. **No demuestra criptográficamente que el builder produjo esa imagen a
partir del ZIP**, ni constituye SLSA, compilación reproducible o defensa contra un
administrador malicioso. Esa diferencia figura siempre como `not equivalent`.
Si se exige tal garantía adicional, esta verificación operativa no la sustituye.

`Build.results.images` y `Build.sourceProvenance` pueden seguir `missing` sin
bloquear cuando las fuentes alternativas obligatorias completan la cadena. No
se vuelven `verified` ni se inventan en el JSON. Auth/App Check quedan
`unverified` independientemente del resultado operativo. `userActivationAuthorized`
permanece false. No es una autorización para activar usuarios ni almacenamiento.

Las relecturas no son una transacción entre servicios: detectan cambios
observados, pero no carreras de modificación/restauración entre lecturas ni
cambios posteriores. Mantener una ventana sin despliegues/configuración mientras
se ejecuta el diagnóstico. No se necesita ni se realiza impersonación runtime.

## Un solo diagnóstico real en Cloud Shell

Después de revisar esta PR, con su rama/commit actualizado, Node22 y gcloud592
ya disponibles y la sesión personal del propietario autorizada:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS npm run verify:remote-staging:release -- --run
```

Sin `--run`, solo muestra el plan; no pide token ni consulta Google. `--run`
regenera/verifica el artefacto **local ignorado** y usa el token efímero de la
sesión gcloud en RAM; no guarda ni imprime tokens, variables de entorno o ZIP.
No cambia la configuración de gcloud ni solicita permisos automáticamente.

Salida 0: verificación operativa completa dentro del alcance indicado. Salida 2:
hay bloqueos o precondiciones locales no verificadas; revisar **todos** los
`checks`, `blocked` y `observations`. Conservar el JSON resumido, sin volver a
desplegar, eliminar o ampliar IAM. No ejecutar `--create`/`--recover` para
"corregir" un diagnóstico de una función ACTIVE.

Lecturas que podría necesitar la cuenta operadora: `resourcemanager.projects.get`,
`cloudfunctions.functions.get`, `cloudbuild.builds.get`, `run.services.get`,
`run.services.getIamPolicy`, `run.revisions.get`, `artifactregistry.dockerimages.get`,
`storage.buckets.get`, `storage.objects.get` sobre **código**, y uso de cuota del
proyecto. Un 403 se informa como desconocido; no se recomiendan roles amplios.
No se modifica ninguno de esos permisos en esta entrega. Las lecturas/descarga
pueden generar costes normales de API/egreso, sin build ni instancias nuevas por
invocación del endpoint.

## Pruebas y siguiente paso

La fixture reproduce lo comunicado sobre Function/Build/fuente; revisión Run,
Artifact Registry y ZIP de las pruebas son **sintéticos**, no nuevos hallazgos
reales. Las pruebas verifican también fuentes/imágenes cruzadas, digest distinto,
build equivocado, tráfico ambiguo, Ready false, bytes inválidos, respuestas
incompletas, errores HTTP, interrupciones y cambios entre lecturas. No requieren
emuladores ni credenciales y no invocan Functions.

Resultados ejecutados directamente por Codex sobre esta corrección:

| Comprobación | Resultado |
| --- | --- |
| Nueva suite en Node22.23.5 | 20/20, cero fallos/omitidas/TODO |
| Nueva suite en Node24.22.1 | 20/20 (también incluida en la suite general) |
| `npm test`, Node24.22.1 | 701 casos: 695 aprobados, cero fallos/omitidas y seis TODO previos |
| `npm run check` | TypeScript y app.js público sincronizados, sin escribir archivos |
| `check:history-contract`, `check:auth`, `check:remote`, `check:remote-client` | Aprobados |
| Hash local regenerado | Mismo `1e930…d1af`, once archivos; sin cambio de release |
| Inspección real de Google / pruebas negativas Auth-App Check | **Pendientes del propietario**, no ejecutadas por Codex |

No se repitieron emuladores, navegador ni ensayos runtime que no cambiaron.
Firefox, WebKit y dispositivos físicos no se probaron en esta entrega. Los seis
TODO conservan su clasificación original; no se oculta ningún fallo nuevo.

Si la inspección real pasa, el siguiente paso mínimo es **revisar el resultado y
autorizar por separado pruebas negativas** sin datos de usuario: sin Auth, sin
App Check y con identidad ficticia fuera de la allowlist. Comprobar rechazo sin
lectura/escritura de datos y flags cerrados antes de diseñar cualquier habilitación
con cuentas ficticias autorizadas. No están implementadas/ejecutadas aquí. No se
requiere otro deploy para ejecutar el diagnóstico retrospectivo.

Fuentes oficiales utilizadas (esquemas contrastados además con SDK592):

- [Functions v2: BuildConfig, SourceProvenance y ServiceConfig.revision](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions).
- [Run v1: revisiones e imageDigest](https://docs.cloud.google.com/run/docs/reference/rest/v1/namespaces.revisions).
- [Run: inspeccionar revisiones](https://docs.cloud.google.com/run/docs/managing/revisions).
- [Artifact Registry: DockerImage.get](https://docs.cloud.google.com/artifact-registry/docs/reference/rest/v1/projects.locations.repositories.dockerImages/get).
- [Storage: leer una generación de objeto](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/get).
- [Cloud Build: consultar un build](https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.locations.builds/get).
