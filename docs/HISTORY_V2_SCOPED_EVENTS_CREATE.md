# BUG-05 · B.3b.1: creación incremental de eventos (experimental)

Base `13ee9d1b1da0c336c8f190d4cf50ec266da6ac50` (PR #16).
Rama `feature/history-scoped-events-create-v2`. Checkpoints A `6333314`, B `1da0af5`.
**Solo laboratorio `fullhouse-lab-*`: producción sigue en v1. No habilita 4C.**

## 1. Arquitectura y puertos

`storage-events.cjs` separa identidad, selección del alcance, normalización y prueba.
`storage-incremental.cjs` verifica filas, sella el delta, calcula la raíz y confirma
mediante el wrapper de linaje existente. `events-session.cjs` reutiliza la semántica
confirmado/pendiente/borradores de B.1; solo admite `createEvent`.

Puertos: `reserveEvent`, `readEvent`, `prepareEvent`, `eventMetrics`, `commitEvent`.
La reserva y el candidato son capacidades inmutables de una conexión/base verificadas;
no se aceptan objetos reconstruidos arbitrariamente como capacidades. Recuperar exige
reconstruir el comando y volver a validar sus resultados sobre la base esperada.
No se importa ningún módulo experimental desde la aplicación pública.
El consumidor debe enlazar el formulario con `setDraft`: no hay captura automática de
borradores React ni persistencia implícita de contenidos que solo estén en memoria.

## 2. Operaciones admitidas

- Actividad puntual sin rutina, con o sin meta; día completo sin rutina.
- Ocasión de varios días sin repetición, con extremos civiles válidos.
- Rutina existente compatible con capturas: inicio, término o intervalo `between`.
- Daily, weekly, weekdays, custom, dates, y mensual/anual/every finitos, bajo prueba.
- Propiedades, excepciones y fechas específicas válidas del formato existente.

Se bloquean edición, cortes, desplazamientos, eliminación y adopción incremental.
Una rutina con variante real `__base` es planificable en B.2, pero no se admite aquí:
una programación nueva debe poder capturarse inequívocamente. Tampoco se admiten todavía
rutina + día completo, modo implícito con variantes, IDs de paso incompatibles con
los diccionarios históricos (`__proto__`, `constructor`, `prototype`), ni día completo
entre rutinas. Son restricciones explícitas experimentales; no cambios en Planner.

## 3. Identidad y reservas

`eventId = event-v2:<receiptHash padre>:<operationId codificado>`;
`seriesId = series-v2:<receiptHash padre>:<operationId codificado>`.
`operationId` explícito, 1–128 caracteres alfanuméricos/`_.:-`, independiente del reloj.
La pareja, generación y recibo padre se reservan antes de normalizar. El borrador
conserva `id: ''`; se inyecta el ID reservado mediante el `uid` del controlador aislado.

Se comprueban IDs actuales, identidades presentes en capturas/legado y series, y se
rechazan los reservados `review-*`. No se acepta `seriesId` ni `recipeRevisionId` del
formulario. La reserva no escribe ni equivale a guardado. Al confirmar se anexa una
única fila y su ID a `header.eventIds`, sin reordenar entidades anteriores.

Un reintento sobre la misma base usa los mismos IDs. Tras un commit cambia el recibo
padre, por lo que un evento eliminado no puede reemitirse en esa cadena. No es una
identidad global entre clones ni una autenticación contra código malicioso. Los IDs
borrados de fuentes antiguas sin ningún registro no pueden reconstruirse. Restaurar
requiere destino y génesis/autoridad nuevos; no se fusionan clones automáticamente.

## 4. Alcance y relaciones

Se parte del catálogo verificado, conservando el orden original de eventos. El
componente conecta eventos de una misma rutina y referencias `between` en ambos
sentidos. Incluye todos los segmentos/alternativas de límites, incluso lejanos.
Se leen y verifican eventos del componente, sus rutinas, meta seleccionada y revisiones
referenciadas. La comprobación de duplicado futuro ve todos los eventos de esa rutina.

`readEvent` devuelve la entidad, relaciones y una página de descriptores históricos
(incluidos registros de eventos ya eliminados). No devuelve fotografías ni trata
esos descriptores en caché como lectura fresca de hechos: `readExecution`/`readPhoto`
verifican las filas correspondientes cuando se solicitan.

Solo en `move` puntual se incluyen todos los eventos para no omitir un solapamiento
ordinario no conectado. El número de filas de planificación está acotado. No se leen
los 5.000 logs durante la preparación: el índice histórico se construye al abrir y se
comparte con los tokens de cambios de planificación que no modifican ejecuciones.

## 5. Semántica real de Planner

Se reutiliza `saveEvent` extraído del código real mediante `planner-actions.cjs`.
Conserva trim del título, mínimo de un minuto (incluidos números negativos), deduplicado
de `specificDates`, `applyFrom` no persistido, duración de ancla de término, reglas de
ocasiones y validaciones del formulario. Horas almacenadas siguen el esquema actual;
el extremo calculado 24:00 es válido, no se amplía el formato del campo `endTime`.

La prohibición actual de dos programaciones futuras de una misma rutina se conserva:
`sameScheduleActive(other, today)`, no una regla nueva de intersección de calendarios.
Una programación anterior inactiva puede coexistir con una nueva, con otra identidad.
Se exige la meta/rutina actual referenciada, sin reasignar hechos históricos eliminados.

**Regresión `__fh_preview__`:** una entidad real con ese ID hacía que el preview público
omitiera un límite. La prueba reproduce el rechazo del controlador real original y
comprueba la creación correcta del puerto. Se desactiva únicamente ese preview de ocho
filas en el controlador descartable, sustituyéndolo por la prueba completa posterior.
El puerto opcional de frames memoizados usa la semántica comprobada de B.3a y conserva
el primer límite aplicable por orden; el extractor sin opción continúa igual.

## 6. Prueba completa del efecto

Solo `valid` permite sellar el candidato. `invalid` entrega contraejemplo (fecha,
actividad, restricción, frame, alternativas/dependencias cuando procede);
`indeterminate` impide escribir. Los errores iniciales del formulario conservan los
mensajes reales de Planner. No se usa un prefijo de ocho ocurrencias como certificado.

Para un evento finito se verifica desde su fecha hasta el último día de su efecto:
`none` hasta su fecha/endDate de ocasión; `dates` hasta el máximo pertinente, limitado
por un endDate existente; otras recurrencias hasta su endDate explícito. El nuevo evento
no ocurre fuera de ese intervalo y las demás filas/orden permanecen idénticos: allí no
puede cambiar la selección de límites. Esto no inventa un cierre para series indefinidas.
Dentro del intervalo se verifica el componente entero, no solo el evento nuevo.

## 7. Recurrencias y presupuestos

UTC utiliza el motor B.3a, con dominio contractual 0100–9999, partición de excepciones,
periodicidad gregoriana y MCM cuando corresponda. Una serie sin endDate no significa
una demostración fuera del dominio contractual. Presupuestos excedidos bloquean.

En zonas locales, un efecto finito agota su rango. Para efectos indefinidos se utiliza
la cobertura de estados de B.2/B.3a.1: particiones por inicios, cierres, excepciones y
fechas específicas; estados semanales reales o enumeración completa de segmentos cortos.
No se confunden siete etiquetas con siete weekdays (Apia requiere nueve en el caso
reproducido). Todo el componente debe satisfacer los supuestos. Indefinidos monthly,
yearly y every en zonas no UTC siguen bloqueados. Un componente que los contenga puede
sin embargo verificarse para el efecto finito de una actividad nueva.

Límites adicionales: 2.048 eventos existentes de planificación, 32 por componente, 64 para análisis
`move`; límites B.3a de estados/perfiles/trabajo y B.2 de fechas/comprobaciones siguen
vigentes. No se aceptan muestras parciales al agotarlos. El coste de alternativas es
cartesiano; se incluyen base y todas las opciones elegibles sin centinelas de IDs.

## 8. Entorno temporal

Las pruebas nuevas se ejecutaron en UTC, America/Mexico_City, America/New_York,
Europe/Madrid y Pacific/Apia, sobre las fechas reales interpretadas por JavaScript.
Se bloquean fechas normalizadas explícitas, incluida Apia 2011-12-30. No se modifica
`parseDay` ni `occurs`; siguen vigentes las conclusiones de CALENDAR_HARDENING.

Se fija la zona observada antes/durante preparación y antes/dentro/después de confirmar.
Cambiar antes de escribir bloquea. Si se detecta después, **el commit puede existir**:
se conserva el candidato y debe inspeccionarse el recibo antes de reintentar. Recuperar
en otra zona requiere reconstrucción y prueba nuevas. No se promete detectar un cambio
y regreso entre observaciones, ni modificaciones de TZDB bajo el mismo nombre.

## 9. Dependencias

Se conserva la primera ocurrencia límite aplicable, no se busca otra que haga encajar
el intervalo. Se rechazan límites ausentes, iguales o autorreferentes, ciclos, intervalos
imposibles, cadenas afectadas y alternativas que superen el presupuesto. Añadir un límite
nuevo puede invalidar una dependencia anterior: también se comprueba ese caso.
Duraciones fijas/flexibles se evalúan mediante `routineBalance` real para todos los
perfiles aplicables. 24:00 exacto permitido; un minuto posterior rechazado.

## 10. Solapamientos

Los solapamientos ordinarios se permiten. Si `overlapMode='move'` realmente necesita
mover otros bloques, se bloquea toda la creación y se conserva el borrador. No se
pospone parcialmente. Cuando no hay desplazamiento, se conserva la equivalencia.
En recurrencias/día completo/between la bandera no activa movimientos en Planner;
el puerto conserva ese comportamiento, sin prometer una posposición futura.

## 11. Transacciones y recuperación

La única fila nueva, cabecera, cabeza, autoridad y recibo se confirman en una transacción
IndexedDB del protocolo de linaje. CAS, comparación del alcance y rechazo de referencias
nuevas existentes se mantienen. Confirmación requiere lectura posterior de filas y recibo,
además de vigilancia de fuentes. Antes de ello, la sesión conserva confirmado y pendiente
por separado; el borrador nunca se presenta como persistido por estar en memoria.

Se probaron aborto, cuota real, cierre durante TX, lectura fallida tras commit, acuse
perdido/reintento, obsolescencia entre pestañas y corrupción de una relación. Los IDs
se conservan, no se duplica la actividad. El paquete binario de recuperación contiene
comando, candidato y borradores; se distingue de un respaldo confirmado completo.
El replay vuelve a reservar, reconstruir y comparar la raíz. No rebasa automáticamente
un candidato obsoleto ni mezcla una rama divergente.

Las fuentes v1 se comprueban antes y después. Si cambian durante TX, el commit v2 puede
haber ocurrido y la base queda en recuperación persistente. LocalStorage e IndexedDB no
comparten una transacción: no existe exclusión perfecta de una pestaña v1 no participante.
Se conservan ambas ramas, sin elegir por fecha. Un cierre forzado puede perder borradores
no exportados y candidatos que todavía solo estaban en memoria.

## 12. Invariantes históricos

La creación escribe cero ejecuciones, revisiones o fotografías. La definición validada
en memoria para comprobar la capturabilidad se descarta: programar no es ejecutar.
Se conservan hashes por clave de logs, revisiones y evidencias, unidades/alternativas,
propietarios y bytes. Legado y tramos adopted-current permanecen diferenciados.
No se corrige retrospectivamente ninguna decisión `__base` ni se borra contenido físico.

## 13. Pruebas y mediciones

Resultados y entorno reproducible: [capacidad](measurements/history-scoped-events.capacity.json),
[calendario](measurements/history-scoped-events.calendar.json),
[recuperación](measurements/history-scoped-events.recovery.json) y
[verificación](measurements/history-scoped-events.verification.json).
Los registros de A/B recuperados terminaron completos; los escenarios nuevos de C
se ejecutaron por separado. El cambio posterior de normalización mínima se incluyó
en la medición final; no se reutilizó la primera muestra como resultado definitivo.

| Operación | Reconstrucción completa (ms) | Preparación por alcance (ms) | TX (ms) | Confirmación (ms) | Lectura (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Puntual + meta | 7873,0 | 44,6 | 9,7 | 4,1 | 3,9 |
| Ocasión de varios días | 7220,8 | 24,6 | 9,8 | 4,5 | 3,6 |
| Diaria + rutina | 7403,4 | 38,4 | 6,3 | 3,3 | 4,0 |

Las preparaciones incluyen lectura de alcance (4,9 / 5,2 / 20,3 ms), componente
(1,0 / 0,7 / 0,6), normalización (1,2 / 0,1 / 0,1), calendario (5,0 / 2,9 / 4,0),
raíz (9,5 / 11,4 / 8,6) y sellado/resto. No son sumandos de la confirmación:
linaje previo (5,4 / 3,5 / 4,6) precede TX; linaje posterior (0,3 / 0,1 / 0,1)
ya está incluido en confirmación. Reserva de IDs 9,0 / 5,0 / 4,3 ms, separada.
El comparador de escritura completa tarda 2,9–3,1 s, incluyendo verificación global.
Apertura de sesión completa 4,94 s; ventana incremental verificada 1,40 s.

Archivo completo 49.661.182 bytes: exportar 1,34 s, importar/verificar 7,42 s,
commit de restauración 3,42 s (la apertura posterior no está incluida).
Paquete pendiente 49.743.620 bytes: exportar 1,49 s, inspeccionar 7,70 s,
reconstruir/verificar 1,86 s. Se confirmó el comando recuperado con los mismos IDs.
Todos los blobs restaurados se compararon por hash y tamaño, no solo una fotografía.

Heap de ventana separada tras solicitar GC: 1.145.446 → 43.692.992 bytes
(delta 42.547.546), con ventana de metadatos abierta. El driver de comparación completa
retiene documentos/archivos y registra 239,0 → 340,2 MB; ese dato no mide la memoria de
una creación pequeña ni demuestra ausencia de fugas. No se compara esta muestra con
las cifras antiguas de otra metodología, ni se incluyen memoria nativa/picos/Worker.

Comprobaciones finales sobre el código entregado:

| Comando | Resultado |
| --- | --- |
| `npm run check` | Correcto; no emite ni modifica app.js |
| `npm run check:history-contract` | Correcto |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 252 aprobadas + 6 TODO; exit 0 |
| `npm test` | 416 aprobadas + 6 TODO + único fallo público BUG-05; exit 1 |

17 suites Chromium aprobadas: create/calendar/faults/performance de eventos,
rutinas y sus fallos, metas, calendar-proof/Worker, alternative-safety, calendar-local,
storage (incluidos crash y nueve formatos), lineage, integration, legacy, readiness,
pending-save y day-shifts. Cero fallos nuevos de producto. Firefox/WebKit se intentaron
abrir en readiness y no están instalados; se registran como no disponibles, no aprobados.

Durante la ampliación del arnés se corrigieron dos aserciones nuevas que no respetaban
contratos existentes (orden físico por clave y respuesta recovery sin documento/head);
la repetición final pasó. También se configuró la cuota antes del primer acceso al
origen para comprobar un agotamiento real. No se eliminaron casos ni se atribuyeron
esos fallos del arnés al BUG-05 público.

Los seis TODO siguen siendo: política de borrado físico y cinco rutas públicas de
confirmación, respaldos, migración fallida, coexistencia v1/v2 y recuperación/rollback.
No son pruebas implementadas ni se suman a las aprobadas.

Suites nuevas: `history-contract.scoped-events-create.test.cjs`,
`history-contract.scoped-events-local.test.cjs`; Chromium `history-scoped-events-create`,
`history-scoped-events-calendar`, `history-scoped-events-faults`,
`history-scoped-events-performance` (ver tests/browser/README.md).

Cobertura de los escenarios del encargo (agrupados, no 35 tests independientes):

| Casos | Evidencia |
| --- | --- |
| 1–5: puntual, día completo, ocasión, meta, rutina | Node/paridad y Chromium create/calendar |
| 6–9: diaria/semanal/laborales/custom/dates | Node y prueba de componente en Chromium |
| 10–14: monthly/yearly/every finitos e indefinidos admitidos/bloqueados | Node y Chromium en UTC + cuatro zonas locales |
| 15–20: término/between, límites ausentes, ciclos, cadenas y excepción lejana | Node, incluido corte de límite en 2200 y excepción en 2500 |
| 21–22: 24:00 exacto y desbordamiento de un minuto | Node y regresiones públicas de horario |
| 23–25: ID usado, preview y rutina duplicada | Node; preview real reproducido también en Chromium |
| 26–27: solapamiento permitido/move bloqueado | Paridad con Planner real en Node |
| 28–33: cuota, cierre, acuse, dos pestañas, fuente y zona | Chromium faults/create con IndexedDB real |
| 34: legado y adopted-current | Node, originales y hashes intactos |
| 35: restauración y hashes/fotos | Chromium performance: todos los blobs y tablas históricas |

El corpus conserva 5.000 ejecuciones, 501 revisiones, 65 blobs únicos y 42.175.847 bytes
JPEG/PNG. El comparador usa el mismo documento y navegador; la sesión anterior rechaza
por complejidad y se informa como rechazo. La reconstrucción física completa se mide
separadamente, con igualdad de raíz contra el delta. No se atribuye una aceleración a
eliminar validación: el alcance conserva la prueba completa del cambio y una base ya
verificada; apertura/importación y auditoría completa siguen teniendo coste global.

La lectura/operación no hidrata fotos. El cálculo de raíz y el sellado recorren catálogos:
no se promete O(1). Las mediciones de heap JavaScript no incluyen blobs nativos, memoria
total, picos ni teléfonos. Exportar/inspeccionar/recuperar paquetes completos grandes
continúa siendo costoso y se mide fuera de la ruta habitual de creación.

## 14. Diferencias, aplazamientos y límites

La paridad corresponde solo a creación. Las restricciones de capturabilidad, prueba
completa y referencias existentes son deliberadas. Se rechazan calendarios que el
preview público puede aceptar sin demostrar todas las fechas; no se cambia producción.
No hay paridad declarada para edición/segmentación, desplazamiento o eliminación.
No hay nueva interfaz React ni control público. El laboratorio no se despliega en Pages.
No se probaron Firefox, WebKit, Android ni iPhone físicos; 390 px es viewport Chromium.
BUG-05 continúa fallando en la aplicación pública y los seis TODO siguen pendientes.

## 15. Riesgos abiertos

- Más motores/dispositivos y cambios de TZDB; costes de pruebas periódicas grandes.
- Catálogos grandes, fuentes v1 voluminosas y cadenas largas conservan costes de linaje.
- Corrupción ajena al alcance no se detecta en cada escritura incremental: apertura y
  auditoría completa siguen siendo necesarias; el certificado no sustituye integridad.
- Paridad React, migración pública, privacidad/borrado físico y adopción incremental.
- Identidades globales entre clones/restauraciones y conciliación explícita de ramas.

## 16. Condiciones para B.3b.2 y 4C

B.3b.2 puede diseñarse tras revisar esta entrega: edición desde fecha, conservación de
segmentos pasados, nuevos IDs de segmentos/series, excepciones a ambos lados y ejecución
ya capturada requieren un contrato propio. La prueba de creación se podrá reutilizar,
pero no autoriza reasignar logs ni cortar series. B.3c cubrirá movimientos/eliminación.
No se inicia ninguna automáticamente.

**4C no está preparada ni autorizada.** Faltan esas operaciones, B.4, paridad de controles
React, revisión de privacidad, recuperación de usuario y cobertura de motores/dispositivos,
además de autorización explícita y pruebas de activación/migración separadas.


### Consumidor B.3b.2: edición experimental

[SCOPED_EVENTS_EDIT](HISTORY_V2_SCOPED_EVENTS_EDIT.md) implementa capacidades de edición,
corte civil y serie persistente con deltas transaccionales. No cambia captura/archivo,
versiones ni aplicación pública. La identidad original de registros permanece; capturas
futuras requieren política explícita y los casos ambiguos se bloquean. No habilita
movimientos, eliminación, adopción incremental ni 4C.


## Continuidad experimental B.3c.1

[Shift puntual](HISTORY_V2_SCOPED_EVENTS_SHIFT.md) reutiliza linaje, catálogo y
recuperación, pero tiene una reserva distinta y solo cambia override.time de una
fecha. No corta series ni utiliza retain-frozen para mover fechas capturadas.
Es una operación aparte; las garantías de B.3b.1 y los controles públicos no cambian.
