# Comercial 3C.1 · preparación real de staging, desactivada

**Continuación 3C.2:** PR #24 fusionada, main `36aae0f`. El propietario aceptó
us-central1/EE. UU. y objetivo 5 USD/mes; billing, recursos, deploy y activación
siguen sin autorizar. Inventario/ensayo en [COMMERCIAL_STAGING_TRIAL.md](COMMERCIAL_STAGING_TRIAL.md)
y política de medios en [COMMERCIAL_MEDIA_ENTITLEMENTS.md](COMMERCIAL_MEDIA_ENTITLEMENTS.md).
Los resultados/propuestas originales y su atribución se conservan a continuación.

Base `b06c691`, PR #23 fusionada. Solo `fullhouse-staging`; no Stellar Warriors,
Pages, producción ni historial v2. No se han creado recursos, vinculado facturación,
desplegado reglas/Functions ni migrado datos. Authentication y Hosting existentes
siguen usando sus controles y guardado local anteriores.

## Qué se prepara

- `firebase.remote-staging.json`: codebase `remote-staging-v1`, Node 22, base
  `(default)` y bucket **nombrados explícitamente**. No incluye Hosting. Hooks de
  predeploy en Functions, Firestore y Storage; todos rechazan el despliegue mientras
  `remote-staging/settings.json` tenga `deploymentAuthorized: false`.
  La configuración demo anterior también recibe hooks que **siempre** rechazan
  deploy; no cambian sus reglas, backend ni puertos, ni la ejecución de emuladores.
- `build:remote-staging`: artefacto privado ignorado en Git, lista cerrada de archivos,
  dependencias/lock exactos de 3A, servicio y validador v1 sin modificaciones. Hashes
  del código, configuración y reglas; el gate detecta artefactos/configuración obsoletos.
- Un callable v2 `remoteV1` con `{method,input}`; métodos save/read/restore/inspect.
  Solo cambia el transporte: comandos, respaldos **version: 1**, CAS, revisiones
  inmutables, recibos, hashes y restauración de 3A se reutilizan.
- `remoteEnabled: false` y ausencia de `FULLHOUSE_REMOTE_STAGING_ENABLED=1` cierran
  el backend antes de inicializar clientes Admin. Después de una autorización
  futura también serán necesarios control y accesos explícitos en Firestore.
- `remote-client/staging.ts`: factory preparatoria, **no importada** por los
  constructores de Pages/Staging. Su configuración de ejemplo está desactivada y
  sin clave pública App Check. No abre IndexedDB ni envía peticiones con esa configuración.
  La factory es asíncrona: en una prueba habilitada exige proyecto/app/bucket/origen
  exactos y Auth con aud/iss/sub esperados **antes de crear/abrir el almacén local**.
  Devuelve `active()` para que el futuro bootstrap oculte/pause el workspace al
  cambiar el objeto de Auth, incluso con un UID idéntico. Una nueva sesión debe
  volver a validar la identidad; puede recuperar sus IDs desde el mismo diario.
  El servidor vuelve a verificar los tokens. No se siguen redirecciones ni se
  envían cookies en el transporte remoto.
- 3B/3B.2 admiten una capacidad de entorno validada: namespace y base IndexedDB
  `fullhouse-staging-work-v1` separados del demo. El comportamiento demo por defecto,
  sus claves y sus diarios existentes no cambian. Recuperar un paquete de otro
  UID/proyecto se rechaza. Persistencia local durable precede al envío; los IDs y
  bases sobreviven a reintentos. Nunca se importa `fullhouse-v01` ni su alias.

**No es una activación de interfaz.** Falta conectar explícitamente la factory y
App Check al bootstrap de Staging en la siguiente PR autorizada. No se puede activar
el planificador actual cambiando solamente un JSON.

## Configuración a autorizar personalmente

| Servicio | Propuesta inicial | Acción en Console, únicamente tras autorizar |
| --- | --- | --- |
| Facturación | Blaze solo en `fullhouse-staging`; presupuesto de ensayo propuesto **5 USD/mes**, no estimación garantizada ni tope | Billing: revisar cuenta de pago; crear alertas real/prevista a 1, 3 y 5 USD y sus destinatarios. Autorizar expresamente la vinculación |
| Firestore | **Standard / Native**, `(default)`, regional **us-central1** | Confirmar que no exista ya otra edición/localización; si existe, detenerse y revisar. Crear solo tras aprobación; no crear otra base automáticamente |
| Cloud Storage | Bucket `fullhouse-staging.firebasestorage.app`, Standard regional **us-central1** | Comprobar existencia/región real; el nombre en firebaseConfig no prueba que exista. Elegir ubicación al crearlo; acceso uniforme, prevención de acceso público, sin versionado/lifecycle automático. Revisar soft delete y su coste |
| Functions | v2, **us-central1**, Node 22, 512 MiB, CPU `gcf_gen1`, minInstances 0, maxInstances 1, concurrencia 1, 60 s | Autorizar APIs/dependencias Cloud Run, Build y Artifact Registry; crear identidad dedicada y revisar cuotas antes del primer deploy desactivado |
| App Check | reCAPTCHA Enterprise, app Web oficial de staging | Registrar proveedor y dominios web.app/firebaseapp.com; obtener site key **pública**. Revisar precio/cuotas del proveedor. No publicar tokens debug ni claves privadas |
| Auth/Hosting | Conservar los existentes | Terminar pruebas reales de registro, verificación, acceso y recuperación con cuentas ficticias. No redeploy de Hosting en esta PR |

**Región:** us-central1 es una propuesta común a los servicios y al laboratorio
existente; reduce transferencias entre regiones y evita cambiar rutas. Los datos
estarían en EE. UU., no México. Confirmar disponibilidad/condiciones actuales en
Console y aceptar residencia antes de crear recursos: las ubicaciones no se cambian
como una preferencia de interfaz. Si se exige residencia mexicana, revisar juntos
las regiones de todos los servicios; no crear recursos con ubicaciones mezcladas.

**Estado observado:** la consulta de solo lectura `firestore:databases:list` no pudo
autenticarse. No se conoce la edición/ubicación real de una base o bucket existente.
No se pidió ni creó una sesión CLI, token o cuenta de servicio. Los pasos humanos
posteriores usan `firebase login --no-localhost` desde la cuenta del propietario;
no se comparten credenciales en ChatGPT.

## Reglas e IAM mínimos propuestos

Reglas **prototipo** de Firestore real: denegación total a SDK clientes, incluidos
head/metadatos, controles y cuotas. Storage sigue denegando todo acceso directo.
La interfaz no necesita consultas SDK: usa el callable con Auth verificado y
App Check. Deben compilarse y verificarse en emuladores antes de desplegarlas.
Las reglas 3A de laboratorio no cambian. Admin SDK **omite Security Rules**: el
backend impone UID, integridad y límites, e IAM limita su capacidad.

| Identidad | Permisos / alcance |
| --- | --- |
| Cliente Web | Ningún rol IAM; sin lectura/escritura directa de Firestore/Storage ni URLs públicas/tokens de descarga. Firebase ID token verificado, correo verificado y App Check en cada RPC |
| Runtime `fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com` | Roles personalizados propuestos en `remote-staging/iam.json`: Firestore get/create/update y transacciones, sin delete/list; Storage objects.get/create, sin delete/list, limitado al bucket y prefijo `users/`. No Owner/Editor ni permisos de Auth/billing |
| Desplegador humano/CI | Cloud Functions Developer, Firebase Rules Admin y lectura de configuración/servicios necesaria para CLI; Service Account User **sobre la identidad de runtime**. El CLI puede comprobar permisos de índices aun desplegando reglas; otorgar solo lo necesario tras revisión. Nunca reutilizar la identidad de runtime para desplegar |
| Publicación del callable | Permisos Run get/getIamPolicy/setIamPolicy de `deployerInvokerPolicy`, acotados a `remotev1` cuando sea posible. `invoker: public` permite llegar a la pasarela HTTPS, **no** acceder a datos sin Firebase Auth/App Check y autorización del backend |
| Build/service agents | Identidades gestionadas de Cloud Functions/Cloud Build/Artifact Registry, separadas del runtime. Revisar las que realmente elija el proyecto y los permisos de build/lectura del source/escritura del repositorio. No dar Editor a las cuentas predeterminadas para resolver errores |
| Operador de recuperación | Solo el propietario autorizado; borrado/exportación administrativa fuera del runtime. Los roles anteriores no ejecutan un borrado automático |

Los roles personalizados son una propuesta pendiente de validación real. Firestore
IAM no separa documentos por UID; el aislamiento depende del código revisado y de
un proyecto dedicado. En Storage usar una condición de recurso sobre
`projects/_/buckets/fullhouse-staging.firebasestorage.app/objects/users/` y verificar
create/get con la identidad real. Ante PermissionDenied identificar el permiso,
no ampliar a Owner. No se crean roles/bindings con esta PR.

## Autorización, abuso y capacidad

Tras habilitarse expresamente, el backend requiere simultáneamente:

1. Proyecto real exacto, Node 22 y **ninguna variable de emulador/Firebase debug**.
   Se rechazan los flags SDK que podrían omitir la verificación de tokens.
2. ID token validado por el SDK callable; correo verificado y App Check con el appId oficial.
3. UID en `FULLHOUSE_STAGING_TEST_UIDS` (máximo **tres**, separados por coma, sin espacios).
   Es una lista de cuentas ficticias elegidas por el propietario, no autoinscripción.
4. `stagingControl/remoteV1`: `{enabled:true,writesEnabled:true}` y
   `stagingAccess/{uid}`: `{enabled:true}`. Solo IAM servidor/operador puede editarlos.

La admisión transaccional por UID se cobra antes de parsear/hash de respaldos grandes.
Límites iniciales de ensayo: **60 RPC/min**, **1.000 RPC/día**, **100 operaciones nuevas/día**,
**500 totales**, **64 MiB reservados acumulados** y **128 MiB/día de respuestas de lectura**.
V1 conserva 8 MiB por respaldo, 2 MiB por fuente fotográfica, 2.000 adjuntos y sus
límites de profundidad/nodos. La selección local de originales conserva 12 MiB.

La reserva de una operación es idempotente por ID/base/contenido. Para saves reserva
snapshot + fotos del paquete; sobrecuenta fotos que ya existen. Restore reserva
conservadoramente hasta 17 MiB. Fallos/conflictos pueden dejar objetos y reservas;
**no se liberan automáticamente**, para no afirmar rollback ni perder recuperaciones.
Si se llena, bloquear y exportar/revisar; no borrar versiones para continuar.
Estos límites son para el ensayo, no un plan comercial de almacenamiento.

App Check no identifica al usuario, no prueba que toda petición sea humana y no
impide todos los replays. No se consume el token en esta entrega; IDs/CAS evitan
duplicar commits, no el coste de invocaciones. Incluso peticiones rechazadas y
lecturas de cuota pueden generar costes. maxInstances y presupuestos **no son un
tope monetario** ni garantizan exclusión durante despliegues. No hay gasto autorizado.

## Costes: fuentes, carga y limitación de verificación

Consulta intentada el **24 de noviembre de 2026**: Firebase/Google Cloud devolvieron
**403** desde este entorno, también al reintentar la página de precios. No se
certifican tarifas actuales ni franquicias gratuitas; deben verificarse en estas
fuentes y la calculadora/Console antes de aceptar Blaze:

- [Firebase pricing](https://firebase.google.com/pricing)
- [Firestore pricing](https://firebase.google.com/docs/firestore/pricing)
- [Cambios de facturación Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing)
- [Cloud Run pricing](https://cloud.google.com/run/pricing), [Functions configuración](https://firebase.google.com/docs/functions/manage-functions)
- [Ubicaciones Functions](https://firebase.google.com/docs/functions/locations)
- [App Check callable](https://firebase.google.com/docs/app-check/cloud-functions)
- [Presupuestos: no son un cap de gasto](https://cloud.google.com/billing/docs/how-to/budgets)

Modelo verificable: coste de lecturas/escrituras Firestore + GiB-mes Storage +
operaciones Storage + transferencia al cliente + CPU/memoria/solicitudes Functions
+ builds/imágenes/logs + proveedor reCAPTCHA. Restar solo franquicias que Console
confirme aplicables al proyecto/región. Concurrencia 1 y minInstances 0 evitan
instancias mínimas de pago, pero no eliminan los otros conceptos.

Ensayo propuesto: tres cuentas, diez guardados por cuenta con paquetes de 1 MiB y
100 lecturas de 1 MiB durante el mes: aproximadamente 30 MiB de paquetes de escritura
y 100 MiB de salida, antes de deduplicación/escape JSON/verificaciones. Los controles
añaden transacciones; el servicio verifica snapshots y fotos en cada confirmación.
Fotos numerosas, revisiones completas, reintentos, lecturas repetidas, imágenes de
build y soft delete dominan el crecimiento. No extrapolar este ensayo a años de uso.

**Coste de activaciones realizadas por esta PR: ninguno (no hay activaciones).**
**Objetivo de presupuesto para el ensayo: 5 USD/mes, sujeto a cotización humana**, no
promesa de factura. Introducir las cantidades anteriores y los SKU/regiones en la
calculadora; registrar la estimación aprobada antes de vincular pago. Alerta superada:
pasar a solo lectura, inspeccionar métricas/recibos y decidir explícitamente; los
avisos pueden llegar tarde y no cortan el gasto. No se configura un autoapagado de
facturación que pueda destruir capacidad de recuperación.

## Política mínima propuesta, pendiente de aprobación

- Ensayo inicial **solo sintético**. No hay migración, asociación de datos locales,
  limpieza de fuentes ni aceptación de información personal en esta entrega.
- Conservar revisiones, recibos y blobs referenciados mientras exista la cuenta,
  dentro del límite acordado. No activar TTL/lifecycle por edad: eliminar una revisión
  puede romper un recibo y una foto puede estar compartida por varias revisiones.
- Exportar JSON v1 completo con comprobación de hashes, además del paquete durable
  pendiente cuando corresponda. Restaurar explícitamente en una revisión nueva con
  base/CAS; nunca sustituir la cabeza por la fecha más reciente.
- Quitar una foto del documento actual **no borra sus bytes de revisiones previas**.
  Antes de usuarios reales, aceptar esta retención de versiones y explicarla, o
  aprobar un diseño de borrado individual compatible. No prometer eliminación total
  si el usuario conserva respaldos descargados.
- Solicitud de eliminación de cuenta: propuesta de plazo máximo **30 días**,
  desactivar primero su acceso remoto, revocar sesiones, ofrecer exportación si la
  solicita, inventariar objetos/referencias, y borrar datos/objetos/Auth por un
  operador con confirmación y verificación posterior. No implementado/ejecutado aquí.
  Confirmar soft delete, logs y cualquier retención del proveedor; no prometer
  borrado físico inmediato de todas las copias.
- Copias locales: no cifradas por UID. Diseñar limpieza explícita del dispositivo
  compartido sin tocar `fullhouse-v01`/alias ni trabajo de otras cuentas. El cierre
  forzado puede perder cambios anteriores a `complete`; conservar exportaciones.

Aceptar personas reales requiere aprobar esta política y un procedimiento operativo
de borrado comprobado con cuentas ficticias. No se impone retención irreversible.

## Despliegue futuro reproducible y reversión

**Comandos de preparación sin despliegue**, con Node 22 y Java 21:

```sh
npm ci
npm ci --prefix remote
npm run build:remote-staging
npm run check:remote-staging:node22
npm run test:remote-staging
npm run test:remote-staging:rules
npm run check
npm run check:remote-client
npm test
```

Antes de cualquier deploy: autorización escrita de servicios/coste/región, Console
verificada, autenticación personal de CLI, IAM y App Check preparados, reglas
compiladas en emulador y copia/exportación de datos de ensayo. Una PR posterior
podrá cambiar **solo `deploymentAuthorized`**, manteniendo backend/cliente apagados.
Trabajar con un commit revisado, árbol limpio y artefacto recién construido.

**Solo después de dicha autorización** (no se ejecuta en 3C.1):

```sh
FULLHOUSE_AUTHORIZE_STAGING_DEPLOY=fullhouse-staging npx firebase deploy \
  --project fullhouse-staging --config firebase.remote-staging.json \
  --only firestore:rules,storage,functions:remote-staging-v1
```

El hook recibe `GCLOUD_PROJECT` del CLI, verifica Node/proyecto/consentimiento y los
hashes. Cualquier cambio de código/configuración requiere recompilar y revisar.
Es una barrera contra errores, no contra alguien que modifique intencionalmente el
código o use otro config. La configuración actual **rechaza** el comando.

Para el primer deploy cerrado no se crea archivo de activación. En una PR posterior
que habilite el backend, el propietario podrá preparar **fuera de Git**, después
del build, `dist-remote-staging/.env.fullhouse-staging` con exactamente dos líneas:

```dotenv
FULLHOUSE_REMOTE_STAGING_ENABLED=1
FULLHOUSE_STAGING_TEST_UIDS=UID_SINTETICO_A,UID_SINTETICO_B
```

El hook solo acepta esas dos variables no secretas y hasta tres UIDs únicos;
no permite tokens, credenciales ni variables adicionales. Los valores del ejemplo
deben sustituirse por UIDs reales de las cuentas ficticias autorizadas. El fichero
no existe en esta entrega y no se copia automáticamente desde otro entorno.

Primer deploy cerrado: probar App Check ausente/inválido, Auth de otro proyecto y
confirmar que no se crean documentos. Tras nueva autorización, habilitar backend,
variable de entorno, control y hasta tres UIDs ficticios; conectar cliente/App Check
en una PR específica, sin importaciones automáticas. Probar A/B, dos sesiones,
cuota, red, acuse perdido, recarga/fotos grandes, conflicto y restauración completa,
incluida la expansión del respaldo JSON en el tamaño HTTP real de la pasarela.
Conservar/exportar también los datos locales de cuenta que ya existan en Staging;
no asociarlos automáticamente al activar el cliente remoto.

Reversión operativa: poner `writesEnabled:false` conserva read/inspect para recuperar
recibos y exportar; `enabled:false` cierra toda la API ante un incidente de acceso.
Las peticiones en curso podrían haber confirmado: inspeccionar recibos antes de
reintentar. Mantener candidatos durables. Volver a un artefacto revisado compatible,
sin borrar bases/buckets/cuentas ni desplegar Pages. Volver al antiguo Planner
local **no** hace visibles automáticamente los datos remotos: no es rollback de datos.

## Pruebas y estado de salida

Las pruebas nuevas usan datos/puertos simulados y fake-indexeddb; no verifican IAM,
App Check positivo real, regiones, latencia o cuotas del proveedor. El script Node22
carga el SDK real, prueba el handler apagado y rechaza por HTTP loopback una llamada
sin App Check. Los informes del propietario de 3A/3B/3B.2 no certifican esta adaptación.

| Comprobación ejecutada | Resultado |
| --- | --- |
| Node **22.23.5**, suite completa `node --test tests/*.test.cjs` (equivalente a `npm test`) | **551 aprobadas, 0 fallos/canceladas/omitidas, 6 TODO previos** (557 casos) |
| `test:remote-staging` | **17/17**, guardas, cuotas, fotos v1, CAS, contextos, reintento y configuración de activación; puertos simulados/fake-indexeddb |
| `check`, `check:auth`, `check:remote`, `check:remote-client`, `check:history-contract` | Aprobadas; TypeScript/app.js siguen sincronizados sin escribirlos |
| `check:remote-staging:node22` | SDK real v2, opciones de capacidad y handler cerrado; HTTP loopback sin App Check recibe 401 |
| Esquemas de ambos configs nuevos | Aceptados por el JSON Schema del CLI fijado 15.37.0; no es un dry-run cloud |
| Chromium 156 · 3B y 3B.2 | 1280/390, Auth real en emulador, datos simulados, IDB real: dos cuentas, conflictos, foto asíncrona, paquete 12 MB, PNG 7,87 MB, cierre, cuota y recuperación; 0 errores JS |
| Nuevas reglas · intento local anterior de Codex | Bloqueado **antes de ejecutar**: descarga del JAR Firestore. Este intento local no se declara aprobado |
| Nuevas reglas · Cloud Shell, informe del propietario | **3/3 aprobadas**, cero fallos/canceladas/omitidas/TODO; `npm run test:remote-staging:rules`, salida 0. Evidencia atribuida abajo |

### Reglas en Cloud Shell · evidencia proporcionada por el propietario

El propietario comunicó la ejecución de `npm run test:remote-staging:rules` sobre
`feat/commercial-real-staging-preparation` en Google Cloud Shell con este resumen:

| Resultado informado | Valor |
| --- | --- |
| Pruebas | 3 |
| Suites | 0 |
| Aprobadas | 3 |
| Fallos | 0 |
| Canceladas | 0 |
| Omitidas | 0 |
| TODO | 0 |
| Duración | 4344.562951 ms |
| Salida del script | 0, ejecución satisfactoria |

Codex **no ejecutó estas pruebas en Cloud Shell**. Se conserva por separado su
intento local bloqueado y las demás verificaciones anteriores. No se proporcionó
el SHA probado ni las versiones de Node/Java; no se infieren de la rama.

El comando preparado utiliza Auth, Firestore y Storage **emulados**, en el proyecto
demo y endpoints loopback. Los tres casos comprueban la denegación de acceso directo
para anónimo, propietario verificado y otra cuenta verificada, incluidas operaciones
de escritura y elevación de permisos. Es evidencia distinta de los 17 casos de
servicio simulado/fake-indexeddb y de las pruebas Chromium anteriores. No demuestra
IAM, App Check positivo ni funcionamiento con servicios reales.

Al registrar el informe, Codex revisó `5ca7e6f`, coincidente con la cabeza remota:
`deploymentAuthorized` y `remoteEnabled` siguen en **false**; el cliente de ejemplo
mantiene `enabled:false` y `appCheckSiteKey:null`, y la factory no se importa desde
Auth/Hosting publicados. Los hooks de todos los servicios reales siguen bloqueados
y la configuración demo continúa rechazando cualquier deploy. Se repitieron
`test:remote-staging` (**17/17**), `check:remote-client` y la comprobación SDK local
con Node **22.23.5**: handler cerrado y HTTP sin App Check rechazado con 401. No se
repitieron la suite general ni Chromium para esta actualización documental.
Backend, cliente, reglas, configuración y despliegues no se modifican.

**3C.1 está lista para fusionarse exclusivamente como preparación desactivada**.
Para 3C.2, primero confirmar en Console recursos existentes, regiones y tarifas,
y obtener autorización expresa para facturación/servicios y presupuesto de
`fullhouse-staging`. Esa autorización todavía no está concedida. El primer
despliegue posterior deberá mantener backend y cliente cerrados, conforme al
procedimiento anterior; esta actualización no cambia ninguna bandera.

### Limitaciones y verificaciones anteriores que se conservan

La revisión reprodujo un defecto de la primera factory de esta rama: validaba el
proyecto al enviar, después de abrir IDB. Con un UID idéntico de otro proyecto y
un diario pendiente podía marcarse la sesión local como lista. Se corrigió antes
de conectar la factory: la nueva regresión comprueba rechazo previo a cualquier
apertura de IDB y revocación de la concesión anterior, sin cambiar el formato v1.
No afectaba al Planner publicado ni a 3B.2: la factory nueva nunca estuvo conectada.

Se conservan las guardas PR #19 y los seis TODO; no se declara resuelto el historial
v2. El viewport móvil de Chromium no demuestra Android/iPhone físicos; Firefox,
WebKit y dispositivos físicos no se probaron. Los resultados anteriores del
propietario se conservan con su autoría y no sustituyen estas pruebas nuevas.

El bloqueo de descarga de Firestore Emulator sigue siendo una limitación local de
Codex; el informe del propietario aporta la ejecución satisfactoria de los tres
escenarios de reglas en Cloud Shell. Siguen pendientes las tarifas oficiales y la
sesión Firebase CLI para una futura operación autorizada, además de IAM y App Check
positivo reales. Esta actualización no activa Blaze, Firestore, Storage, Functions
ni App Check.
No se ha probado Node22 en Cloud Functions desplegado ni navegador/dispositivo real
contra este backend. 3C.1 entrega preparación revisable, **no autorización de activación**.
