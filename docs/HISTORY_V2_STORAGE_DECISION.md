# BUG-05 · fase 4B.1: decisión experimental de almacenamiento

> Preparación 4B.3: [rendimiento, recuperación y matriz de salida](HISTORY_V2_READINESS.md).
> El acceso incremental y los artefactos nuevos siguen aislados. No cambian Data2
> público ni activan migración. Las limitaciones de fases anteriores se actualizan
> en ese informe; 4C permanece bloqueado.

> Avance 4B.2 (experimental): diario opcional, adopción explícita y sesión con
> IndexedDB aislado descritos en [compatibilidad del legado](HISTORY_V2_LEGACY_COMPAT.md).
> Las afirmaciones anteriores sobre ausencia de adopción/edición corresponden a
> fases previas. No hay activación pública; borrado físico y paridad React completa
> siguen bloqueando producción.

**Recomendación: B, IndexedDB para metadatos y fotografías. No está activado en Planner.**
Base comprobada: main `470212c`, PR #8. Esta entrega no cambia claves públicas,
Data v1, importación, exportación, pantallas ni guardado pendiente de producción.
El laboratorio solo permite bases con prefijo `fullhouse-lab-`, requiere una
factoría inyectada y se sirve en un origen loopback separado. Pages copia una
lista cerrada de recursos públicos que excluye laboratorio y módulos históricos.

## Comparación de arquitecturas

| Aspecto | A: localStorage, dos ranuras | B: IndexedDB completo | C: metadatos localStorage, fotos IndexedDB |
| --- | --- | --- | --- |
| Años de actividad | Cuota reducida, base64 y dos documentos completos | Registros indexados y blobs, capacidad mayor habitual | Alivia fotos, metadatos aún sujetos a cuota pequeña |
| Escritura/lectura | Síncrona, serialización y bloqueo de interfaz | Asíncrona; consultas por día/foto, cambios por registro | Dos APIs, serialización síncrona de metadatos |
| Consistencia | Manifiesto permite recuperar escrituras parciales, no transacción multi-clave | Transacción atómica incluye captura, progreso, referencias y blobs | No existe transacción común entre ambos sistemas |
| Concurrencia | Exclusión cooperativa más verificaciones; antiguas pestañas no cooperan | Transacción readwrite y comparación de generación/hash | Coordinación distribuida más compensación de fallos |
| Cuota/fallos | Puede fallar incluso con datos solo textuales | Abort sin reemplazar confirmado; cuota variable | Puede dejar foto huérfana o referencia sin destino |
| Respaldo | JSON completo, con coste de strings y límites de codec | Archivo binario completo y portable; JSON pequeño sigue válido | Exportación necesita coordinar ambos almacenes |
| Móvil | API disponible, límite y bloqueo sensibles | API ampliamente disponible, debe comprobarse acceso real | Mismas restricciones más complejidad cruzada |
| Migración/reversión | Doble ranura más fuente v1 pueden no caber | Fuente intacta, candidato verificable y recibo transaccional | Fuente, diario de compensación y dos destinos |
| Mantenimiento | Protocolo anterior útil, capacidad insuficiente medida | Más trabajo inicial, una autoridad transaccional | Más estados de fallo sin ventaja probada suficiente |

No se mantienen dos copias completas del documento activo: los registros anteriores
permanecen hasta completar la transacción. Se conservan fuentes originales y
candidatos necesarios para recuperación; no se borran automáticamente fotografías.

## Mediciones reproducibles

Resultados brutos: [HISTORY_V2_STORAGE_MEASUREMENTS.json](HISTORY_V2_STORAGE_MEASUREMENTS.json).
Node 24.22.1, Chromium 156.0.8078.79; dos viewports, 1280 y 390 px, misma máquina.
No equivalen a un teléfono físico ni a Safari/iOS. Comando:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-storage.cjs
```

65 casos aprobados. Por viewport: 5.000 ejecuciones, 501 revisiones, 65 imágenes
únicas, 66 referencias; 42.175.847 bytes binarios. JPEG generados de ruido real
1100×1100/calidad .66: 38.295.636 bytes; PNG de 3.880.270 bytes, además de imagen
pequeña. No se usa un JPEG diminuto como sustituto de una carga realista.
Archivo completo: 49.538.150 bytes. Preparación: 4.830–4.905 ms;
escritura y lectura verificada: 2.585–2.700 ms; exportación: 847–848 ms;
importación: 3.771–3.850 ms. Consulta indexada de día más foto: 4 ms.
Una modificación escribe una fila y ninguna foto nueva, pero verificar el documento
completo aún cuesta aproximadamente 2,4 s: **no es rendimiento listo para usuarios**.
Antes de activar: preparación incremental, Worker, consultas paginadas y verificación
por alcance con raíces consistentes; no suprimir verificaciones para ocultar el coste.

El documento inline requiere 67.227.235 caracteres, y los metadatos sin imágenes
7.172.309. A y C fallaron realmente con QuotaExceededError; sus versiones pequeñas
(3.313 y 4.376 caracteres) sí guardaron y sobrevivieron al intento fallido.
C dejó un blob huérfano cuando falló la escritura del puntero: recuperable con un
diario adicional, pero demuestra la falta de atomicidad entre APIs.

Cuota nativa: perfil/origen nuevo, CDP limita a 1 MiB **antes de abrir la base**;
el blob grande abortó con QuotaExceededError, cabeza y foto anterior intactas.
Una prueba inicial ajustando cuota después de abrir una base incógnita no impuso
el límite y se descartó como prueba de cuota. `estimate()` siguió informando ~10 GB:
es orientativo, no garantía de espacio reservable. SecurityError probado en iframe
sandbox de origen opaco. Factoría ausente también bloquea, sin fallback destructivo.

## Modelo físico y propiedad

La versión física de IndexedDB es 1, distinta de Data `version: 2` y del archivo
portable formato 1. No se modifica el contrato lógico aprobado.

| Store | Clave / función |
| --- | --- |
| control | `key`: head con formato, generación, operación y rootHash; conflicto de fuente |
| goals, routines, events, revisions, reviews | `key`: identificador original o fecha; valor y hash |
| executions | `key`: clave original del log; índices únicos executionId y seriesDay; índice day |
| evidence | `key`: par canónico propietario/id; metadatos, MIME y hash binario |
| images | `hash`: SHA-256 de bytes, Blob y longitud |
| commits | `id`: recibo durable, generación, rootHash y operationHash |
| candidates | `id`: candidato preparado, luego recibo compacto de migración |
| sources | `id`: fuente main/alias, texto exacto y huella, sin sustitución |

Propietario: `execution:<id>` o `legacy:<clave original>`. Dos evidencias pueden
referenciar los mismos bytes sin compartir su identidad, nota o MIME. Las versiones
y capturas nunca contienen copias de fotos. No hay recolección automática: borrar
referencias y evidencias necesitará política explícita y auditoría en 4B.2.
Los textos originales de migración pueden repetir base64: se preservan una vez por
intento como respaldo de fuente, no por cada ejecución.

La preparación toma una copia antes del primer await; operaciones clonan/congelan
el plan. Se validan registros, referencias, índices derivados, hashes, propietarios,
fuentes y bytes. Una proyección con imagen mínima se usa solo para validar estructura;
no es un respaldo ni se devuelve en lugar de la fotografía. La hidratación recupera
siempre bytes reales y verificados. Revisiones y capturas referenciadas no se pueden
reinterpretar, ni eliminar silenciosamente evidencia, auditoría o legado.

## Confirmación y concurrencia

1. Construir y verificar candidato fuera de la transacción; el ID del intento es estable.
2. Abrir transacción readwrite que cubra todos los stores. Dentro no hay await de crypto.
3. Comparar cabeza esperada (generación/hash); rechazar obsoletos, nunca elegir por fecha.
4. Escribir solo filas modificadas y nuevos blobs, más cabeza y recibo en la misma transacción.
5. Esperar `complete`; leer/verificar de nuevo. Antes no hay mensaje de guardado confirmado.
6. Reintentar mismo ID/huella devuelve el recibo, sin duplicar. Si otro commit ya lo
   superó, se informa `committed-but-superseded`, sin sobrescribirlo.

Dos pestañas nativas con la misma base compitieron: ganó una y la otra fue rechazada.
Abort antes/después de poner registros mantiene el estado anterior. Cerrar pestaña
con transacción pendiente dejó la generación previa completa. Se forzó además
`Browser.crash` en Chromium desechable con perfil persistente y se reabrió: se
conservó la generación 2 confirmada, su nota y fotografía, sin datos parciales.
Esto demuestra esos escenarios; no prueba supervivencia a todos los fallos de SO,
disco o energía. Se solicita durabilidad strict cuando existe, con fallback explícito.

IndexedDB serializa transacciones concurrentes sobre stores compartidos. BroadcastChannel,
Storage y Web Locks pueden ayudar a avisar, pero no prueban ausencia de pestañas v1.
Una base sin head pero con restos, formato desconocido o referencias rotas entra en
recuperación. No se autoinicializa sobre datos huérfanos ni selecciona el más reciente.

## Migración sintética y alias

El código público consulta `fullhouse-v01` y el alias histórico
`botanica-planificador-v01`; el laboratorio recibe **copias** como main/alias y jamás
los lee ni escribe. Distingue ausente, igualdad de bytes, igualdad de hechos con
serialización diferente y divergencia. Incluso una fuente única requiere elección.
Una fuente inválida no se descarta silenciosamente; preservar/exportar ambas.

1. Exportar ambas fuentes exactas y resolver pendientes/borradores del guardado v1.
2. Comparar y elegir expresamente main o alias; no mezclar ni elegir por antigüedad.
3. Validar v1 con reglas compatibles 0.1–0.9; construir v2 con logs heredados sin capturas.
4. Preparar blobs/metadatos y guardar fuentes y candidato, sin cabeza activa.
5. Reabrir, verificar bytes, hashes y equivalencia con la fuente seleccionada.
6. Solicitar confirmación explícita; releer ambas copias mediante puerto inyectado.
7. Si las huellas siguen iguales, confirmar transaccionalmente y verificar lectura.
8. Comprobar fuentes otra vez: cambio concurrente => recuperación persistente; jamás
   rollback automático ni preferencia por el documento más reciente.

No existe transacción entre localStorage antiguo e IndexedDB. Una pestaña antigua
puede escribir después de la última comprobación: es un riesgo irreducible con esas
APIs. Activación futura necesita protocolo de aislamiento, advertencia y revisión
continua de ambas fuentes; detener escrituras ante ambigüedad. No prometer exclusión
absoluta ni sincronización bidireccional. La prueba con dos páginas modifica copias
en claves exclusivamente `fullhouse-lab-*`, no las claves públicas.

Nueve exportaciones reales sintéticas 0.1–0.9 pasan comparación completa de hechos,
dataURLs y bytes; no se inventan pasos, alternativas o duración real. Otra migración
usa 7 logs, 7 fotos (7.470.296 bytes), texto de fuente 9.962.687 caracteres y conserva
ambas copias exactas con cero capturas nativas. Intentos repetidos mantienen identidad;
interrupción conserva candidato verificable. La interfaz experimental permite consultar
copias conservadas, elegir candidato sin selección automática, exportar fuentes y
reservar otro intento sin borrar los anteriores. No implementa adopción del legado.

## Respaldos y recuperación

`.fharchive` incluye metadatos, definiciones, registros, correcciones, evidencias,
blobs y textos exactos de fuentes. Magic/versiones, longitudes, hashes y límites se
validan antes de escribir; entradas truncadas/corruptas no sustituyen el confirmado.
Prueba de restauración en otro origen con archivo descargado: hechos y bytes iguales.
No depende de URLs de blobs, nombre de base o perfil original. No se ofrece JSON
recortado como respaldo completo. Codec JSON v1/v2 anterior permanece intacto para
sus tamaños admitidos; el archivo binario experimental requiere este lector nuevo.

Límites del prototipo: 8 MiB/foto, 512 MiB/archivo, 16 MiB/frame, 100.000 registros,
10.000 imágenes y 1.000 fuentes. Son presupuestos explícitos, no capacidad universal.
Fuentes demasiado grandes se rechazan sin borrar originales. Almacenamiento disponible,
memoria de hidratación/archivo y coste de backups requieren pruebas mayores en 4B.3.
No hay fallback automático a v1 si v2 existe pero no abre. Un rollback de código v1
no puede representar hechos v2: ofrecer exportación y recuperación explícita, no
borrar destino ni convertir silenciosamente. Antes de activar, probar esa UX completa.

La retención del navegador es best effort: limpieza manual, pérdida del perfil,
evicción, modo privado o fallos de hardware pueden borrar datos. Solicitar persistencia
no garantiza concesión. Ninguna base local reemplaza respaldos externos descargados;
hashes detectan corrupción, no autenticidad frente a código malicioso del mismo origen.

## Inventario funcional y bloqueos de compatibilidad

| Función actual | Preparado/probado | Adaptación/regresión pendiente 4B.2 |
| --- | --- | --- |
| Marcar/desmarcar pasos antiguos (`toggleStep`) | Conservación exacta de checkedSteps y logs | No fusionar marcas con definición nueva; adopción explícita, no resuelta |
| Completar/reabrir (`toggleEvent`) | Motor nativo, captura y progreso atómicos | Legado sin receta, reaperturas y semántica de finalización v1 |
| Notas (`saveOccurrenceNote`, NoteEditor) | Textos/propietario y respaldo íntegros | Edición de legado sin inventar contexto; borradores y conflicto de ventanas |
| Añadir fotos (`saveEvidence`) | Blob, dedup, transacción y recuperación | FileReader/canvas asíncrono, identidad durante cambio de fecha, pendiente real |
| Editar/eliminar evidencias (`deleteEvidence`) | Retención protectora impide pérdida silenciosa | Política explícita de borrado/corrección, auditoría y GC; no habilitado aún |
| Texto/caption de evidencia | Campo conservado | No asumir editor público que hoy no existe; decidir experiencia |
| Alternativas (`selectVariant`) | Motor conserva contexto/correcciones | v1 limpia marcas; v2 debe preservarlas y explicar corrección, incluido legado |
| Rutinas (`saveRoutine`), pasos y duración | Versiones inmutables y hechos persistidos | Conectar edición a versión nueva, mantener historial y acceso sin plantilla |
| Programación (`saveEvent`), mover, cancelar, eliminar | Puente 4A y pruebas horarios/dependencias existentes | Mapear excepciones/series/identidad estable y movimientos sin remap destructivo |
| Recurrencias y continuación | IDs/series y registros independientes conservados | UI de continuación y adopción incompleta; no equiparar otra fecha a nueva ejecución |
| Metas (`saveGoal`) y eventos review-* | Datos completos preservados | Referencias históricas tras editar/borrar metas o regenerar revisión |
| Revisiones (`saveProgress`, `saveDayReview`) | Numéricas, cualitativas, hitos e historial preservados | Escritores nativos/UI y métricas sobre legado sin denominador verificable |
| Progreso/consulta | Lector nativo y consulta por día/foto | Denominadores congelados vs estimaciones legadas; no reinterpretar cumplimiento |
| Async, formularios y pendientes BUG-01 | CAS/recibos y candidatos del laboratorio | Integrar todos los borradores y confirmación real sin éxito prematuro |
| Importar/exportar/recuperar/reset | Archivo completo y original intacto | UX de reemplazo explícito, fuentes divergentes, no sobrescribir por error |
| Preferencias, sueño, guía y tema | Flujo público intacto | Claves separadas no forman parte de Data v1/v2; definir alcance de respaldo futuro |

Los bloqueos protectores actuales sobre cambios de legado y borrados **impedirían
acciones hoy disponibles** si se activaran sin adaptación. No está solucionada la
compatibilidad funcional ni BUG-05 público; la reproducción original permanece fallida.
No usar retención inmutable como justificación para quitar funciones al usuario.

## Etapas siguientes y condiciones de activación

**4B.2:** diseñar adopción explícita del legado incompleto y correcciones sin inventar
hechos; aprobar semántica de edición/borrado; adaptar cada fila del inventario,
borradores/async y lector de fotos; probar las mismas rutas actuales en previsualización.
Cualquier ampliación de contrato necesita propuesta y revisión previa.

**4B.3:** optimizar procesamiento y memoria, perfilar equipos móviles reales y otros
motores; pruebas de más volumen/límites; actualizaciones de DB/versionchange;
recuperación, fuentes divergentes y rollback comprensibles; permisos/evicción y
persistencia; archivo portable mayor y respaldo verificable sin agotamiento de memoria.

Antes de producción: todas las rutas funcionales y compatibilidad 0.1–0.9 aprobadas;
BUG-05 real corregido y su reproducción pasa; presupuesto de latencia/capacidad
acordado; respaldos externos y restauración comprobados; pendientes resueltos;
concurrencia antigua/nueva con aislamiento explícito y bloqueo ante ambigüedad;
ninguna selección o limpieza automática; pruebas de fallo y reversión; laboratorio
excluido del despliegue; revisión y autorización separada del propietario.

## Verificación de esta entrega

| Comando | Resultado |
| --- | --- |
| `npm run check` | Correcto; TypeScript y app.js coinciden, sin generar archivos |
| `npm run check:history-contract` | Correcto; incluye tipos del almacenamiento aislado |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 122 aprobadas, 5 TODO, cero fallos |
| `npm test` | 286 aprobadas, 5 TODO y un fallo conocido BUG-05; salida 1 |
| Chromium `tests/browser/history-storage.cjs` | 65 casos aprobados, viewport 1280/390 |
| Chromium `tests/browser/history-integration.cjs` | 28 casos aprobados, sin Storage público ni errores JS |
| Chromium `tests/browser/history-view.cjs` | 120 combinaciones, cinco paletas y escritorio/móvil, sin errores JS |

Los cinco TODO requieren integración pública posterior; no son pruebas superadas.
Los nueve tests Node nuevos no sustituyen el motor real IndexedDB: los escenarios
transaccionales se ejecutan adicionalmente en Chromium real. No se detectaron errores
JavaScript inesperados; los abortos, cuota y acceso denegado son fallos provocados.

El `load()` público actual intenta primero `fullhouse-v01`. Si existe pero es
inválido bloquea en recuperación sin probar el alias; si falta, usa el alias y copia
su texto al principal, conservando el original. Si ambos existen, hoy no compara
sus contenidos. Esta fase no modifica ese comportamiento: la futura migración debe
inspeccionar ambas copias explícitamente, y resolver esa diferencia antes de activarse.
