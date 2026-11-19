# BUG-05 · B.3b.2: edición experimental por alcance

Base c61e6acebb6326faf050502b4533e1e589d0ab3e (PR #17).
Rama feature/history-scoped-events-edit-v2. Contrato previo a implementación.
No cambia producción, versiones físicas/lógicas ni formatos de captura/archivo.

## 1. Auditoría exacta de Planner

`saveEvent` normaliza título/minutos/fechas específicas y valida el formulario.
Compara scheduleChanged: time, endTime, anchor, afterRoutineId, beforeRoutineId,
date, endDate, repeat, repeatDays, everyDays y specificDates. Omite minutes,
routineId, goalId, kind, allDay, overrides, overlapMode y requestEvidence.
Una duración u override puede cambiar el calendario sin la confirmación de ese flag.

Con original, startChange = applyFrom || today. Rechaza startChange < today.
Corta si original.date < startChange, original.date < today y
(original.repeat != none || original.endDate >= today). finalStart es el mayor
entre x.date/startChange. El tramo viejo conserva el ID, cierra con addDays(-1) y
conserva overrides anteriores; el nuevo se anexa con uid, specificDates/overrides
futuros. **Traslada automáticamente todas las claves originalId@fecha >= finalStart
al ID futuro**, incluso si contienen capturas, y puede pisar una clave destino.
Sin corte reemplaza la fila por ID. withOverlap puede mover varias filas/overrides.
No se utilizarán esos efectos para editar v2. App y extractor por defecto intactos.

## 2. Categorías y alcance aprobado experimental

Metadatos: title y note (descripción real del evento). Los eventos no tienen color
propio ni desc en el codec cerrado v2: se hereda color de meta/rutina; ambos campos
añadidos se bloquean sin ampliar el esquema. Una captura verificada tiene su
contexto congelado; actualizar la fila no modifica ese contexto. Los registros
heredados no tienen ese respaldo: una edición sobre una fuente con legado se bloquea,
sin inventar ni cristalizar etiquetas actuales como pasado. La estimación seguirá
siendo explícita; su adopción/edición no se resuelve aquí.

Todo otro campo funcional modificado se compara, incluidos los omitidos por Planner.
Defaults vacíos equivalentes se normalizan; campos desconocidos modificados se bloquean.
Identidad y referencias históricas no son campos editables del formulario.
La planificación requiere confirmación explícita y fecha civil applyFrom >= today.
Un cambio solo de metadatos con efecto futuro explícito se trata como cambio temporal.

## 3. Identidades y segmentos

Capacidad específica de edición vinculada a base, operación y sourceEventId; no se
aceptan reservas de creación. ID futuro derivado de recibo padre/operationId con
namespace segment-v2. seriesId se conserva, no se reasigna una ejecución.
Si falta seriesId se admite solo una identidad verificable inequívoca o, sin registros,
una serie nueva reservada. No se asocian registros por nombres. Series ambiguas bloquean.

Relación entre segmentos derivada de seriesId y rangos disjuntos ordenados; sin campo
nuevo de procedencia. El prefijo conserva su ID y lugar; el futuro se anexa siguiendo
el orden real de Planner. Las capturas conservan sourceEventId, executionId, clave,
recipeRevisionId, scheduledDate, notas, marcas, decisiones y propietario de fotos.

## 4. Cortes y representabilidad

Etiquetas civiles 0100–9999, ordinal/date de calendar-math para el día anterior;
no addDays local. Corte/fechas explícitas normalizadas se rechazan.
Sin ocurrencias anteriores al corte se permite reemplazar en lugar de crear un tramo
innecesario. Después del último efecto no se resucita una actividad mediante edición.
La ocasión multiday puede tener prefijo/futuro; puntual pasado bloqueado para planificación.

No se cambia ciegamente el origen de weekly/monthly/yearly/every al día del corte:
se encuentra la primera ocurrencia con las reglas reales, con presupuesto explícito.
La fase semanal/mensual/anual se conserva si el origen es canónico. every entero UTC
puede rebasarse a una ocurrencia del mismo módulo; en un rango local/irregular finito
se exige comparación exhaustiva de equivalencia. Si no cabe, indeterminate.
Ningún rango finito autoriza una recurrencia indefinida local no demostrada.

## 5. Capturas del corte y futuras: criterio pendiente de pruebas

El lector real timeline ya deduplica por seriesId/fecha y el motor rechaza un segundo
par capturado. Se probará coexistencia de captura original y programación nueva con
la misma serie. Exigirá elección explícita `capturedFuture: retain-frozen`, además de
confirmación, y referencias inequívocas. La captura permanece consultable aunque
su fecha deje de aparecer en la nueva regla; no se traslada a otra fecha ni plantilla.
Si esos invariantes no se pueden probar para un caso, se bloquea antes de escribir.
El puerto no declara paridad de todos los controles React: su conexión sigue pendiente.

## 6. Excepciones, calendario y persistencia (plan de B/C)

Prefijo: overrides/specificDates anteriores al corte y cierre civil, sin modificar
registros. Futuro: propiedades posteriores o del corte; nunca copiar evidencias.
Se compara el efecto completo de retirar el tramo original y añadir el nuevo:
unión de componentes antes/después, con el orden original de límites, y rango hasta
el máximo efecto viejo/nuevo o prueba indefinida. No solo se valida la fila nueva.

La raíz recorre descriptores; deltas de eventos, header, head, authority y receipt
se confirman en la misma TX. CAS, fuentes v1, zona fija, lectura posterior y replay
se conservan. Ni reservar ni preparar equivale a guardar. Borradores separados.
No se permite mover eventos, borrar fotos, reasignar logs o activar almacenamiento.

## Checkpoints

A: contrato, comparación completa, identidad y metadatos con pruebas.
B: cortes/fases, capturas futuras y calendario completo con pruebas.
C: fallos, concurrencia, recuperación, corpus, verificaciones y resultados finales.
Lo no probado no se declara implementado. BUG-05 público y seis TODO permanecen.
