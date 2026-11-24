# Comercial 3C.2 · ensayo real preparado, sin activar

Base `36aae0f`, PR #24 incorporada. Revisión: **24 noviembre 2026**.
El propietario acepta **us-central1, EE. UU.**, y objetivo **5 USD/mes para staging**,
sin garantía de tope. Vincular billing, crear recursos y desplegar siguen sin autorizar.

## Implementado

- `npm run inspect:remote-staging`: muestra el plan, sin red.
  `npm run inspect:remote-staging -- --run`: GET autenticados exclusivamente al
  proyecto fijo `fullhouse-staging`; token de gcloud local en memoria, nunca impreso
  o guardado. No habilita APIs ni sigue redirects, ni consulta datos/objetos de usuarios.
- Metadatos de proyecto/número, billingEnabled (sin identidad de cuenta de pago),
  bases/edición/región, buckets/retención/soft delete, Functions, APIs, App Check y
  reCAPTCHA. Run/Build/Artifact Registry solo en us-central1; otras regiones quedan
  fuera del alcance y deben revisarse manualmente. Paginación se marca incompleta.
  Un 403/404 o servicio no habilitado significa **desconocido**, no inexistente.
- [Política de medios](COMMERCIAL_MEDIA_ENTITLEMENTS.md) integrada en el backend
  staging **cerrado**. Backend 3A/v1, reglas, IAM, cliente, Planner, Auth/Hosting,
  Pages y controles de despliegue/activación intactos. No hay Stripe ni migración.

**Intento inicial de Codex:** no hay gcloud/sesión disponible aquí; el script
termina con código 2 antes de consultar. También `firebase firestore:databases:list
--project fullhouse-staging --json` rechazó la operación por falta de autenticación.
El Hosting/Auth existente se conoce por
el informe del propietario. firebaseConfig no acredita que exista una base/bucket.
El propietario ejecutó después el inventario en Cloud Shell; sus resultados se
registran a continuación y sustituyen el estado de inventario totalmente pendiente.

## Evidencia posterior proporcionada por el propietario

Informe recibido el **24 noviembre 2026**, rama
`feat/commercial-staging-trial-media-policy`. No se proporcionaron SHA probado ni
versiones de Node/Java; no se infieren del nombre de la rama. **Codex no ejecutó
estas pruebas ni consultó estos recursos reales.** Se conserva por separado la
evidencia local anterior y su bloqueo de descarga.

| Comando ejecutado por el propietario en Google Cloud Shell | Pruebas | Aprobadas | Fallos / canceladas / omitidas / TODO | Duración (ms) | Salida |
| --- | ---: | ---: | --- | ---: | ---: |
| `npm run test:remote-staging:rules` | 3 | 3 | 0 / 0 / 0 / 0 | 5589.06735 | 0 |
| `npm run test:remote-staging:media:emulator` | 4 | 4 | 0 / 0 / 0 / 0 | 9008.544936 | 0 |

Son Auth/Firestore/Storage **emulados**, incluidos los intentos ampliados sobre
derechos/inventario y las operaciones de medios con Firestore/Storage emulados.
No son los 22 casos locales con puertos simulados/HTTP inyectado ni los 17 previos.
Tampoco demuestran IAM, App Check positivo, tarifas o persistencia Firebase real.

### Clasificación del inventario informado

`npm run inspect:remote-staging -- --run` informó `complete:false`. El propietario
no proporcionó el código de salida de este comando. No se infiere éxito completo
de las pruebas anteriores. Alcance: solo metadatos; Run/Build/AR limitados a
us-central1, sin IAM, documentos de usuario, objetos ni secretos.

| Recurso / configuración | Clasificación en la consulta informada | Compatibilidad con 3C.2 |
| --- | --- | --- |
| Proyecto `fullhouse-staging`, número `664973716762` | **Existente**, `observed` | ID y número coinciden con la configuración/app oficial preparada |
| Facturación | **Estado observado: deshabilitada**, `billingEnabled:false` | Compatible con preparación sin activar; no es autorización para Blaze ni prueba de la moneda/cuenta de pago |
| Buckets del proyecto | **Ausentes en el listado observado**, `buckets:[]` | El bucket esperado `fullhouse-staging.firebasestorage.app` no se encontró. No hay ubicación, clase ni privacidad de un bucket existente que validar |
| Bases Firestore | **Desconocidas**, HTTP 403 | No se confirma existencia, edición Standard/Native, nombre `(default)` ni región |
| Functions (listado de ubicaciones) | **Desconocidas**, HTTP 403 | Región, runtime Node 22 y configuración efectiva no verificables |
| Cloud Run en us-central1 | **Desconocido**, HTTP 403 | No demuestra que falten servicios ni que sus límites sean compatibles |
| Artifact Registry en us-central1 | **Desconocido**, HTTP 403 | Repositorios, ubicación efectiva, tamaño y limpieza pendientes de verificar |
| Cloud Build en us-central1 | **Desconocido**, HTTP 403 | Builds/configuración no verificables; no equivale a ausencia de costes |
| App Check / reCAPTCHA Enterprise | **Desconocidos**, HTTP 403 en ambas consultas | No se confirma proveedor, dominios, clave pública, cuotas ni protección activa |
| APIs habilitadas | **Existentes las incluidas en la lista**, `observed` | La lista no acredita recursos, uso, costes ni permisos de despliegue |

La lista incluye `storage.googleapis.com`, `datastore.googleapis.com`,
`identitytoolkit.googleapis.com`, `firebasehosting.googleapis.com`, Logging y
Monitoring, entre otras. No incluye `firestore.googleapis.com`,
`cloudfunctions.googleapis.com`, `run.googleapis.com`,
`artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`,
`firebaseappcheck.googleapis.com` ni `recaptchaenterprise.googleapis.com` como
habilitadas. **Ausencia en esa lista significa que no se observaron habilitadas,
no que sus recursos estén ausentes.** Datastore API habilitada no demuestra que
exista Firestore `(default)`. El inventario no conserva la causa detallada de cada
403: no se atribuye automáticamente a falta de API o a IAM. No se habilita ninguna
API para resolverlo durante esta actualización.

**Conclusión de compatibilidad:** identidad de proyecto correcta; objetivos de
configuración en código compatibles con la decisión de us-central1/Standard/Node 22.
La compatibilidad de recursos reales **no está demostrada**: el bucket no aparece
y las demás ubicaciones/ediciones/configuraciones relevantes son desconocidas.
Antes de crear recursos, revisar esos desconocidos en Console con el propietario;
si siguen sin poder inspeccionarse, planificar una habilitación explícita de API
tras autorización, sin asumir que se puede crear un recurso sustituto sin conflicto.

## Precios, cuotas y región: verificación pendiente

Las ocho páginas oficiales siguientes devolvieron **403 Forbidden** desde este
entorno. No se presentan tarifas recordadas como vigentes. Antes de vincular
billing, el propietario debe registrar fecha, moneda, región, cuotas incluidas y
precio de exceso en Console/calculadora. Tampoco se ha verificado aquí disponibilidad
regional actual ni IAM/App Check positivo. Si aparece otra región/edición, detenerse.

| Fuente oficial | Comprobación necesaria / factores de coste |
| --- | --- |
| [Firebase](https://firebase.google.com/pricing) | Requisitos vigentes de Blaze; franquicias de Auth/Hosting y cuotas compartidas por proyecto/cuenta |
| [Firestore](https://cloud.google.com/firestore/pricing) | Standard/Native `(default)` regional us-central1: lecturas/escrituras/borrados, almacenamiento/índices; cuota gratuita de la base elegible. PITR/backups no se presuponen gratuitos |
| [Storage](https://cloud.google.com/storage/pricing) | Bucket nuevo `*.firebasestorage.app`, Standard us-central1: GiB-mes, operaciones, descargas, transferencias y soft delete; confirmar franquicias regionales, sin aplicar condiciones de buckets antiguos `*.appspot.com` |
| [Cloud Run / Functions v2](https://cloud.google.com/run/pricing) | Invocaciones, CPU/RAM-tiempo, transferencia y modalidad de cobro/franquicias; minInstances 0 no elimina ejecución/despliegues |
| [Cloud Build](https://cloud.google.com/build/pricing) | Máquina y minutos incluidos según cuenta/tipo; builds fallidos y repetidos, sin pools privados |
| [Artifact Registry](https://cloud.google.com/artifact-registry/pricing) | Almacenamiento de imágenes/versiones y transferencia; franquicia vigente y limpieza con dry run, autorización aparte |
| [reCAPTCHA Enterprise](https://cloud.google.com/recaptcha/pricing) | Edición, evaluaciones incluidas y exceso; refrescos de App Check pueden consumir cuota, no suponer una evaluación por guardado |
| [Regiones de Functions](https://firebase.google.com/docs/functions/locations) | Node 22/us-central1; confirmar también localización efectiva de Run, AR y bucket de fuentes de builds en Console |

Estimación reproducible a completar: operaciones Firestore + GiB-mes de
metadatos/índices/instantáneas/fotos/huérfanos/soft delete + operaciones y transferencia
Storage + Run + builds + artefactos + reCAPTCHA + logs. No descontar dos veces
franquicias compartidas; revisar impuestos, moneda y descargas hacia México.
El backend v1 relee fotos para verificar cada revisión; una edición de texto puede
consumir lecturas/descargas sin subir imágenes nuevas.

**Carga de primer ensayo propuesta, no coste medido:** hasta tres cuentas ficticias,
50 guardados de texto, cinco imágenes comprimidas y dos restauraciones. Cinco
fuentes de 600.000 bytes suman como máximo 3 MB únicos, más instantáneas, metadatos,
huérfanos y descargas repetidas. No se afirma que cueste cero ni que cualquier uso
quepa en 5 USD. Las cuotas de medios están justificadas por tamaños medidos y
contienen el ensayo; su viabilidad económica real sigue pendiente de tarifas.

## Orden exacto de autorizaciones e intervenciones humanas

1. **Solo lectura, ahora:** en Cloud Shell del propietario con repositorio actualizado
   y Node 22, ejecutar `npm ci` y `npm run inspect:remote-staging -- --run`.
   Revisar resultados desconocidos/regiones en Console. No usar `firebase init` ni
   aceptar habilitar APIs para suplir un resultado desconocido. No compartir tokens.
2. **Confirmar tarifas y autorizar expresamente Blaze**, exclusivamente para
   `fullhouse-staging`. La región y objetivo mensual están aceptados; esta vinculación
   sigue sin aprobar. Verificar la cuenta de pago y residencia antes de ejecutarla.
3. **Alertas antes de crear servicios:** Google Cloud Console → Billing → Budgets
   & alerts, presupuesto mensual filtrado al proyecto, todos los servicios incluidos,
   5 USD, gasto real **20/60/100% = 1/3/5 USD**, además de previsto al 100%.
   Verificar destinatarios. Si la cuenta usa MXN, registrar el equivalente acordado;
   no confundir 5 MXN con 5 USD. Alertas y facturación tienen retraso y no frenan gasto.
4. **Autorizar recursos/APIs/IAM por separado**, después del inventario: Firestore
   Standard/Native `(default)` us-central1, bucket privado Standard nombrado en config,
   us-central1. Revisar acceso uniforme, prevención de acceso público, soft delete y
   retención; no habilitar versionado/PITR automáticamente. Aceptar dependencias de
   Functions v2/Run/Build/AR y validar roles mínimos 3C.1 con identidad dedicada.
   Separar runtime/desplegador; no dar Owner/Editor al runtime. No crear sustitutos
   si hay un recurso previo incompatible y no tocar Stellar Warriors.
5. **Autorizar App Check** con reCAPTCHA Enterprise para la app/dos dominios de
   staging, tras revisar precio/cuota. Site key pública; ningún token debug en el
   ensayo. Terminar registro/verificación/acceso/recuperación/cambio de cuenta ficticios.
6. **Autorizar PR posterior de deploy cerrado.** Esta PR no cambia barreras y el
   deploy continúa rechazado incluso con variable de consentimiento. Revisar
   artefacto/hashes, reglas/IAM y aprobar el primer despliegue solo de backend/reglas,
   manteniendo backend/cliente cerrados. No Hosting/Pages. Probar rechazos sin
   Auth/App Check y con UID ajeno: cero acceso a datos.
7. **Autorizar ensayo positivo limitado:** máximo tres UIDs ficticios, controles y
   activación explícita del backend. Cuenta Gratis sin derecho; Premium con grant
   manual de servidor `staging-owner` de hasta 24 h, sin pagos. La conexión de
   interfaz/adapter necesita revisión/autorización posterior: sigue sin importarse
   en Hosting. Dataset sintético nuevo; nunca importar automáticamente `fullhouse-v01`.
8. **Validar y medir antes de abrir más acceso:** Free texto; Free imagen rechazada;
   Premium imagen/nota; dos UIDs; CAS entre pestañas; red/acuse perdido/reintento;
   exportar/restaurar v1 con igualdad de bytes; baja Premium conserva texto,
   lectura/exportación/restauración original y bloquea referencias nuevas. Registrar
   SHA/versiones/resultados y gasto observado. Fallos de cuota se fuerzan en laboratorio,
   nunca llenando deliberadamente recursos reales.
9. **Cerrar ensayo / recuperar:** `writesEnabled:false` permite lectura e inspección
   para las cuentas autorizadas. Exportar respaldos v1 y pendientes por separado;
   inspeccionar recibos tras acuse incierto. Si hace falta, cerrar backend/allowlist
   y cliente en acción autorizada. No borrar head, revisiones, blobs o fuentes locales.
   Un redeploy anterior no revierte datos; no desvincular billing automáticamente.
   Decidir limpieza/retención de artefactos, logs y datos con el propietario.

## Límites de gasto reales

Se conservan tres UIDs, 60 RPC/min y 1.000/día por UID, 100 operaciones nuevas/día,
500 totales, 64 MiB reservados y 128 MiB/día de respuestas de lectura. Las reservas
conservadoras cuentan fotos existentes de cada candidato y no se liberan solas;
pueden bloquear antes que Premium. Son límites de ensayo, no planes comerciales.

Functions/Run: min 0, max 1, concurrencia 1, timeout 60 s ya preparados. En Console
→ Quotas & System Limits se pueden solicitar reducciones de las cuotas **editables**
de Run/Build/APIs; registrar cuáles existen y son aceptadas realmente. No hay tope
universal de factura de 5 USD en Firestore/Storage. Revisar también AR, logs y soft
delete. No se añade apagado automático por alertas: es tardío y puede interrumpir
confirmaciones/recuperación sin evitar cargos ya generados.

## Evidencia de Codex y bloqueos

Node **22.23.5**: `npm test`: **573 aprobadas, 0 fallos, 6 TODO**; incluye los **22**
nuevos casos (18 medios con puertos simulados, cuatro inventario con HTTP inyectado).
`test:remote-staging`: **17/17**. Correctos `check`, `check:remote`,
`check:remote-client`, `check:history-contract` y `check:remote-staging:node22`;
este último comprueba SDK gcfv2 cerrado y rechazo HTTP loopback 401 sin tokens.

En el intento inicial de Codex, `test:remote-staging:media:emulator` no llegó a
ejecutar sus cuatro casos: arranque código 1 al fallar la descarga del JAR.
El informe posterior del propietario acredita **4/4 de medios y 3/3 de reglas
ampliadas** en Cloud Shell, con salida 0 en ambos. Se mantiene la distinción frente
al **3/3 de 3C.1** informado anteriormente, que correspondía a la versión previa.

Chromium **156.0.8078.79**: mediciones canvas sintéticas en el contrato de medios.
No hay cambios UI y no se repitieron sus suites Chromium. Firebase real, IAM,
App Check positivo, Firefox/WebKit y dispositivos físicos no probados en 3C.2.
No se declara resuelto BUG-05 ni se conecta v2.

### Cierre documental de esta revisión

Codex repitió con Node **22.23.5**: `check`, `test:commercial-preflight` (**22/22**),
`test:remote-staging` (**17/17**), `check:remote-client` y
`check:remote-staging:node22`, todos correctos. La suite general anterior
**573 aprobadas + 6 TODO** se conserva; no se repitió por esta actualización solo
documental. No se repitieron los emuladores ni las pruebas Chromium.
Se verifican `deploymentAuthorized:false`, `remoteEnabled:false`, cliente
`enabled:false`/`appCheckSiteKey:null`, hooks de bloqueo, SDK cerrado antes de Admin
y ausencia de importación remota en los constructores de Hosting. Código, reglas,
IAM, configuraciones, backend y cliente permanecen idénticos a `59e415e`.

**3C.2 está lista para fusionarse exclusivamente como preparación desactivada**,
con la evidencia del propietario correctamente atribuida. No está lista para
activación ni para aceptar datos personales. Los emuladores ya no son un bloqueo
pendiente de esta entrega; permanecen inventario parcial, tarifas vigentes,
autorizaciones de billing/servicios/despliegue, IAM/App Check reales y política de
privacidad/retención/eliminación. Antes de cobrar Premium faltará el backend de pagos.

### Procedimiento mínimo siguiente

1. Revisar en Console los recursos desconocidos, posibles ubicaciones y edición;
   confirmar tarifas/moneda y costes secundarios. Registrar el SHA del próximo
   ensayo. No crear ni habilitar recursos durante esta inspección.
2. Obtener autorización financiera **separada** para vincular Blaze solo a
   `fullhouse-staging`; la aceptación de región y objetivo 5 USD no la sustituye.
3. El propietario vincula la cuenta aprobada y configura enseguida alertas reales
   a **1/3/5 USD** (20/60/100% de 5 USD) y prevista al 100%, con destinatarios
   verificados, antes de crear servicios. No son un hard cap.
4. Autorizar por separado APIs/recursos privados/IAM/App Check, con us-central1
   para Firestore, Storage y Functions; volver a inspeccionar antes de crear Firestore/bucket para evitar duplicados o
   ubicaciones incompatibles. No conceder Owner/Editor al runtime.
5. Preparar otra PR autorizada para el **primer deploy cerrado**, artefacto con
   hashes y backend/cliente apagados; revisar IAM y rechazos Auth/App Check/reglas.
   Ningún cambio de barreras ni deploy ocurre en esta actualización. El ensayo
   positivo con UIDs ficticios seguirá requiriendo autorización posterior.
