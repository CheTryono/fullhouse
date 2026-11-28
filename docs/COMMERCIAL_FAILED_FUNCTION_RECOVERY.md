# Recuperación cerrada y dirigida de remoteV1

Base `e57b408`, PR #32 incorporada. Rama
`feat/commercial-failed-function-recovery`. **No autoriza ni ejecuta un deploy.**

## Recurso y evidencia

El propietario informó: `fullhouse-staging`, `us-central1`, función GEN2
`remoteV1` en estado `FAILED`, build anterior
`a690a410-ec8f-4bd9-917f-581ee466b433`; servicio Run `remotev1` no encontrado.
La incompatibilidad de arranque está corregida en PR #32. No se repite una
consulta real desde Codex ni se atribuye a Codex ese inventario.

El backend cerrado conserva SHA-256:

```text
1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af
```

Esta PR no cambia el backend, el transporte original ni su artefacto. Añade un
control separado de recuperación, con **otra huella `recoveryHash`**, que vincula
el recurso inspeccionado, release, build anterior y archivos de control. La huella
real de recuperación solo se obtiene en Cloud Shell después de leer los recursos
reales. Una huella de pruebas sintéticas no puede aprobar el ensayo real.

## ¿Admite gcloud actualizar FAILED sin un Run operativo?

Sí existe esa **ruta del cliente**, comprobada en el código oficial del SDK
592.0.0: `functions/v2/deploy/command.py`, `Run()` obtiene la función y elige
`_UpdateAndWait()` si existe, sin filtrar `FAILED`. Este helper envía
`projects_locations_functions.Patch` con `updateMask`. No hace un GET a Run antes
del PATCH; la configuración de Invoker se aplica después de la actualización.

El ensayo `test:remote-staging:recovery-sdk` ejecuta **el Run y el helper de
actualización originales**, sustituyendo clientes API, subida, espera, comprobación
de APIs e Invoker por puertos sintéticos. Verifica un PATCH, ningún Create en ese
escenario, ZIP/hashes, builder dedicado y orden PATCH → Invoker. Bloquea sockets y
DNS y exige cero intentos de red. No cambia la instalación de gcloud.

Esto **no demuestra que el control plane vaya a reparar este recurso real**.
El servidor puede rechazarlo por su estado interno, permisos, copias internas de
fuentes o políticas. Solo un ensayo autorizado podrá confirmarlo. Referencias:
[deploy](https://cloud.google.com/sdk/gcloud/reference/functions/deploy),
[Functions v2 PATCH](https://cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch).

## Contrato implementado

`scripts/remote-staging-recovery.cjs` tiene tres entradas:

- Sin argumentos: plan local, sin preparar un deploy ni obtener credenciales.
- `--inspect`: prepara/verifica la release local y lee metadata real mediante
  la sesión gcloud del propietario. GETs y POSTs `testIamPermissions` /
  `getIamPolicy` del auditor; sin escritura de datos o permisos.
- `--recover`: exclusivamente después de consentimiento y hashes revisados.
  Node 22 y gcloud 592.0.0; CLI sin overrides, impersonación ni trazas HTTP.
  Auditoría/metadata fresca, comparación con la aprobación, segunda inspección
  completa y verificación de bytes justo antes del comando fijo. No admite
  destinos/flags libres ni snapshots locales como sustituto de lecturas reales.

Se comprueban obligatoriamente:

- Proyecto/número, runtime IAM mínimo y recursos de la auditoría previa; siete
  APIs observadas habilitadas, agentes Functions/Build/Run y actAs separados.
- Función exacta GEN2 **FAILED**, build anterior exacto, Node22/entry point,
  builder/runtime dedicados, repo/fuentes y capacidad fijados. `createTime` y
  `updateTime` verificables; ninguna configuración VPC/secrets/CMEK/trigger extra.
- Variables runtime y build exactamente cerradas. UIDs vacíos, activación `0`;
  no se ignoran variables desconocidas para sobrescribirlas silenciosamente.
- Build anterior `SUCCESS`, identidad efectiva, imágenes con digest SHA-256 del
  repo esperado y procedencia inmutable de fuentes en bucket dedicado o copia
  interna `gcf-v2-sources-664973716762-us-central1`. Esto valida metadata, no
  descarga ni inspecciona sus bytes ni concede acceso al bucket interno.
- Observación Run **HTTP 404 / NOT_FOUND**, sin ErrorInfo contradictorio,
  habiendo verificado los permisos de inspección. Un servicio existente, 403,
  404 sin estado RPC o APIs inaccesibles bloquean. Es una observación de esta
  credencial, no una prueba absoluta de inexistencia global.
- Lista completa de operaciones: ninguna pendiente para esta función ni destino
  pendiente desconocido. Hasta diez páginas de cien; presupuesto/paginación
  incompletos se rechazan. La función se vuelve a leer durante cada inspección.

Los permisos adicionales **se verifican, no se conceden**: Functions get/update/
sourceCodeSet, operations.list; serviceusage.services.use; cloudbuild.builds.get;
Run get/getIamPolicy/setIamPolicy, además de actAs y subida acotada ya preparados.
No se requiere `cloudfunctions.functions.create` para aprobar esta ruta. Si un
grant condicionado no aparece en la prueba de proyecto, se bloquea y se revisa
el alcance efectivo; no se propone Owner/Editor como solución.

La ruta de primer ensayo y su `assertAudit()` permanecen intactos: una función
existente sigue rechazada allí. No se falsifica `function:null` para reutilizarlos.

## Límites de concurrencia importantes

**gcloud deploy es upsert y no tiene CAS/create-only/update-only en esta ruta.**
Las dos inspecciones detectan cambios antes del comando, pero no hacen atómico el
intervalo entre la última lectura y el GET/PATCH internos del CLI. El SDK puede
entrar en Create si otro operador elimina la función en esa ventana. También
puede haber cambios concurrentes después del último chequeo.

Por eso se exige una **ventana exclusiva declarada por el propietario**, sin
otros operadores, automatizaciones, cambios de IAM/configuración o despliegues.
La variable de declaración no es un lock técnico. Si no se puede mantener esa
condición, **no usar esta ruta**: hará falta un transporte PATCH-only separado
o un mecanismo administrativo de exclusión, con otra revisión/autorización.
No se presenta la doble inspección como garantía matemática de exclusión.

Después se exige el mismo `createTime`: una recreación inadvertida no puede
presentarse como actualización confirmada. Se comprueban ACTIVE, nuevo build,
builder efectivo, imagen/digest, fuentes, runtime, capacidad, variables y política
Invoker con el verificador original. Esto detecta inconsistencias posteriores,
pero no revierte efectos ni evita cargos ya producidos.

## Cloud Shell: preparación e inspección de solo lectura

Conservar cualquier cambio local antes de cambiar de checkout. No reset/clean.

```sh
cd ~/fullhouse
git status --short
git fetch origin feat/commercial-failed-function-recovery
git switch --detach FETCH_HEAD
nvm use 24
npm ci --ignore-scripts
npm test
npm run check
nvm use 22
npm ci --prefix remote --engine-strict
npm run check:remote-staging:gcloud-node22
gcloud version
env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/remote-staging-recovery.cjs --inspect > /tmp/fullhouse-failed-recovery.json
```

Si falla, detenerse: no usar una salida parcial, no editar metadata ni ampliar
IAM. Revisar `checks`, `observed`, build anterior, fuentes, identidades, permisos,
`releaseHash` y `recoveryHash`. Compartir ese informe para revisión independiente;
no compartir tokens ni claves. Nunca generar la variable de aprobación
automáticamente desde la salida del mismo proceso.

## Ejecución futura: NO autorizada en esta entrega

Tras revisar/fusionar el código, inspección satisfactoria y aprobación explícita
del propietario de **ambas huellas**, costes y ventana exclusiva, el procedimiento
sería el siguiente. Los placeholders son deliberadamente inválidos y bloquean:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  FULLHOUSE_AUTHORIZE_FAILED_RECOVERY=fullhouse-staging \
  FULLHOUSE_RECOVERY_EXCLUSIVE_WINDOW=fullhouse-staging \
  FULLHOUSE_APPROVED_GCLOUD_RELEASE=HASH_64_APROBADO \
  FULLHOUSE_APPROVED_FAILED_RECOVERY=HASH_INSPECCION_64_APROBADO \
  node scripts/remote-staging-recovery.cjs --recover
```

El propietario debe aprobar también el binding `roles/run.invoker` para
`allUsers` **solo en el servicio**, aplicado por `--allow-unauthenticated` después
de actualizar, igual que en el contrato anterior. Auth/App Check permanecen en el
callable; no es acceso anónimo a datos. La operación puede crear revisiones,
builds, imágenes, fuentes y logs y generar cargos incluso con backend cerrado.
El presupuesto/alertas no son un límite duro.

Si se interrumpe el comando, falla la lectura posterior o el servidor no confirma:
no repetirlo ni afirmar rollback. Inspeccionar función, operaciones, build nuevo,
Run, imagen/variables y hashes con el propietario. No hay reintento de deploy ni
limpieza automática en el wrapper; gcloud sí conserva su polling/reintentos de
lectura/transporte habituales. Con un nuevo build/estado, la aprobación anterior
deja de coincidir y se necesita revisar un contrato nuevo, no reutilizarlo.

Con metadata ACTIVE confirmada, todavía faltarán ensayos reales de HTTP sin
tokens, App Check/Auth inválidos y tokens ficticios válidos → `UNAVAILABLE`, sin
activar UIDs. El cliente sigue desconectado. No se ejecutan esas llamadas ahora.

## Alternativa si el control plane no permite actualizar

No hay código de eliminación en esta entrega. Preparar una aprobación aparte que:

1. Conserve metadata, build/imágenes/digests/fuentes y evidencia del error; confirme
   cero tráfico/datos de usuarios y ausencia de operaciones en curso.
2. Revise de nuevo el recurso exacto y apruebe explícitamente eliminar **solo**
   esa función GEN2. Verifique el permiso delete sin concederlo aquí.
3. No borre buckets, objetos, Firestore, revisiones, Auth, identidades o imágenes.
   Considere las consecuencias del controlador sobre el Run asociado y retención.
4. Verifique de forma autorizada que terminó la eliminación; solo entonces
   obtenga una nueva inspección de primera creación y otra aprobación de release.
   No reutilice la autorización de recuperación para recrear.

Si hay metadata huérfana o delete falla, detenerse y revisar con Google Cloud;
no hacer eliminaciones manuales en cascada. Eliminar/recrear no es rollback
transparente: cambian identidad temporal/revisiones y pueden cambiar URL/metadata.

## Resultados de esta entrega

Ejecutados por Codex, con metadata/API/ejecución simuladas salvo las compilaciones,
el Framework local y el código original del SDK en aislamiento:

| Comprobación | Resultado |
| --- | --- |
| `npm test`, Node 24.22.1, versión final | 645 casos: **639 aprobados, 0 fallos, 0 omitidos, seis TODO previos**, 42.490 s |
| Recuperación específica | **14/14** en Node24 y Node22; simulaciones de éxito, permisos faltantes, estado/huella alterados, hashes distintos, interrupción, lectura posterior fallida y recursos recreados |
| Selección comercial Node 22.23.5 | **97/97**; tras ampliar la huella para incluir los helpers de seguridad, las 14 afectadas se repitieron y aprobaron. Las otras 83 conservan su ejecución válida |
| Arranque Node22/Functions Framework real | **16/16**, más callable cerrado por loopback, App Check/Auth sintéticos, CORS y ausencia de clientes de datos |
| SDK592, ruta original de creación/preparación | Aprobada offline; ZIP y opciones correctos; cero intentos de red |
| SDK592, Run y PATCH de recuperación | Aprobada offline; un PATCH, cero Create en el escenario FAILED, ZIP correcto y configuración Invoker posterior; cero intentos de red |
| `check`, `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Aprobadas; sintaxis de los nuevos scripts correcta |
| Release / aislamiento | SHA-256 de PR32 idéntico en Node22/24; backend, cliente, UIDs, código publicado, workflow, reglas e IAM/configuración sin cambios |

No se ejecutaron consultas reales, emuladores completos, navegador, Cloud Build
real, deploy, llamadas al endpoint ni eliminación. La inspección efectiva,
permisos actuales y viabilidad de la recuperación del control plane **siguen
pendientes del propietario**, sin declararlos aprobados por los tests sintéticos.
