# BUG-05 · B.3c.1: desplazamiento puntual por alcance

Base: `721ce2dc9597a25b20dff45327f32fbde174061b` (PR #18).
Rama: `feature/history-scoped-events-shift-v2`. Exclusivamente experimental,
datos sintéticos, orígenes descartables y bases `fullhouse-lab-*`.
Producción conserva v1; no hay activación, migración ni conexión React pública.

**Estado: PAUSADO por solicitud del propietario.** No se continúa B.3c.1 ni se
inicia otra fase. [Punto exacto para retomar](HISTORY_V2_SCOPED_EVENTS_SHIFT_RESUME.md).

## 1. Contrato implementado

`reserveEventShift(token, request, context)` → `prepareEventShift(token, reservation)`
→ `commitEventShift(operation)` → lectura de confirmación. `createEventsSession`
expone `save('shiftEventOccurrence', request, context)` y conserva confirmado,
pendiente y borradores separados. `readEventShift` verifica el alcance sin fotos;
si ya existe registro en la aparición devuelve bloqueo, no una capacidad de edición.
Para inspección histórica general se conserva `readEventEdit`/lector previo.

Request cerrado: `{eventId, seriesId, date, deltaMinutes}`. Contexto cerrado:
`{operationId, today, at, confirm:true, budgets?}`. Base confirmada mediante token
privado; no se acepta un documento JSON arbitrario como capacidad. Delta entero
seguro [-1440,1440], distinto de cero. Fecha civil canónica 0100–9999 y local
existente, `date >= today`. `today` es explícito del adaptador, no una autenticación
ni protección frente a código malicioso del mismo origen. No se autoriza una
corrección retroactiva mediante este puerto. Instante ISO parseable/fecha válida.
`occurs` debe confirmar la aparición; skip no puede levantarse para moverla.

## 2. Semántica real de Planner inspeccionada antes de implementar

`shiftEvent` rechaza between/allDay, obtiene `minutes(eventTime(e,date,data))+delta`,
clampa solo el inicio inferior a cero y rechaza inicio >=1440/no finito. Conserva
los otros campos de `overrides[date]` y cambia únicamente `time`. Comprueba
`eventFrame`, luego `dependentMovementIssue`, y llama al guardado v1.
No reasigna claves `key(event,date) = eventId@date`. No toca recurrencia ni IDs.

`eventTime` toma el inicio del frame efectivo; su fallback no se usa aquí para
reparar intervalos inválidos. `timeString` aplica módulo 1440: no valida ni redondea.
Se comprueban enteros/límites antes de convertir. Las funciones extraídas reales
quedan fijadas por huellas de semántica, incluida una huella adicional eventTime/
timeString. `app.tsx`, `app.js` y workflow permanecen intactos.

## 3. Diferencias deliberadas de v2

Confirmación explícita; sin delta decimal, cero, fecha pasada/normalizada, serie
ambigua o registro ya existente. Antes y después deben tener una prueba completa
del día, incluso si v1 habría ignorado una dependencia inválida sin cambio visible.
Todos los perfiles pertinentes pasan routineBalance; un intervalo positivo no basta.
Errores no reparan calendario ni reasignan históricos. Un borrador establecido en la
sesión se conserva si falla la preparación; el candidato solo existe tras sellarlo.

Rutina principal con variante real `__base` bloqueada por representación ambigua de
futuras capturas, igual que creación/edición. En rutinas límite se prueban ausencia
de elección y variante real separadamente, sin reinterpretar decisiones históricas.
No se presenta una programación ambigua como completamente ejecutable.

## 4. Identidad de aparición y segmentos

Se exige una serie conocida: explícita o inferida de capturas verificadas con un
único seriesId. Las contradicciones bloquean; no se asocia nada por nombre. Familia
incluye segmentos con serie explícita y fuentes históricas enlazadas. Se consulta
`occurs` de todos ellos: exactamente uno debe reclamar esa fecha, y ser el evento
solicitado. No se crean eventos, segmentos, series ni capturas. `header.eventIds`
conserva su orden exacto. review-* se modifica desde metas, no desde este puerto.
Un ID real `__fh_preview__` es válido y no se usa ningún ID ficticio de preview.

La reserva privada y congelada liga base, evento, serie, fecha, delta, contexto y
zona. No admite capacidades de creación/edición ni de otra conexión o base.
Hasta 4096 comandos reservados por conexión; agotar ese presupuesto exige conservar
pendientes y reabrir. Reservar en memoria no implica persistencia tras un cierre.

## 5. Protección histórica

Se usa el índice verificado de descriptores (key, sourceEventId, executionId,
seriesId, day, legacy, hash). sourceEventId añadido solo al índice en memoria,
sin extensión del esquema persistido. Captura actual/futura, legado o captura de
un segmento anterior en la misma fecha/serie bloquean. Legado de origen conectado
sin fecha identificable también bloquea. Una dependencia activa ya registrada en
esa fecha bloquea todo el reajuste, aunque el bloqueo pueda ser más conservador
que el conjunto mínimo de filas con cambio visible. No se usa `retain-frozen`.

Registros de otras fechas y adopciones permanecen consultables sin cambios.
No se reescribe ningún log, continuación, revisión, nota, marca, selección o foto.
Un legado huérfano sin enlace verificable no se vincula por similitud: su conciliación
sigue requiriendo otro contrato. No se introduce coexistencia de un override nuevo
y una captura congelada en la misma aparición; propuesta futura independiente.

## 6. Cálculo horario

Se obtiene el frame efectivo con las funciones reales y elecciones base (no hay
registro/elección almacenada ese día, por la guarda histórica). Nuevo inicio =
`max(0, inicioEfectivo + delta)`, entero <1440. Se ejecuta shiftEvent extraído y se
comprueba que produzca exactamente ese time y ningún otro cambio. La demostración
del calendario verifica la duración efectiva, todas las elecciones y el final.
24:00 exacto permitido, posterior rechazado. Un inicio efectivo fraccionario se
bloquea; no se redondea para producir un horario aparentemente válido.

`anchor='end'`: el override.time tiene prioridad real sobre endTime y esa prioridad
se conserva. No se recalcula ni elimina endTime. Los otros overrides y todos los
campos del override actual se conservan (skip:false y time compatibles). El codec v2 admite time/skip en un override;
campos desconocidos se bloquean al validar la base, no se eliminan al desplazar.
Si la fila resultante ya es idéntica, no se escribe otro recibo.

## 7. Dependencias encadenadas

Componente no dirigido cerrado por rutina compartida y referencias after/before,
con orden físico de `header.eventIds`. Se leen filas del componente, familia de
serie y rutinas/límites, metas existentes y revisiones referenciadas. Verificación
de filas antes de preparar y nuevamente en TX; CAS detecta otras ediciones.
El motor B.3a usa las primeras rutinas límite aplicables reales, detecta ciclos,
verifica presencia, longitud y balance de pasos fijos/flexibles en todos los perfiles.
No elige un segundo límite favorable cuando el primero es inválido. Presupuestos
B.3a intactos: agotamiento devuelve indeterminate y no sella nada.

## 8. Reajuste dinámico

Solo se escribe el evento solicitado. Un between dependiente cambia su frame al
consultarlo con el límite nuevo. Sus filas permanecen idénticas; se comprueban
niveles indirectos como A → B → D. Una cadena imposible rechaza todo el movimiento,
no se confirma una parte ni se corrige automáticamente el resto.

## 9. Movimiento físico de terceros

La función pública shiftEvent **no llama withOverlap**, incluso con overlapMode=move.
Ese código se utiliza en saveEvent. La bandera existente queda intacta: desplazar
una aparición permite solapamientos ordinarios y no mueve terceros. El request
cerrado rechaza opciones nuevas como moveOthers. No se simula un desplazamiento
multi-entidad. Cualquier versión futura requiere alcance, identidades, consentimiento,
prueba de todas las fechas y atomicidad propios; no está implementada en B.3c.1.

## 10. Prueba temporal y no alteración de otras fechas

Se demuestra el componente completo antes y después con `from=through=date`, en
la zona real del entorno. Resultados: valid autoriza; invalid incluye contraejemplo;
indeterminate/budget/semántica desconocida bloquea. Certificado determinista
`fullhouse-occurrence-shift-proof`, v1: baseRoot, fecha/zona, huellas de semántica,
orden de eventos, hashes de la fila anterior/nueva, hashes de ambos certificados
B.3a y regla `single-time-override-pointwise-v1`. No contiene tiempos de medición.
El replay reconstruye el comando y la raíz; el certificado no sustituye integridad/CAS.

Demostración por estructura, no por muestreo: el delta deja iguales recurrencia,
fechas, orden, rutinas, logs y todas las claves de overrides salvo D.time. Para d≠D,
occurs consulta su propia clave d y los mismos campos. eventFrame de límites toma
los mismos primeros candidatos; por inducción en la cadena acíclica mantiene frames
y balances. Los ciclos no se autorizan en el día cambiado. Otros días, incluso si
contienen un problema anterior, conservan exactamente los mismos datos y significado;
esta operación no certifica ni repara todo el calendario preexistente.

UTC, México, Nueva York, Madrid y Apia: prueba finita del día exacto. Esto permite
mover una aparición existente de monthly/yearly/every local indefinida sin afirmar
una demostración indefinida. No se inventa fecha final. Apia 2011-12-30 se rechaza
por normalización. Cambio de zona durante preparación/confirmación bloquea; tras
escribir puede existir commit y hay que inspeccionar el recibo. Replay en otra zona
se bloquea conservadoramente; no se reutiliza un certificado UTC como prueba local.

## 11. Persistencia transaccional e identidad del comando

Una fila events + cabeza/cabecera + autoridad + recibo en la misma TX IndexedDB.
Sin modificación de versión física 2, lógica v2 o formato de decisiones históricas.
Raíz por hashes de filas verificadas/catálogo existente, sin reconstrucción Data2
completa ni conversión de blobs a base64. No es complejidad constante: raíz y
catálogos crecen con registros; el alcance también puede alcanzar su presupuesto.

Solo para el nuevo tipo event-shift el operationHash incluye commandHash SHA-256
canónico de request/context/zone. Algoritmos de clases anteriores intactos. Evita
reutilizar un ID para deltas distintos que clampan a la misma raíz. Reintento del
mismo candidato inspecciona recibo sin duplicar escrituras. El camino de recuperación
ya confirmado también compara operación ligada al comando, no solo id/root.
No es autenticidad frente a código malicioso del mismo origen.

Linaje, CAS de cabeza/generación, vigilancia de ambas fuentes y barreras previas
se reutilizan. LocalStorage e IDB no comparten transacción: cambio v1 durante escritura
puede dejar commit verificable y cuarentena persistente; jamás se elige una rama por
fecha ni se promete rollback automático. Escritores experimentales antiguos con la
misma versión física siguen requiriendo una barrera de capacidades antes de activación.

## 12. Recuperación y limitaciones

Aborto anterior/dentro de TX conserva la base; error de lectura posterior/acuse
perdido conserva candidato y confirmado anterior en sesión, aunque haya commit.
`inspectOperation`/retry consultan recibo. `exportPending` conserva comando/borradores
y candidato completo en paquete binario pending-not-confirmed, no respaldo confirmado.
Replay valida íntegramente paquete, vuelve a preparar sobre la misma base y compara
raíz/operationHash/fuentes. Base obsoleta o zona diferente requieren conciliación.

La reserva en RAM, por sí sola, no es recuperable tras cierre forzado. Borradores
no confirmados tampoco se prometen persistentes sin exportación explícita. Reutilizamos
la experiencia aislada de recuperación previa; no se añade un aviso/flujo React público
para esta operación. BUG-01 público permanece sin cambios, con su aviso probado.
Archivos/pendientes grandes todavía validan todo y pueden usar memoria/segundos;
no se han convertido en una exportación incremental ni introducido un Worker nuevo.

## 13. Pruebas y mediciones

30 pruebas Node nuevas: 25 grupos funcionales y cinco zonas en procesos separados.
Incluyen exploración diferencial exhaustiva de 25 pares inicio/delta, base/alternativa,
nidificación, inactividad, balance, ownership, segmentos, capturas/legado/adopción,
IDs reales, fechas inválidas, presupuestos y ausencia de lectura de imágenes/cuerpos
históricos durante preparación por alcance. La igualdad de otras fechas se fundamenta
además en la prueba estructural del apartado 10; las muestras son regresiones.

Drivers Chromium: shift 1280/390; shift-calendar cinco zonas y cinco eventos conectados;
shift-faults con cuota/aborto/cierre/tabs/recibos/corrupción/zonas/fuentes; shift-performance
con corpus de referencia, tres deltas y reconstrucción física independiente.
La cuota es real (3 MiB por CDP) y se fuerza mediante 4 MiB aleatorios dentro de la TX:
prueba atomicidad de QuotaExceededError, no afirma que una fila pequeña agote 3 MiB.
Cierre de página no equivale a cortar alimentación ni prueba fsync del navegador.

Medición Chromium 156.0.8078.79 de escritorio, mismo corpus y funciones:

| Fase, ms | +15 | −30 | +120 otro día |
| --- | ---: | ---: | ---: |
| Lectura verificada alcance | 8,3 | 8,4 | 6,2 |
| Reserva/identidad/cabeza | 17,2 | 5,7 | 8,3 |
| Preparación total | 23,8 | 19,9 | 21,6 |
| Prueba calendario (dentro de preparación) | 5,9 | 4,8 | 3,6 |
| Raíz (dentro de preparación) | 7,5 | 7,6 | 9,1 |
| Vigilancia/linaje previo | 6,2 | 4,4 | 3,7 |
| Transacción | 9,6 | 9,2 | 9,6 |
| Confirmación posterior, incluye linaje posterior | 3,8 | 3,7 | 4,6 |
| Lectura posterior | 8,6 | 7,9 | 6,7 |
| Suma fases secuenciales anteriores, sin sumar subfases | 77,5 | 59,2 | 60,7 |
| Reconstrucción física completa | 7116,1 | 6827,7 | 6901,0 |
| Commit completo | 2621,2 | 2585,7 | 2681,7 |

No es un SLO ni p95: una muestra, sin comparación de teléfonos. El paso de recovery
se mide separado y no está incluido en las latencias normales. La sesión completa
anterior rechaza `Documento demasiado complejo`; no se cuenta como operación lenta.

Apertura verificada 1273,5 ms. Pendiente 49.742.515 bytes: exportar 1300,4 ms,
inspeccionar 7255,7 ms, reconstruir 1644,4 ms. Archivo completo 49.659.018 bytes:
exportar 1314,1 ms, importar 6822,6 ms, restaurar 3228,2 ms. Nueva base y todos los
blobs por tamaño/hash verificados. Los 5000 logs, 501 revisiones, 65 imágenes únicas
y 42.175.847 bytes mantienen identidad/hashes históricos por clave.

Heap adicional de ventana independiente tras solicitar GC: 43.230.252 bytes;
no RSS, pico, memoria nativa de blobs ni reducción demostrada. La muestra del proceso
que construyó ambos comparadores retuvo 382.156.433 bytes JS; no se confunde con la
ventana aislada. Sin Firefox/WebKit/dispositivos físicos disponibles.
Datos crudos y fuentes SHA en [measurements](measurements/history-scoped-events-shift.capacity.json).
Resultados de fallos en [recovery](measurements/history-scoped-events-shift.recovery.json).

Cierre comprobado: check y tipos correctos; regresión 164/164; contratos 321
aprobadas + seis TODO; npm test 485 aprobadas, seis TODO y único fallo público BUG-05.
25 suites Chromium terminaron sin fallos, además del corpus medido por separado.
[Manifest de verificación](measurements/history-scoped-events-shift.verification.json).
No se iniciaron pruebas nuevas para cerrar la pausa. Esta fase no conecta el
historial con Planner ni declara corregida su reproducción pública.

## 14. Bloqueos abiertos

Capturas/legado en la fecha, dependencias registradas, serie desconocida/ambigua,
fecha pasada/normalizada, between/allDay directos, calendario inválido/indeterminado,
variante __base principal no representable, presupuesto excedido, base/filas obsoletas,
fuentes divergentes y cambio de zona. No se fuerza una aceptación parcial.
La verificación incremental presupone apertura íntegra y escritor participante; no
relee en cada shift cuerpos inmutables/fotos ajenos. Apertura/auditoría/importación
siguen haciendo verificación completa. Corrupción fuera del alcance puede descubrirse
solo allí; no se suprimió ese límite ni se promete protección frente a código malicioso.

## 15. Condiciones para B.3c.2 y antes de 4C

Se puede diseñar B.3c.2 después de revisar esta entrega. Debe definir cancelación /
eliminación de planificación, confirmación, excepciones, dependencias futuras y
conservación de capturas; ninguna eliminación de eventos se implementó aquí. Un
movimiento físico de varios bloques requiere otro comando explícito y prueba total.
Si se estudia mover fechas ya registradas, hará falta contrato independiente; no
extender retain-frozen por analogía. No se inicia nada automáticamente.

4C sigue NO preparada ni autorizada: faltan B.3c.2/B.4, paridad React y avisos
asíncronos reales, barrera de escritores experimentales, tratamiento de ambigüedades,
aprobación de privacidad/borrado físico, otros motores/dispositivos y procedimiento
de activación/reversión probado. No se elimina información v1, no se cambia Pages
ni se publica el laboratorio. El fallo público BUG-05 permanece.

## Registro de checkpoints y correcciones de fixtures

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


### Pausa solicitada por el propietario

Las suites que estaban ejecutándose terminaron; los resultados anteriores que
indicaban verificación pendiente quedan completados según verification.json. Sin
procesos Node de pruebas activos. Se conservan las últimas ampliaciones ya hechas
a los fixtures de captura futura y rutina límite concurrente, ambas verificadas.
No se desarrolló nada adicional para este cierre. Pendientes: revisión técnica de
la entrega, decisión de retomarla y eventual PR; no hay autorización de nuevas fases.
