# BUG-05 · B.3c.1: desplazamiento individual experimental

Base 721ce2dc9597a25b20dff45327f32fbde174061b (PR #18).
Rama feature/history-scoped-events-shift-v2. Contrato previo a implementación.
Solo bases fullhouse-lab-*; producción v1 intacta. Sin eliminación ni 4C.

## Semántica pública comprobada antes de implementar

shiftEvent rechaza between y allDay, calcula minutes(eventTime(e,date,data))+delta,
clampa solo el inicio inferior a cero y rechaza valores no finitos/inicio >=1440.
Construye overrides[date] conservando sus otros campos y modifica exclusivamente time.
Verifica eventFrame y dependentMovementIssue. Guarda una fila de evento; no cambia
recurrencia, IDs, logs, metas ni rutinas. Los between relacionados se reajustan por
cálculo, no por escrituras. No invoca withOverlap ni mueve terceros, incluso con
la bandera overlapMode=move. Esa lógica pertenece a saveEvent, no a shiftEvent.

El override de inicio tiene prioridad sobre endTime. timeString hace módulo 1440,
no una validación ni un redondeo: el nuevo puerto validará antes de convertir.
Un inicio fraccionario efectivo no puede convertirse a una hora válida HH:mm sin
cambiar semántica; se bloqueará. No se modifica la función pública.

## Contrato experimental y diferencias deliberadas

Request cerrado: eventId, seriesId, date, deltaMinutes. Contexto: operationId, today,
at, confirm y presupuestos opcionales. Base confirmada por capacidad, no por argumento
JSON arbitrario. Delta entero seguro [-1440,1440]; cero no prepara una escritura.
Fecha canónica/local existente >= today; occurs real debe ser verdadero y no skip.
Se requiere serie conocida consistente (explícita o captura inequívoca), sin asignar
otra al desplazar. Serie desconocida, review-* e identidades ambiguas se bloquean.

No se permite desplazar una aparición registrada: captura actual/futura, legado o
captura conservada desde un segmento previo. También se bloquearán registros activos
del componente afectado en esa fecha para evitar reajustar implícitamente una actividad
congelada. Registros de otras fechas no se reconstruyen ni se modifican. No se usa
retain-frozen para sobreescribir una fecha registrada. Sin vínculo verificable no se
asocian registros por nombres. Datos ambiguos requieren recuperación separada.

Reserva específica, ligada a base/evento/serie/fecha/delta/contexto. Sin IDs nuevos de
evento o serie. Confirmación explícita autoriza el comando; no se añade una interfaz
pública. Receipt y hash del nuevo tipo vinculan el comando, además del delta: dos deltas
diferentes que clampan a la misma hora no pueden reutilizar un recibo como equivalentes.
El formato físico/lógico y los algoritmos de hash de las clases anteriores no cambian.

## Verificación y garantías reutilizadas de B.3b.2

Catálogo verificado e índices inversos, filas por alcance, root por descriptores,
CAS de cabeza/generación/autoridad, linaje, vigilancia v1, confirmación posterior,
pendiente/borrador separados y recuperación binaria por replay. No reasignar logs.
Una base obsoleta o fuente divergente bloquea. Pérdida de acuse exige inspección;
no equivale a rollback. LocalStorage/IndexedDB no comparten transacción.

La prueba temporal solo necesita el día exacto: componente conectado antes/después,
orden real del primer límite, ciclos y todas las alternativas mediante las funciones
reales. Antes inválido/indeterminado también bloquea. Otras fechas son invariantes
porque únicamente cambia overrides[date].time: occurs y eventFrame consultan la clave
de su propia fecha; recurrencia, orden, rutinas y demás overrides/logs no cambian.
Esto permitirá verificar una fecha local de una serie indefinida sin afirmar que se
ha demostrado toda la serie. No se usa UTC como certificado local.

## Checkpoints

A: entrada, identidad, cálculo, delta individual y pruebas básicas.
B: componentes, reajuste dinámico y protección histórica; prueba completa de la fecha.
C: persistencia, fallos, concurrencia, corpus y mediciones, documentación y cierre.
Lo no probado no se declara completo. Los seis TODO y BUG-05 público permanecen.

### Checkpoint A verificado

Diez pruebas Node del puerto puro y check:history-contract aprobados. Chromium
156.0.8078.79, viewports 1280/390: reserva específica, aborto after-records sin
escrituras parciales, exportación/replay, acuse perdido/reintento idempotente,
hashes históricos conservados y cero errores JS. No son teléfonos físicos.
El driver inicial tenía una expectativa 08:15 incorrecta para un fixture 09:00;
se corrigió para usar su horario efectivo, y se repitió con éxito.
Este checkpoint rechaza todavía componentes de más de un evento. La ampliación
de dependencias y los escenarios de capacidad no se presentan como terminados.

### Checkpoint B verificado

27 pruebas nuevas de desplazamiento (22 funcionales + 5 zonas) y 39 de edición
B.3b.2: 66 aprobadas. Chromium: UTC, México, Nueva York, Madrid y Apia verifican
transacción de una fila, componente de cinco eventos, reajuste de between, bloqueo
de capturas y calendario inválido, y otras fechas sin cambios. Casos mensuales,
anuales y every indefinidos se prueban solo para el día exacto del desplazamiento;
no se amplía el dominio de prueba de toda la recurrencia. Apia 2011-12-30 bloqueado.
La rutina principal con variante real __base permanece bloqueada por compatibilidad
de futuras capturas. En límites relacionados se evalúan base y variante real sin
confundir sus IDs, conservando la reparación B.3a.1. Las primeras expectativas de
fixtures B se corrigieron al aplicar routineBalance real: un bloque fijo con tiempo
sobrante es inválido, y el min flexible no es un mínimo duro de asignación.

### Checkpoint C: persistencia y capacidad verificadas

Driver faults aprobado: validación previa conserva borrador, cuota Chromium real
con asignación binaria inyectada en la TX (no una cuota estimada), reintento estable,
lectura posterior fallida, dos páginas, aborto, recibo perdido, replay y reconocimiento
de confirmado. Dos comandos distintos que clampan a la misma raíz se rechazan;
también un paquete alterado que intenta reutilizar el recibo. Cierre de página dentro
de TX conserva estado anterior completo. Fuentes cambiadas antes/durante bloquean;
durante puede existir commit seguido de cuarentena, no rollback. Cambio de rutina
concurrente y corrupción fuera de protocolo se rechazan. Zona antes/después por CDP;
recovery en otra zona bloqueada hasta inspección. Sin errores JavaScript.

Corpus completo: 5000/501/65/42175847 bytes. Tres operaciones, mismo Chromium y datos,
raíces completas/incrementales iguales; todos los hashes históricos por clave y los
blobs del archivo restaurado verificados. Preparación incremental 19,9–23,8 ms,
reconstrucción física 6,83–7,12 s + commit completo 2,59–2,68 s. La sesión anterior
rechaza por complejidad; no se cuenta como una escritura lenta. Apertura 1,27 s;
paquetes/archivos siguen necesitando validación global. Heap retenido adicional
43.230.252 bytes en ventana separada tras solicitar GC: no RSS, pico, reducción
comparada ni evidencia de viabilidad móvil. Datos crudos en measurements/*shift*.
Pendiente el cierre de suites generales y regresiones Chromium anteriores.
