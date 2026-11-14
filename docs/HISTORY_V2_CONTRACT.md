# BUG-05 · contrato histórico v2

Estado: contrato aprobado y motor aislado de fase 2; **no activado en producción**.
Base actual: `origin/main` / `5e1f683` (BUG-01 a BUG-04 conservados).
La aplicación sigue escribiendo `version: 1` en `fullhouse-v01`. BUG-05 permanece
reproducible. Hay codec y operaciones v2 aislados; no hay lector v2 público,
migrador, captura desde Planner ni nueva interfaz.

## Representación normativa

`contracts/history-v2.d.ts` define el documento completo; el validador separado
`contracts/history-v2.cjs` delega al codec de `history/codec.cjs`, que verifica
estructura, referencias, auditorías y transiciones de una ejecución.
No se importa desde la aplicación. Reutiliza mediante inyección su validador v1
para comprobar el contenido anterior. El [motor de fase 2](HISTORY_V2_ENGINE.md)
explica API, límites y validaciones; no está conectado a producción.

| Campo | Regla |
| --- | --- |
| `version` | 2; lectores antiguos deben rechazarlo sin sustituir datos |
| `recipeRevisions` | Diccionario de definiciones completas, inmutables, compartidas por ejecuciones |
| `routines` | Plantillas editables actuales; no son fuente de verdad de una captura |
| `events` | Programación editable; `seriesId` estable y referencia opcional a revisión |
| `logs` sin `history` | Hechos heredados originales, sin inventar una captura |
| `logs.*.history.capture` | Identidad y contexto inmutables de una ejecución |
| `history.resolution` | Árbol efectivo, alternativas, asignación prevista y unidades del denominador |
| `history.state` | Activa, completa o cerrada parcialmente; origen del completado |
| `history.actualTiming` | Desconocida (`null`) o duración medida/declarada con procedencia |
| `history.corrections` | Auditoría acumulativa de elecciones corregidas o reaperturas |
| `history.continuations` | Fechas locales y desfase horario de continuaciones explícitas |

### H1 · Identidad y definiciones

Cada definición recibe un ID opaco nuevo al cambiar su contenido relevante.
No se reutiliza una revisión para contenido distinto; se permite compartir una
revisión entre muchas ejecuciones. `sourceRoutineId` conserva la procedencia,
no exige que la plantilla siga existiendo. Los IDs de pasos incluyen todo el
árbol de alternativas de esa revisión; los IDs de variantes son locales al paso.
La revisión incluye textos, reglas por día, evidencias requeridas, duraciones,
flexibilidad y enlaces originales a metas, nunca fotografías.

`executionId` identifica una realización, no su clave textual actual en `logs`.
`seriesId` persiste al dividir una programación recurrente en segmentos futuros;
una copia independiente obtiene otro ID. Una ocurrencia tiene un solo par
`seriesId/scheduledDate`; continuarla mañana no crea otra ocurrencia. El evento
recibe identidad estable antes de crear su primera captura. La clave heredada
`eventId@fecha` sigue sirviendo como índice de compatibilidad, no como identidad.
Los índices inversos se derivan, no se mantienen como otra fuente de verdad.

### H2 · Primer registro significativo y atomicidad

Capturar al guardar por primera vez: completado explícito, primer paso marcado,
selección manual de alternativa, nota no vacía o fotografía añadida. Abrir una
vista, dejar un formulario sin guardar o resolver una alternativa por día para
previsualizar no captura. `capturedAt` registra la captura, **no el inicio físico**.
Definición, captura, resolución y acción se confirman en una sola escritura válida.
Un fallo conserva el último documento confirmado y el candidato pendiente de BUG-01;
no crea una captura parcialmente persistida ni un mensaje de éxito.

La captura congela título, descripción, tipo, día original, ventana prevista y
etiquetas de metas disponibles. Una referencia a una meta desaparecida conserva
su ID y título `null`; no se inventa una etiqueta. Las revisiones diarias y la
historia numérica propia de metas permanecen independientes. Cambiar una meta
no debe renombrar retrospectivamente el contexto capturado.

### H3 · Resolución y duración

Se guarda la revisión original y el árbol resuelto con IDs de alternativas,
asignaciones previstas por nodo y unidades hoja que cuentan para cumplimiento.
Las alternativas por día se resuelven según el día original y se congelan. Una
alternativa manual no elegida se representa `decisionPending: true`, sin hijos ni
minutos inventados; el total es `null` y `unitsKnown` falso. Elegirla después
resuelve el árbol desde la misma revisión, nunca desde la plantilla actual.

La asignación fija/flexible se calcula una vez por contexto: registrar el presupuesto,
la ventana y los minutos asignados conserva el resultado aunque cambie el algoritmo.
En modo fijo/entre bloques la suma debe coincidir con el presupuesto. En modo por
pasos el presupuesto disponible puede diferir de la suma. Ventanas intradía:
`0 <= startMin < endMin <= 1440`; no se introduce cruce de medianoche.
No inferir tiempo real a partir de minutos previstos, horas de marcas o captura.
`actualTiming` solo admite una medición o declaración explícita; la interfaz para
recogerla no forma parte de esta fase.

### H4 · Parciales, completas, continuadas y corregidas

- **Activa:** admite progreso incremental; conserva los hechos ya registrados.
- **Completa manualmente:** no exige inventar marcas de pasos no realizados.
- **Completa por pasos:** requiere todas las unidades activas y ninguna decisión pendiente.
- **Cerrada parcialmente:** conserva marcas y notas; no se convierte en completa.
- **Continuada:** agrega fecha local, instante y desfase; mantiene identidad, fecha,
  captura y definición originales. No mueve el crédito al día de continuación.
- **Reabierta:** corrección explícita con motivo y checkpoint anterior; no borra
  evidencia del completado previo. El estado corriente puede volver a activo.
- **Alternativa corregida:** agrega checkpoint anterior antes de cambiar resolución.
  Marcas de ramas ahora inactivas, notas y fotos se conservan, pero esas marcas no
  satisfacen unidades de la nueva rama. La interfaz futura debe distinguirlas.

El checkpoint conserva progreso, resolución y referencias de evidencias previas;
no duplica bytes de imagen. El evento de corrección tiene ID, instante y motivo.
El motor aislado implementa estas transiciones; las pruebas del motor no sustituyen
las futuras pruebas de acciones reales de la aplicación.
Las notas pueden editarse mediante acción explícita; no se pretende registrar cada
pulsación como auditoría. Borrar una marca deberá ser una acción explícita, nunca
un efecto lateral de cambiar alternativa. El detalle de esa UX queda para fase 2.

Reprogramar, cancelar o eliminar una plantilla no modifica capturas existentes.
La cancelación futura se modela en la programación, no destruyendo un log pasado.
Los segmentos recurrentes y las excepciones heredan serie; solo afectan ocurrencias
sin captura. Una modificación de una ejecución capturada debe ser explícita y
conservar la auditoría; no se aplica mediante un editor de programación genérico.

### H5 · Lectura histórica y progreso

La vista de ejecuciones capturadas usa exclusivamente captura + revisión + resolución
+ progreso registrado. Nunca cae silenciosamente a la plantilla actual si falta
una referencia: mostrar recuperación/registro incompleto conservando los bytes.
El progreso por pasos usa `unitStepIds`, no el número de pasos actual; las marcas
de ramas inactivas no cuentan. El cumplimiento de bloques semanales mantiene su
métrica separada: no sumar unidades de pasos con bloques como si fueran equivalentes.

Los logs anteriores guardan completado, IDs marcados, elecciones manuales, notas,
fotos y sus fechas cuando existen. No guardan necesariamente textos, reparto,
alternativas por día ni estructura histórica. Permanecen **legado: contexto desconocido**.
No convertir una plantilla actual en una supuesta verdad pasada. Una reconstrucción
opcional se devuelve como `LegacyView` estimada, con etiqueta, fuente y fecha; no
se persiste como captura verificable ni entra indistintamente en estadísticas.
Si se retoma un registro legado, conservar sus hechos y usar `adopted-current`
para la captura desde ese momento, nunca `recorded` para el pasado perdido.
La confirmación de esa adopción y la presentación de agregados mixtos requieren UX.

### H6 · Evidencias y retención

`RecordLog.evidences` conserva la única copia de cada imagen para esa ejecución.
Capturas y auditorías solo referencian IDs; no mover ni copiar base64 al definir
revisiones. No borrar automáticamente revisiones ni imágenes referenciadas.
La deduplicación de fotos entre ejecuciones, compresión, limpieza o IndexedDB
requieren otra tarea y autorización; esta fase no altera archivos personales.

## Etapas de implementación y límites de las pruebas

1. **Fase 1 completada (PR #5):** tipos, contrato y ejemplos sintéticos.
   La reproducción real de BUG-05 sigue fallando.
2. **Motor aislado implementado:** codec v2 endurecido, resolución e identidad,
   candidatos atómicos en memoria, correcciones y continuidad. Reintento simulado;
   sin escritor público ni garantía de atomicidad del almacenamiento.
3. **Lectura:** historial y progreso por captura; legado desconocido/estimado,
   eliminación, recurrencias y excepciones; pruebas visuales y móviles.
4. **Activación separada:** migración, exportación/importación, conflictos entre
   pestañas, reversión y pruebas Chromium; autorización antes de tocar datos reales.

Las pruebas comprueban documentos y operaciones reales del motor con datos sintéticos,
no su integración en la aplicación. Las transiciones multiejecución no se admiten:
componer acciones requiere una futura transacción explícita. No conectar el codec
a respaldos de usuarios sin las barreras de importación/recuperación de fase 4.
