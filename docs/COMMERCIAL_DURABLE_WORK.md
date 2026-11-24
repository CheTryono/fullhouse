# Comercial 3B.2 · persistencia durable y recuperación de trabajo

Base: PR #22 / `5955fb9`. Implementación exclusivamente en el laboratorio comercial v1. No se importa el motor histórico experimental, no se activa almacenamiento remoto en usuarios ni se cambia Pages o Staging.

## Implementación

`remote-client/durable-store.ts` abre **`fullhouse-lab-work-v1`**, versión física 1, con `journals`, `drafts` y `photos`. Las filas y su índice `owner` incluyen proyecto demo y UID; cada instancia rechaza claves de otra cuenta y proyectos reales. Sin IndexedDB, acceso denegado, esquema incompleto o versión incompatible, se bloquea la ruta: no se borra la base ni se utiliza localStorage como fallback.

| Almacén | Contenido y confirmación |
| --- | --- |
| journals | Operación, UID/proyecto, revisión base, candidato v1 y última revisión conocida. ID inmutable; inserción idempotente por bytes. Archivo/eliminación con comprobación de contenido y una sola transacción |
| drafts | Checkpoint por ventana, ID aleatorio estable, generación CAS, hash SHA-256 y campos de formulario/notas. No modifica registros confirmados |
| photos | Original File/Blob, ID propio y contexto de selección: evento, fecha, paso y base. Se escribe **antes** de FileReader, compresión o posible cambio de sesión |

Las transacciones solicitan `durability: strict` cuando el navegador lo admite; se espera `complete`, no el éxito de un `put`. Es una garantía de la API, no de conservación física ante cualquier fallo. No se aumenta la versión de ninguna base experimental anterior.

### Candidatos y confirmación remota

Planner conserva su interfaz síncrona: aceptar un candidato permite mostrarlo en memoria, **no** significa que esté guardado. El panel distingue `memory`, `writing`, `durable` y `error` de los estados remotos pendiente/confirmando/confirmado/error/conflicto. No se hace ninguna petición de guardado hasta completar la copia IndexedDB. Ante cuota/aborto queda el candidato RAM, su ID y la revisión confirmada anterior; se bloquean nuevas acciones y se ofrece reintento/exportación.

Tras el recibo se verifica su identidad, base, secuencia y hash, y se confirma la limpieza local. Si el servidor pudo confirmar pero falló la respuesta o la limpieza, no se afirma rollback: el reintento inspecciona el mismo recibo. Los conflictos entre dispositivos conservan ambas ramas; no hay mezcla, rebase, cola de acciones ni elección por fecha.

Se mantiene el respaldo **version: 1** y el límite servidor **8 MiB por documento**, **2 MiB por fuente fotográfica**. El diario local contiene base y candidato: puede casi duplicarlos y el escape de cadenas JSON puede duplicarlos otra vez. El límite defensivo del paquete de recuperación es 34 MiB; no cambia el límite remoto. Se prueba también un respaldo válido con abundantes caracteres escapados.

### Recuperación explícita

- **Exportar candidato v1**: respaldo portable de los hechos del candidato; no acredita confirmación remota.
- **Exportar paquete pendiente**: diario con UID/proyecto, ID de operación, base y candidato, disponible incluso si IndexedDB falló y solo existe en RAM. Contiene información privada; conservarlo en un lugar seguro.
- **Recuperar paquete pendiente de esta cuenta**: consentimiento, validación v1, identidad/hash de base, misma cuenta/proyecto, copia transaccional; no envía automáticamente. Si la cabeza remota cambió, conserva el conflicto.
- Las copias de la antigua integración 3B en localStorage se inspeccionan **solo** bajo el prefijo exacto proyecto/UID. Se requiere copia explícita antes de continuar escribiendo; se conserva íntegra la fuente y una huella de la copia realizada. No se leen ni importan `fullhouse-v01` o `botanica-planificador-v01`.
- Los candidatos archivados siguen exportables. No se purgan fotos, originales, respaldos o ramas automáticamente. Una copia archivada es un candidato de recuperación, no la revisión elegida por el servidor.

La actualización se prepara para un origen de laboratorio sin pestañas de versiones 3B antiguas abiertas. No promete coordinación con código antiguo que desconozca IndexedDB. Ese código solo escribe en su espacio localStorage; no puede sobrescribir una revisión remota sin CAS. La adopción pública y su política de pestañas requieren una entrega posterior.

## Borradores sin enviar

`remote-client/drafts.ts` observa actualizaciones de Planner y cambios de campos; agrupa durante 200 ms. Captura formularios de metas/rutinas/eventos/progreso, editor anidado desde una programación, notas generales/por paso con su clave exacta, revisión diaria y texto numérico aún sin confirmar. Conserva también el candidato local de BUG-01 para exportación cuando exista.

La UI dice **protegido** solo tras completar la transacción de la última generación observada. Si falla, conserva la copia previa, advierte y permite exportar el estado actual. Cerrar un formulario no elimina su copia anterior mientras el candidato aún no tiene copia local durable.

Al reabrir no se envía ni aplica un borrador automáticamente. Para aplicarlo deben coincidir UID, proyecto, base/candidato confirmado, hash de los datos, build de Planner/adaptador y zona horaria. Requiere consentimiento y ningún trabajo abierto. Se comprueba otra vez el contexto tras las esperas asíncronas. Se restauran las claves originales; nunca se buscan pasos por nombres ni se reasignan notas.

Si la base, interfaz o zona cambió, queda la exportación para recuperación manual, sin sustitución de datos. Los valores numéricos sin confirmar se muestran como texto para copia manual, sin adivinar controles por su posición. Una revisión diaria de otra fecha se presenta como texto fechado: no se atribuye a hoy. El paquete de borrador es recuperación de interfaz, **no** un respaldo completo importable en Ajustes. Solo admite recuperación de copias producidas por esta interfaz; no se importan archivos de borrador arbitrarios.

Las copias antiguas permanecen enumeradas hasta su eliminación explícita con confirmación y CAS. Nunca se elige automáticamente una por ser más reciente. La copia activa se actualiza; no es un historial de cada pulsación.

## Fotografías y capacidad

El original se conserva antes de procesarlo, bajo la cuenta y contexto iniciales. Si cambia la sesión, el procesamiento/guardado espera el regreso de esa misma cuenta. Una foto pendiente de compresión sobrevive al cierre **solo si** su transacción original completó. Tras reabrir se puede descargar el original; no se vuelve a adjuntar automáticamente, pues el mismo procesamiento pudo haber creado un candidato confirmado antes de perder el acuse. Adjuntarla de nuevo es una acción explícita que debe considerar las evidencias ya presentes.

Una foto cuyo almacenamiento falló se conserva en RAM, se ofrece descarga y reintento de copia. No se inicia su procesamiento como si estuviera protegida. El panel diferencia original recuperable de foto adjuntada. Las evidencias comprimidas del candidato conservan IDs, notas, marcas y bytes; las guardas históricas de PR #19 no cambian.

Se conserva el límite de selección de 12 MiB del Planner. Las copias originales nuevas se retienen en el laboratorio para recuperación; no hay purga automática ni política pública nueva de retención/borrado. Antes de activarlo con usuarios hay que aprobar limpieza explícita de originales y candidatos archivados, sin borrar evidencias activas ni fuentes preexistentes.

`navigator.storage.estimate()` es orientativo; no reserva espacio. `persist()` se solicita solo por acción del usuario; puede rechazarse y no protege del borrado del sitio/perfil. Las fotos Blob evitan duplicar el original como base64 en borradores; el candidato remoto sigue siendo el respaldo v1 completo. Se mantiene su coste de serialización y memoria, sin prometer escalabilidad indefinida.

## Qué sobrevive realmente

| Situación | Recuperable |
| --- | --- |
| Candidato con transacción IDB completada | Diario e ID originales, incluso sin red; requiere autenticarse de nuevo al cerrar la sesión/pestaña |
| Formulario/nota con último checkpoint confirmado | Copia local; aplicación condicionada a coincidencia del contexto o exportación manual |
| Foto original con transacción completada | Bytes descargables y contexto de selección; no prueba que estuviera adjunta |
| Fallo de red o acuse perdido | Candidato durable, inspección de recibo y reintento idempotente |
| Cambio de cuenta | Copias y trabajo anterior aislados por UID; no se presentan a la cuenta nueva |
| Últimas teclas, candidato o foto antes de `complete` | Pueden perderse. Exportar antes de cerrar si hay error o escritura pendiente |
| Borrado del sitio, expulsión, perfil privado finalizado o fallo físico | IndexedDB puede perderse; hacen falta respaldos externos/revisiones remotas confirmadas |

`beforeunload` advierte mientras hay trabajo no resuelto o sin proteger. `pagehide`/visibilidad intentan guardar, pero no se promete que terminen al cerrar forzosamente. No es una garantía de recuperación de todas las teclas. Sin candidato local, una nueva sesión todavía necesita consultar el backend: no se implementa una aplicación offline completa ni sincronización en tiempo real.

## Comprobación y evidencias

```sh
npm ci
npm run check
npm run check:auth
npm run check:history-contract
npm run check:remote
npm run check:remote-client
npm run test:remote-durable
npm run test:remote-client
npm run test:regression
npm run test:remote
npm test
npm run test:remote:planner:simulated
npm run test:remote:planner:browser:simulated
npm run test:remote:durable:browser:simulated
```

Los drivers Chromium necesitan Playwright disponible y `FULLHOUSE_CHROMIUM` (por defecto `/usr/bin/chromium`). En Codex se utiliza `NODE_PATH=/workspace/.fullhouse-tools/node_modules`. Los emuladores se ejecutan en serie, usando puertos de laboratorio. `fake-indexeddb` es dependencia **solo de desarrollo** para CAS, abortos y pruebas deterministas, distinta de IndexedDB real.

Resultados ejecutados por Codex sobre esta entrega (Node 24.22.1, Java 21):

| Verificación | Resultado |
| --- | --- |
| `check`, `check:auth`, `check:history-contract`, `check:remote`, `check:remote-client` | Aprobadas; app.js coincide con TypeScript sin escribirlo |
| `test:remote-durable` | 15/15, fake-indexeddb; incluye paquete de 19,2 MB por escape de cadenas y recuperación RAM |
| `test:remote-client` / `test:remote` | 13/13 y 8/8 |
| `test:regression` | 194/194 |
| `npm test` | 534 aprobadas, 0 fallos/omitidas/canceladas, 6 TODO previos (540 casos) |
| `test:remote:planner:simulated` | 7/7 HTTP; Auth emulado real, datos simulados; añade cierre/reapertura de IDB simulada y fotografía explícita |
| Chromium · recorrido previo 3B | 1280 y 390: confirmación, acuse perdido, dos sesiones/CAS, cambio de cuenta y foto asíncrona; 0 errores JS |
| Chromium · nuevo recorrido durable | IDB real: paquete de **12.003.226 bytes**, exportación/restauración en contexto nuevo con el mismo ID, recarga, copia de formulario/nota y aislamiento A/B |
| Chromium · foto original | PNG de **7.871.695 bytes** en la última ejecución, generación sintética aleatoria; cierre durante procesamiento y descarga con igualdad SHA-256, sin adjuntarla automáticamente |
| Chromium · capacidad y aborto | Rechazo real `QuotaExceededError` al reducir la cuota por CDP y escribir Blob de 12 MiB; fila previa intacta. Aborto tras escribir dentro de TX: ninguna fila parcial al reabrir |
| Chromium · regresiones públicas | pending-save (cuota/acceso, 1280/390), day-shifts (límites/dependencias, 1280/390), commercial-history (cinco paletas y teclado): aprobadas, sin errores JS |
| `test:remote:planner` completo | **Bloqueado antes de ejecutar pruebas**: no pudo descargarse `cloud-firestore-emulator-v1.22.0.jar` desde storage.googleapis.com. No se declara aprobado |

Chromium 156.0.8078.79. El viewport móvil es una ventana de escritorio, no un teléfono. Firefox, WebKit, Android/iPhone físicos y runtime Node 22 **no probados**. Se conserva la mitigación BUG-05 por guardas v1; no se declara recuperada la estructura histórica perdida ni completado v2.

Los primeros intentos de cuota en contextos incógnitos o con reservas previas no provocaron el rechazo esperado. Se corrigió el **ensayo**, sin debilitar la aserción: `durable-quota.cjs` utiliza un origen sin el SDK Firebase y un perfil temporal persistente, reiniciado antes de activar la cuota de 1 KiB por CDP. Exige `overrideActive`, `QuotaExceededError`, cero fotos nuevas y conservación exacta de la fila previa. No simula una falta real de espacio del disco físico.

La suite completa actualizada se ejecuta en un entorno con Java 21 y descargas Firebase disponibles:

```sh
npm ci --prefix remote
npm run test:remote:planner
npm run test:remote:planner:browser
npm run test:remote:durable:browser
```

El informe del propietario de **3B anterior** (6/6 en Cloud Shell) y **3A** (9/9) es evidencia heredada; no certifica estos cambios 3B.2. Auth real emulado + backend HTTP con datos simulados no demuestra transacciones/reglas de Firestore/Storage emulados.

### Suite 3B.2 en Cloud Shell · informe del propietario

El propietario confirmó la ejecución de las comprobaciones de integración 3B.2
en Google Cloud Shell, sobre `feat/commercial-durable-work-v1`, contra los servicios
Firebase emulados, incluidos Firestore y Storage. Proporcionó este resumen:

| Resultado informado | Valor |
| --- | --- |
| Pruebas | 7 |
| Suites | 0 |
| Aprobadas | 7 |
| Fallos | 0 |
| Canceladas | 0 |
| Omitidas | 0 |
| TODO | 0 |
| Duración de la suite | 15039.610241 ms |
| Salida del script | 0, ejecución satisfactoria |

Esta evidencia pertenece al **informe del propietario**. Codex no ejecutó estas
pruebas en Cloud Shell; su intento local bloqueado al descargar el emulador y sus
resultados anteriores se conservan arriba. El resumen no incluye el SHA probado,
el comando exacto ni las versiones de Node/Java: no se deducen de la rama o del
número de pruebas. Tampoco acredita que se ejecutaran las suites Chromium completas
contra esos emuladores. La duración es de la suite, no latencia de guardado.

Los niveles de evidencia son distintos y pueden combinarse en una misma suite:

- Las 15 pruebas Node de durabilidad utilizan **fake-indexeddb** y backend simulado.
- Las siete pruebas HTTP locales de Codex utilizan Auth emulado, pero **datos
  simulados**; no verifican Firestore/Storage emulados.
- El informe de Cloud Shell aporta **7/7 con Firestore/Storage emulados**, no servicios
  reales. La suite Node preparada en `tests/remote/planner.cjs` también usa almacenes
  locales de prueba, incluido fake-indexeddb para el caso durable; probar el backend
  emulado no equivale a probar IndexedDB real.
- Las comprobaciones anteriores de **IndexedDB real en Chromium** corresponden a
  Codex y permanecen atribuidas a su recorrido con backend de datos simulado.

### Revisión local al registrar el informe

Codex revisó `f5de616`, coincidente con la cabeza remota de esta rama. Respecto a
su base `5955fb9`, permanecen idénticos `app.tsx`, `app.js`, autenticación, historial
experimental, backend 3A, reglas, configuración de Hosting y workflow de Pages.
El backend ejecutable, sus dependencias, validador, reglas y configuraciones también
coinciden con la entrega 3A fusionada en `89540d8`. Esta actualización es documental.

Se mantienen el proyecto `demo-fullhouse-remote`, los endpoints loopback, las bases
`fullhouse-lab-*` y el aislamiento por UID/proyecto. El transporte comprueba la sesión
antes y después de las esperas; no cambia el token de A por el de B. Las pruebas
locales comprueban rechazo de claves/paquetes de otra cuenta, conservación del
candidato original y ausencia de importación de `fullhouse-v01` y su alias.
Cinco procesos independientes verificaron el rechazo del backend sin modo emulador,
con proyecto real y con endpoints externos de Firestore, Storage o Auth, antes de
inicializar sus SDK. Pages y el constructor de Staging conservan sus listas de
recursos públicos; no incluyen el laboratorio ni su almacén durable.

Volvieron a pasar `check`, `check:auth`, `check:history-contract`, `check:remote` y
`check:remote-client`, las 15 pruebas de durabilidad, las 13 del cliente, las 8 del
backend simulado y las 194 regresiones públicas. Los recorridos Chromium anteriores
no se repitieron para esta actualización documental. También se repitió `npm test`:
534 aprobadas, cero fallos/canceladas/omitidas y seis TODO previos (540 casos).
No se ejecutaron despliegues,
servicios reales ni pruebas con información personal.

Con la evidencia del propietario y las verificaciones locales, **3B.2 es apta para
fusionarse como laboratorio aislado**. No quedan bloqueos técnicos nuevos de esta
entrega para preparar 3C. Activar servicios reales requerirá una PR separada que
configure el proyecto y permisos de destino, mantenga CAS/confirmación/recuperación
y cambie explícitamente las barreras demo, además de autorización del propietario
para servicios/costes y una política de retención/privacidad antes de usar datos reales.

## Antes de servicios reales

La integración informada por el propietario ya cuenta con 7/7 frente a Firestore/Storage emulados. No se dispone de un informe de los recorridos Chromium contra esos emuladores ni de Node 22, Firefox/WebKit o dispositivos físicos; siguen siendo verificaciones pendientes para la activación, sin invalidar el resultado informado. Aprobar retención/privacidad y el tratamiento de dispositivos compartidos (las copias locales no están cifradas por usuario). Separación por UID no protege frente a XSS, acceso al perfil o código malicioso del mismo origen. Siguen pendientes IAM/antiabuso/App Check, cuotas/costes autorizados y adaptación del cliente demo a proyecto real. La beta pública aún no tiene permiso para activar guardado remoto, Blaze, migraciones ni v2. El backend, reglas, despliegues, autenticación y el Planner publicados permanecen intactos.

El público y Staging conservan sus borradores RAM y guardado local actuales. Estas protecciones no están activadas allí. No se ejecutaron despliegues ni servicios reales.
