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

**Inventario real pendiente:** no hay gcloud/sesión disponible aquí; el script
termina con código 2 antes de consultar. También `firebase firestore:databases:list
--project fullhouse-staging --json` rechazó la operación por falta de autenticación.
El Hosting/Auth existente se conoce por
el informe del propietario. firebaseConfig no acredita que exista una base/bucket.

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

Nueva suite `test:remote-staging:media:emulator`: cuatro casos preparados,
**no ejecutados**; arranque código 1 al fallar descarga del JAR de Firestore.
Se amplía el test de reglas con intentos sobre derechos/inventario: pendiente de
ejecutar `test:remote-staging:rules` en Cloud Shell. El **3/3 del propietario de
3C.1** acredita la versión anterior, no esos intentos añadidos. No cambia su autoría.

Chromium **156.0.8078.79**: mediciones canvas sintéticas en el contrato de medios.
No hay cambios UI y no se repitieron sus suites Chromium. Firebase real, IAM,
App Check positivo, Firefox/WebKit y dispositivos físicos no probados en 3C.2.
No se declara resuelto BUG-05 ni se conecta v2.

**Revisable como preparación, no lista para activar:** faltan inventario/tarifas,
emuladores nuevos/reglas ampliadas, autorizaciones de billing/servicios/despliegue,
IAM/App Check reales y política de privacidad/retención/eliminación aprobada.
Antes de cobrar Premium faltará el backend de pagos y pruebas de su ciclo de derechos.
