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

Resultados finales y limitaciones de ejecución se registran al cerrar esta PR. La suite completa actualizada se ejecuta en un entorno con Java 21 y descargas Firebase disponibles:

```sh
npm ci --prefix remote
npm run test:remote:planner
npm run test:remote:planner:browser
npm run test:remote:durable:browser
```

El informe del propietario de **3B anterior** (6/6 en Cloud Shell) y **3A** (9/9) es evidencia heredada; no certifica estos cambios 3B.2. Auth real emulado + backend HTTP con datos simulados no demuestra transacciones/reglas de Firestore/Storage emulados.

## Antes de servicios reales

Reejecutar los recorridos con emuladores completos, validar Node 22 y Firefox/WebKit/dispositivos físicos, aprobar retención/privacidad y el tratamiento de dispositivos compartidos (las copias locales no están cifradas por usuario). Separación por UID no protege frente a XSS, acceso al perfil o código malicioso del mismo origen. Siguen pendientes IAM/antiabuso/App Check, cuotas/costes autorizados y adaptación del cliente demo a proyecto real. La beta pública aún no tiene permiso para activar guardado remoto, Blaze, migraciones ni v2. El backend, reglas, despliegues, autenticación y el Planner publicados permanecen intactos.
