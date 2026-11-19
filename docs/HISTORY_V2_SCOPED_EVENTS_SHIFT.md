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
