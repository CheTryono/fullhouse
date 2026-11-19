# BUG-05 · B.3b.2: edición experimental por alcance

Base `c61e6acebb6326faf050502b4533e1e589d0ab3e` (PR #17).
Rama `feature/history-scoped-events-edit-v2`. Checkpoints A `c5dd206`, B `215498f`.
**Solo laboratorio `fullhouse-lab-*`. Producción continúa v1; 4C no autorizada.**

## 1. Contrato de edición

`storage-events-edit.cjs` prepara cambios puros; el puerto de `storage-incremental`
verifica el alcance y sella el delta. `events-session` admite `editEvent` además de
`createEvent`, con confirmado, pendiente y borradores separados. El consumidor debe
conservar el formulario mediante setDraft; no se captura automáticamente React.

API: reserveEventEdit, readEventEdit, prepareEventEdit, eventEditMetrics,
commitEventEdit, inspectOperation, exportPending y resumePending. Una capacidad de
creación no puede preparar una edición. Las reservas están ligadas a la conexión,
base, operación y sourceEventId; la misma operación no puede editar otra entidad.
Solo una prueba válida permite preparar la escritura; error/contraejemplo o
indeterminate bloquea. Ni reserva ni preparación son una confirmación de guardado.

## 2. Clasificación completa de cambios

Metadatos admitidos: title y note (descripción real del evento). Una captura verificada
congela sus etiquetas: renombrar la programación no renombra la captura. Los eventos
**no tienen color propio ni desc** en el codec cerrado: heredan color de meta/rutina.
Añadir esos campos se rechaza; no se amplía el esquema para hacer pasar la prueba.
Cambiar colores de sus entidades propietarias corresponde a otros puertos.

Planificación: todos los campos funcionales restantes, incluidos minutos, rutina,
meta, allDay, overrides, evidencia requerida y overlapMode. Se comparan propiedades
completas, normalizando defaults vacíos equivalentes y orden de conjuntos de fechas/días.
La identidad y recipeRevisionId no son editables del formulario. Cambiar campos
sin contrato se rechaza. El formulario es completo (readEventEdit → copia → cambios),
no un patch que borre implícitamente propiedades omitidas.

Un metadato con applyFrom futuro explícito se trata como cambio temporal. Metadatos
inmediatos actualizan la fila sin crear un segmento ni tocar capturas. El puerto
conserva las restricciones de normalización/capturabilidad de B.3b.1: una definición
ambigua, referencia actual inexistente o formulario no compatible puede bloquearlo.
No se promete reparar automáticamente programaciones antiguas inválidas.

## 3. Identidades de segmentos y series

El nuevo ID se reserva antes de normalizar:
`segment-v2:<receiptHash padre>:<operationId codificado>`. No depende del reloj.
El prefijo conserva el ID original y su lugar en header.eventIds. El futuro se anexa
al final, conservando el orden de selección real de límites. Si no hay ocurrencias
previas al corte se actualiza en lugar de crear un segmento innecesario.

seriesId conserva su significado H1: una programación lógica, varios segmentos y
un único par serie/fecha por ejecución. Si falta, solo puede recuperarse de una
identidad capturada inequívoca o reservarse nueva sin registros. No se asocia por nombres.
Los IDs actuales/históricos y la reserva review-* se comprueban. La reserva no asigna
serie a una edición inmediata de metadatos que originalmente no la tenía.

Relación entre segmentos: misma serie y rangos temporales disjuntos; no se añade un
campo de procedencia ni se cambian versiones. Rangos solapados de una misma serie
se bloquean incluso si una intersección de reglas pudiera parecer vacía. La relación
es temporal, no un árbol de ascendencia ficticio. Los recibos vinculan cada delta al
linaje. Hashes detectan inconsistencias; no autentican contra código malicioso.
Los clones/restauraciones no se fusionan automáticamente ni son rollback transparente.

## 4. Corte civil y fase de recurrencia

applyFrom por defecto es today; nunca anterior. Aritmética civil ordinal/date en
0100–9999 calcula cut - 1, sin addDays local. Deben existir ocurrencias originales
restantes: editar después de la última no resucita la intención; crear otra actividad
es una operación separada. Si la propuesta no deja ocurrencias, se bloquea: no se
implementa una cancelación/disfraz de deleteEvent en esta entrega.

El prefijo se copia del original y se cierra antes del corte; el futuro no empieza
antes del corte ni antes del origen propuesto. Se encuentra su primera ocurrencia
con occurs real. No se cambia ciegamente date al corte: weekly mantiene weekday,
monthly día del mes, yearly día/mes; una anual de febrero 29 puede empezar años después.

Para every entero UTC, rebasar el origen a una ocurrencia conserva el módulo. En otros
casos se exige comparación exhaustiva de occurs antiguo/propuesto sobre todo el rango
finito. Sin rango o sin presupuesto, indeterminate. Búsqueda/comparación tienen un
presupuesto total de 20.000 comprobaciones, nunca una autorización por muestra.
Punto y fechas específicas se resuelven por su lista exacta de candidatos.

Las ocasiones multiday pueden dividirse en dos rangos; un punto pasado registrado no
se reprograma retroactivamente. Corte en primera fecha o sin ocurrencias previas puede
actualizar la fila. Corte en un día sin aparición mantiene la fase y no inventa una
aparición ese día. Un hueco hasta la primera ocurrencia futura es intencional.

## 5. Capturas pasadas, del corte y futuras

El catálogo verificado identifica todos los registros de la fuente y serie sin fotos.
Incluye fecha, ID de ejecución, procedencia, clave y hash. No es una lectura fresca
de 5.000 cuerpos: readExecution verifica el cuerpo cuando se solicita. Las capturas
futuras participantes sí se incluyen en la comprobación de filas de la transacción,
con aviso conservador para toda la serie, hasta un máximo explícito de 256; más exige otra estrategia, no validación parcial.

Sin capturas futuras se segmenta normalmente. Con capturas del corte o posteriores
se exige **confirmación y `capturedFuture: 'retain-frozen'`**. Se conserva la captura,
su fecha, sourceEventId, clave textual, executionId, recipeRevisionId, resolución,
alternativas, marcas, notas, continuaciones, correcciones y propietarios de fotografías.
Puede seguir apareciendo el registro aunque la fecha no figure en la nueva repetición.
No se anuncia que fue movido o rehecho con otra definición.

Coexistencia demostrada dentro del lector/motor existentes: timeline reconoce el par
serie/fecha y no añade otra pendiente; el motor y prepareExecution rechazan una segunda
captura. Para continuar una ejecución se utiliza su identidad/contexto original, nunca
el ID del nuevo segmento como identidad de la ejecución. La conexión de todos los
controles React sigue pendiente: esto no es una promesa de paridad pública completa.

Bloqueos deliberados: legado relacionado (puede cambiar una estimación sin contexto
original), múltiples series incompatibles, fecha capturada normalizada y override
antiguo o propuesto en una fecha capturada futura. El snapshot no conserva toda la
regla bruta de ese override; no se transfiere implícitamente a otro propietario.
Resolverlo requiere un contrato separado de procedencia/recuperación, sin inventar pasado.
La adopción incremental no se implementa; datos adoptados/legado ajenos quedan intactos.

## 6. Excepciones y fechas específicas

Los valores anteriores al corte proceden del original. Si el formulario intenta
alterarlos, se bloquea en lugar de ignorar el intento. El prefijo conserva sus
specificDates/overrides anteriores y el futuro recibe los del corte y posteriores.
Al escoger la primera ocurrencia se descartan specificDates anteriores a ella que ya
no ocurren (p. ej. fechas canceladas); sus overrides posteriores al corte se conservan
como datos del tramo futuro. No se duplican excepciones activas ni registros.

Un override no crea una aparición fuera de la regla real de occurs: solo time/skip.
Cambiar frecuencia no convierte una fecha en una ejecución. Se comprueba todo el
efecto de retirar las ocurrencias originales, no solo las nuevas que permanecen.

## 7. Relaciones y dependencias

Se une el componente anterior con el que introduce el borrador y los segmentos de
serie pertinentes. Incluye rutinas vieja/nueva, límites, cadenas, metas y revisiones
referenciadas, preservando header.eventIds. Hasta 32 eventos en el componente completo;
catálogo de hasta 2.048 eventos existentes. Move puntual inspecciona todos, máximo 64.

No se busca un límite alternativo para conseguir un resultado favorable. Anexar el
segmento puede cambiar qué límite es primero: se comprueba el orden candidato real.
Se rechazan ciclos, límites ausentes y presupuestos fijos/flexibles incompatibles,
incluido un segundo nivel que cambia al modificar un límite de otro bloque.
La prohibición de otra programación futura de la misma rutina en otra serie conserva
sameScheduleActive(today); los segmentos de la misma serie solo se exceptúan tras
probar sus rangos disjuntos. No hay prohibición global de solapamientos ordinarios.

## 8. Auditoría y diferencias respecto a Planner

saveEvent normaliza título/minutos/fechas y valida. scheduleChanged compara time,
endTime, anchor, afterRoutineId, beforeRoutineId, date, endDate, repeat, repeatDays,
everyDays y specificDates. **Omite minutes, routineId, goalId, kind, allDay, overrides,
overlapMode y requestEvidence.** Una reproducción real confirma que cambiar minutos/
override puede evitar confirmación y aun así mover las claves de logs.

Con original: startChange = applyFrom || today. Corta si original.date < startChange,
original.date < today y (repeat != none || endDate >= today). finalStart es el mayor
entre x.date/startChange. El prefijo conserva ID, cierra con addDays(-1) y filtra overrides;
el futuro recibe uid y propiedades futuras. Mueve todas las claves originalId@fecha
>= finalStart al ID futuro, incluso capturas ya registradas. Sin corte reemplaza por ID.
withOverlap puede modificar más eventos. Ninguno de esos efectos se reutiliza.

Se extrajo normalizeChange dentro del módulo experimental de creación. Reutiliza el
método real en un controlador descartable sin la fila original/otros segmentos de su
serie; uid recibe la reserva. Solo normaliza un candidato. La previsualización de ocho
filas se sustituye por prueba completa; no se toca Planner público ni su extractor
por defecto. El corte/las identidades/deltas se construyen por el contrato nuevo.

Diferencias deliberadas: confirmación más completa; fase de origen conservada;
coexistencia voluntaria de futuras capturas; nunca mover logs; bloqueo de legado,
conflictos, campos no soportados y calendarios no demostrables. Move real bloqueado;
la bandera sin movimientos mantiene la semántica existente. No hay paridad declarada
para todos los formularios ni posibilidad de shift/delete por este puerto.

## 9. Validez temporal antes y después

Para planificación se exige prueba válida de ambos calendarios sobre la unión del alcance afectado,
desde el corte hasta el máximo efecto viejo/nuevo (o todo el dominio si alguno no
termina). Una base inválida/indeterminada se bloquea y requiere diagnóstico separado.
Fuera de ese intervalo las ocurrencias no cambian; antes del corte se conserva la
semántica por construcción o se demuestra agotamiento exacto sin ocurrencias previas.

UTC: B.3a, dominio 0100–9999, periodicidad/MCM y particiones. Local: rango completo
finito o cobertura de weekdays de B.2/B.3a.1 para todo el componente; meses/años/every
indefinidos sin prueba siguen bloqueados. No se usa un certificado UTC para México.
Presupuestos de calendarios/alternativas existentes permanecen vigentes.

Apia: un corte explícito en 2011-12-30 se rechaza. Corte 2011-12-31 puede cerrar con
la etiqueta civil 2011-12-30: es un límite lexical, no una fecha física normalizada.
Si la primera ocurrencia que se pretende conservar está normalizada, se bloquea en
vez de omitirla. Cambios de zona se comprueban antes/durante/después; si se detectan
tras escribir puede existir commit y debe inspeccionarse el recibo. No se promete
observar cambios ABA ni actualizaciones de TZDB bajo el mismo nombre.

## 10. Atomicidad y linaje

Cambios de una o dos filas, header, head, authority y receipt participan en la misma
TX IndexedDB. CAS, comparación de filas y guardas de IDs nuevos se mantienen. La raíz
recorre descriptores y no es O(1); ejecuciones y fotos inmutables se comparten desde la
base verificada. No se reconstruye Data2 completo para preparar una edición pequeña.

La cuota real se agotó tanto para una fila como para un corte de dos filas: raíz y
autoridad anteriores permanecieron intactas; al liberar cuota el mismo candidato
confirmó ambas filas sin alterar hashes históricos.
Un fallo antes/durante TX no confirma una parte. Se comprobó cierre con solicitudes
activas: reapertura presenta el estado anterior o todo el nuevo, nunca mezcla. La
corrupción de una captura futura tras preparar aborta y conserva el candidato para
recuperación. Corrupción ajena al alcance exige apertura/auditoría, no se promete
revalidarla toda en cada operación. Base física 2, documento lógico 2, archivo físico
1 y formato de captura 1 permanecen sin cambios.

## 11. Pendientes y recuperación

Sesión conserva confirmado y borradores al fallar; el mismo candidato reintenta con
los mismos IDs. Lectura fallida/acuse perdido no significan ausencia de commit.
inspectOperation reconoce el recibo; confirmación requiere lectura posterior de las
filas y autoridad. Candidato obsoleto entre pestañas se conserva/exporta; no se rebasa.

El paquete binario guarda comando, identidades, candidato y borradores. Reanudar
reconstruye contra la misma base, vuelve a probar el calendario y compara raíz/originales.
El archivo pendiente no se presenta como respaldo confirmado. Archivos completos se
restauran en destino nuevo; originales y otras ramas no se borran automáticamente.
Un cierre forzado puede perder lo que solo estaba en memoria y no se había exportado.

Vigilancia v1 exacta antes y después: cambios durante TX pueden coexistir con un commit
v2 durable y dejan recuperación persistente. LocalStorage e IndexedDB no comparten
transacción; no se promete exclusión perfecta. No se elige por fecha ni se mezclan hechos.

## 12. Verificación y mediciones

Resultados y entorno: [capacidad](measurements/history-scoped-events-edit.capacity.json),
[calendario](measurements/history-scoped-events-edit.calendar.json),
[recuperación](measurements/history-scoped-events-edit.recovery.json) y
[verificación](measurements/history-scoped-events-edit.verification.json).

| Comando | Resultado final |
| --- | --- |
| npm run check | Correcto; build y app.js idénticos, sin emisión |
| npm run check:history-contract | Correcto |
| npm run test:regression | 164 aprobadas |
| npm run test:history-contract | 291 aprobadas + 6 TODO; exit 0 |
| npm test | 455 aprobadas + 6 TODO + único fallo público BUG-05; exit 1 |

39 escenarios Node nuevos, algunos agrupan varios casos. 20 suites Chromium ejecutadas
sobre esta entrega: cuatro de edición (básica/calendario/fallos/capacidad), tres de
creación, rutinas y sus fallos, metas, calendar-proof/Worker, alternativas, zonas,
storage (nueve formatos y crash), linaje, integración, legado, readiness, guardado
pendiente público y horarios públicos. Ninguna se declara heredada sin repetir;
los números de otras mediciones antiguas siguen siendo históricos, no resultados nuevos.
Firefox/WebKit no están instalados (readiness lo registra como no disponibles).
1280/390 px no son teléfonos físicos. No hay resultados aprobados de Android/iPhone.

Los seis TODO siguen siendo política de borrado físico y cinco rutas públicas de
confirmación, respaldos, migración fallida, coexistencia v1/v2 y recuperación/rollback.
El hallazgo v1 de scheduleChanged se reproduce y documenta separadamente: no se
presenta la aplicación pública como corregida por estas pruebas del puerto aislado.

Durante el desarrollo se corrigieron fixtures del arnés (punto ya finalizado frente a
serie vigente; rango anual sin aparición posterior), una aserción que devolvía string
en lugar de booleano, y se reconoció el bloqueo de una primera fecha normalizada en
Apia. Se repitieron las afectadas y las suites finales. No se redujeron validaciones.

| Casos del encargo | Cobertura comprobada |
| --- | --- |
| 1–2: nombre, descripción/color | Metadatos sin corte; note admitido, color/desc propios bloqueados por esquema |
| 3–6: hora y capturas pasadas/hoy/futuras | Prefijo, consentimiento, serie/fecha, timeline y contexto congelados |
| 7–12: cortes, primera/última fecha, punto y ocasión | Fase, ausencia demostrada, actualización sin tramo innecesario y bloqueos |
| 13–21: duración/anclas/between/rutina/meta/recurrencias | Planner real + prueba completa; indefinido no demostrable bloqueado |
| 22–25: fechas específicas y excepciones | Reparto, día del corte, rechazo de pasado y contraejemplo en 2500 |
| 26–29: dependencias, primer límite y ciclos | Unión antes/después, dos niveles y cambio de límite en 2250 |
| 30–33: 24:00, overflow, zona y normalización | Node UTC/cuatro zonas + cambio de zona real por CDP |
| 34–36: serie/IDs/confirmación | Capacidades separadas, colisión histórica, rangos ambiguos y consentimiento |
| 37–44: fallos, cuota, acuse, pestañas y replay | IndexedDB real, dos filas atómicas, cierre, fuente antes/durante y candidato exportable |
| 45–46: integridad y consulta de segmentos | Hash por clave, archivo restaurado, todos los blobs y tres segmentos de una serie |


Corpus real sintético de laboratorio: 5.000 ejecuciones, 501 revisiones, 65 blobs JPEG/
PNG únicos y 42.175.847 bytes. Cambios de metadatos, hora con corte y frecuencia semanal.
El comparador reconstruye el documento físico esperado independientemente de la raíz
incremental. La sesión completa previa rechaza por complejidad: no es un guardado lento.
Cada resultado incremental coincide en raíz; todas las filas históricas se comparan
por clave/hash y todos los blobs restaurados por tamaño/hash.

| Caso | Lectura catálogo (ms) | Preparación completa (ms) | Preparación incremental (ms) | TX (ms) | Confirmación (ms) | Lectura posterior (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Metadatos | 23,4 | 7904,2 | 71,5 | 9,8 | 4,3 | 21,1 |
| Corte horario | 23,5 | 8204,0 | 48,2 | 10,5 | 7,8 | 26,5 |
| Corte semanal | 18,4 | 8631,2 | 31,0 | 11,0 | 8,5 | 24,5 |

La preparación incluye lectura/verificación de alcance 4,1/8,1/9,1 ms; construcción
de componente 2,2/4,0/2,2; normalización 4,8/0,2/0,4; calendario temporal 10,3/5,3
(sin efecto de metadatos no necesita enumerar calendario); raíz 22,5/16,4/9,1 y sellado.
Reserva adicional 5,0/4,1/5,1; linaje previo 3,8/7,0/11,2. Linaje posterior 0,1 ms ya
incluido en confirmación. La detección de segmentos está incluida en lectura de catálogo,
no se midió como subetapa aislada. Son etapas diferentes; preparación no es latencia total.
La escritura completa comparada cuesta 3,1–3,4 s con verificación global.
Apertura completa 4,99 s frente a ventana incremental verificada 1,55 s.

Pendiente de 49.743.488 bytes: exportar 1,70 s, inspeccionar 11,44 s y reconstruir 2,00 s.
Respaldo completo 49.660.173 bytes: exportar 1,76 s, importar 7,66 s, commit de restauración
3,76 s (apertura posterior aparte). Siguen siendo operaciones costosas explícitas.

Heap de ventana de metadatos tras solicitar GC: 1.174.622 → 43.804.813 bytes,
delta 42.630.191. Driver con documentos/comparadores/archivos retiene 356,4 MB.
No mide picos, blobs nativos, RSS total ni memoria física móvil. **No se demuestra
reducción de memoria** respecto a otras entregas ni ausencia de fugas. Muestra única
Chromium de escritorio en máquina compartida; no SLO para teléfonos.

## 13. Casos bloqueados

- Campo color/desc en evento, identidades editadas, revisión de meta por este puerto.
- Legado asociado, serie ambigua/solapada, referencias actuales ausentes.
- Capturas futuras sin consentimiento, más de 256 o con overrides de fecha capturada.
- Corte anterior a hoy, explícito normalizado, sin ocurrencias originales restantes.
- Cancelación total, traslado de captura o reinterpretación de un registro pasado.
- Base antes/después no demostrable, presupuesto/fase agotados, mes/año/every local
  indefinidos, combinaciones no capturables (__base incluido).
- Movimiento automático real de otros bloques, o cambios de excepciones pasadas.

Se comprueba el rechazo y conservación del estado/borrador cuando procede; estos
límites no se ocultan como paridad ni se sustituyen por muestras parciales.

## 14. Preparación para B.3c

Puede revisarse el siguiente contrato, sin iniciarlo: desplazamiento/eliminación,
cancelación de dependencias futuras, confirmaciones y conservación de segmentos y
capturas. Debe reutilizar el alcance completo y nunca copiar el traslado de logs v1.
La política de overrides de fechas ya capturadas necesita diseño explícito antes de
ampliar este puerto. B.4/adopción incremental es otra entrega independiente.

## 15. Bloqueos antes de 4C

**NO preparada ni autorizada.** Persisten integración/paridad de controles React,
privacidad/borrado físico aprobado, otros motores/dispositivos, experiencia de
recuperación y autorización de migración/activación. La barrera física 2 no impide a
todos los binarios experimentales antiguos que comparten esa versión aplicar reglas
anteriores inseguras; no se amplía aquí su contrato de capacidades silenciosamente.
Ni un certificado ni una raíz válidos sustituyen CAS, fuentes y persistencia.

app.tsx, app.js, workflow y fuentes públicas v1 intactos. Sin migraciones personales,
publicación de laboratorio, borrado de fotos ni comienzo automático de B.3c/B.4/4C.
BUG-05 público y los seis TODO siguen vigentes.


## Continuidad experimental B.3c.1

[Shift puntual](HISTORY_V2_SCOPED_EVENTS_SHIFT.md) reutiliza linaje, catálogo y
recuperación, pero tiene una reserva distinta y solo cambia override.time de una
fecha. No corta series ni utiliza retain-frozen para mover fechas capturadas.
Es una operación aparte; las garantías de B.3b.2 y los controles públicos no cambian.
