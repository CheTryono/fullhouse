# BUG-05 · B.3a.1: seguridad de alternativas y calendario local

Base `beff90843ea46e7ca97b28309502167c6d0403ce` (PR #15).
Rama `fix/history-calendar-alternative-safety-v2`. Checkpoint A: `1441697`.
**Solo infraestructura experimental. Planner público y almacenamiento v1 intactos.**
No se implementan operaciones incrementales de eventos ni se autoriza 4C.

## 1. Causa y reproducciones anteriores

`storage-routines.choices()` usaba `['__base', ...variantIds]` y asignaba todos los
valores como decisiones. Para una variante cuyo ID real era __base devolvía dos veces
`{s:'__base'}` y nunca `{}`. activeStep interpreta el string como esa variante real;
la distribución de la base sin elección quedaba sin comprobar.

Se ejecutaron los tres tests iniciales de `history-contract.alternative-safety.test.cjs`
**antes de reparar**: 0 aprobados/3 fallidos. El primero pedía `[{}, {s:'__base'}]`;
el segundo esperaba rechazo por distribución; el tercero pedía aceptar ambas opciones
cuando cabían. Los dos últimos fallaban antes con «Rutina inválida».

Esta segunda causa matiza el informe B.3a: el codec v2 prohibía __base en toda receta,
incluso editable. La omisión del catálogo era real, pero el rechazo previo impedía
atribuirle una escritura inválida de esa plantilla por la ruta completa. No se afirma
que el ensayo anterior demostrase un commit inválido.

También se reprodujeron, antes de sus guardas nuevas:

- B.2 en Apia desde 2011-12-29 aceptaba una alternativa de viernes que no cabía entre
  sus límites: las primeras siete etiquetas omitían el viernes; el contraejemplo real
  aparece el 2012-01-06. El test falló sin error de validación y ahora exige ese rechazo.
- Una captura experimental del 2011-12-30 podía guardar plan de 10 minutos con una
  alternativa de viernes de 11: Date local lo normaliza al sábado 31, mientras resolution
  usa weekday civil UTC. La prueba de bloqueo también falló antes de la guarda.

## 2. Reparación de alternativas y compatibilidad del codec

La base del **catálogo de planificación** es ausencia de clave; las variantes guardan
sus strings exactos. El producto cartesiano visita base y cada variante de cada nodo,
con independencia por evento y también en ramas que pueden activarse. No utiliza un
nuevo string centinela. IDs duplicados de pasos o variantes ambiguas dentro de un
paso se rechazan; el mismo ID de variante en pasos distintos es válido.

No se modifica ninguna elección almacenada. En particular, un __base existente:

- En un legado v1 sigue siendo el hecho original, sin inferir qué plantilla había.
- En una captura v2 existente conserva el significado base explícita: sus revisiones
  no permiten una variante de ese nombre.
- En una plantilla actual puede identificar una variante real; ausencia de elección
  y ese string son dos estados diferentes para los helpers de planificación.

El codec ahora diferencia **plantilla editable** y **revisión capturada**. Permite ese
ID en la primera, compatible con v1, y conserva la reserva en la segunda. Campos,
versiones lógicas/físicas, formatos de respaldo y elecciones históricas no cambian.
Un lector experimental antiguo puede rechazar la admisión ampliada; no hay downgrade
ni migración implícita para hacerlo aceptar.

**Límite explícito:** crear/editar/eliminar la plantilla y demostrar su calendario
funciona; capturar/adoptar una definición que contiene la variante __base sigue
rechazado por el codec histórico, antes de modificar el original. No se declara
compatibilidad de ejecución completa para ese caso. Resolver la ambigüedad requeriría
una elección histórica discriminada (base frente a variante con ID), procedencia y
compatibilidad aprobadas; se propone, pero NO se implementa un formato nuevo aquí.

## 3. Invariantes y transacciones comprobadas

Un rechazo de preparación no crea una capacidad de escritura ni un candidato válido.
El borrador permanece en la sesión; no se presenta como un pendiente ya preparado.
La prueba compara control/cabeza/autoridad/recibos antes y después: idénticos.
No hay actualización parcial de plantilla/eventos ni lectura o reasignación de fotos.

Un candidato válido con fallo de TX sí queda pendiente, con confirmado separado.
Se ensayan abort después de escribir filas, exportación binaria, inspección/recuperación,
reintento estable, pérdida de acuse y dos pestañas. Solo se anuncia confirmado tras TX
y lectura. Generaciones/raíces/autoridad siguen coherentes y no aparecen recibos,
ejecuciones ni fotografías duplicadas. Se preservan hashes **por clave** de capturas,
revisiones y evidencias, así como los bytes/hash de imágenes y el archivo completo.

La zona se fija privadamente al empezar prepareRoutine, se compara al terminar,
al comenzar commit, dentro de TX y después de la confirmación. Una preparación UTC
no autoriza escribir bajo otra zona. Si cambia tras una escritura, el error advierte
que el commit podría existir: conservar candidato y examinar recibo, sin fingir rollback.
Recuperar el comando en otra zona reconstruye y valida la operación allí, con el mismo
ID; no reutiliza la demostración vieja. No se añade una zona persistida al esquema.

No hay persistencia garantizada de un borrador solo en RAM: hay que exportar el
pendiente válido y comprobar la descarga antes de cerrar. Un borrador inválido puede
conservarse/editarse mediante state().drafts; no es un respaldo completo restaurable.

## 4. Auditoría de otras representaciones

| Representación | Resultado |
| --- | --- |
| __base en catálogo B.2 | Corregido; base ausente y variante real separadas |
| null en catálogo B.3a | Solo interno; no colisiona con IDs string, no se guarda como decisión |
| __base en motor/resolution/codec históricos | Reserva necesaria del formato actual; conservar significado y bloquear nueva revisión ambigua |
| IDs locales de variantes / IDs de pasos | Validación de unicidad por ámbito; ramas inactivas no omiten estados; no se relacionan IDs por nombres |
| __proto__, constructor, prototype en diccionarios | Guardas existentes del codec, sin cambio. Algunos IDs v1 permiten planificación pero no todas las operaciones de diccionario v2: incompatibilidad pendiente, no renombrar automáticamente |
| adoption-source:* / adopted:* | Claves construidas con ID estable; comprueban colisiones antes de crear evento temporal o log. No sustituyen fuentes |
| Comandos pendientes / recibos / Worker | Identidad explícita y Maps/capacidades; recuperación reconstruye comando y valida raíz. No usa un string de variante como tipo de operación |
| __fh_preview__ público | Colisión reproducida: una rutina límite con ese ID puede desaparecer del preview sintético. No se modifica app; debe resolverse en el adaptador de eventos B.3b con IDs reservados reales, sin confiar en ese preview como prueba |

Las reproducciones públicas describen limitaciones observadas; no se presentan como
arregladas. No se añaden migraciones destructivas ni se alteran políticas de fotografías.

## 5. Garantía local de B.2: estados, no siete fechas

La entrada temporal se limita explícitamente a etiquetas Gregorianas canónicas
0100-01-01…9999-12-31. Se rechazan fechas fuera de dominio, puertos desconocidos y
presupuestos insuficientes; no se normalizan ni se descartan datos originales.

En un segmento donde las comparaciones de inicio/final y las excepciones son constantes,
para none/dates/daily/weekly/weekdays/custom, occurs solo depende de constantes del
segmento y de `k = parseDay(date).getDay()`. El weekday del origen de weekly es otra
constante del entorno actual. activeSteps, baseLength y routineBalance dependen de k,
las elecciones manuales y la plantilla, sin condiciones sobre año, mes u offset.
El orden del array de eventos fija el primer límite; su selección y eventFrame también
son función de esos mismos estados, incluidas cadenas y ciclos.

Por tanto, dados los helpers aprobados y un entorno estable, **todo día futuro produce
uno de los siete valores k**. Si hay un representante real de cada k en el mismo
segmento, y pasan todas las combinaciones y dependencias, se ha demostrado ese segmento.
No se requiere que el mapa etiqueta→weekday sea periódico, inyectivo o sin DST.

`calendarDates` divide en origen/sucesor, specificDates/sucesor, overrides/sucesor,
endDate/sucesor y límites del dominio. Por segmento semanal enumera etiquetas hasta:

1. Haber observado los siete weekdays reales: cobertura all-local-weekdays.
2. Agotar todas las etiquetas del segmento: finite-exhaustion.
3. Superar el presupuesto: indeterminado, nunca aceptación del prefijo.

En Apia 2011-12-29 hacen falta **nueve etiquetas**, hasta el 2012-01-06, no siete.
Los segmentos cortos se agotan por completo. Un segmento con every/monthly/yearly
finito se agota igualmente: no se detiene al observar siete weekdays.
Las comprobaciones de rutina sin eventos también cubren todos los weekdays reales
con testigos de referencia, porque su validación depende solo de k.

El catálogo por sí solo no autoriza nada: buildChange comprueba la huella de los helpers
reales (compartida con B.3a), luego todos los frames/balances/perfiles del componente.
proof incorpora status valid, algoritmo de cobertura, zona, dominio y segmentos.
No es el certificado general B.3a ni sustituye modelo, linaje, CAS o confirmación.

## 6. Every, meses, años, excepciones y captura local

`every` calcula round de diferencias de medianoches locales. Un cambio de una hora
normalmente no cambia el entero redondeado; un salto de fecha sí puede hacerlo.
Se comprueba Apia, y se inspeccionan offsets/normalizaciones de México 2010/2023,
Nueva York 1883, Madrid 1940 y Apia 1892/2011. Se comprueba además every2 frente
a los cambios de una hora de México 2010 y Nueva York/Madrid 2021, y frente al día
repetido de Apia 1892. Esas observaciones son tests históricos,
no una prueba de todos los offsets futuros.

Una condición suficiente para reducir every a días civiles sería demostrar en todo
el alcance que `t(d)-ordinal(d)*86400000` difiere del valor del origen en menos de
12 horas. Para meses/años/weekday civil también haría falta demostrar que el constructor
conserva año/mes/día de cada etiqueta. Hay que comprobar todo el alcance o disponer
de un contrato nativo/TZDB verificable; unas muestras y el ciclo de 400 años no bastan.
Esto no se implementa ni autoriza por una presunción sobre la zona de México.

El resolver histórico actual usa weekday civil UTC. El adaptador de nuevas capturas
ahora exige que parseDay conserve los campos año/mes/día locales de la etiqueta;
si no, bloquea la captura/adopción antes de crear revisión o ejecución. No cambia la
resolución de capturas existentes y permite seguir anotándolas con su contexto original.
El motor puro que recibe contexto sintético no constituye validación de una pantalla
Fullhouse: los puertos de integración deben pasar por el adaptador.

Hallazgo público conservado: addDays('2011-12-31',-1) en Apia devuelve otra vez el 31.
Puede afectar cortes/cancelaciones. No se cambia la semántica pública; el calendario
candidato debe comprobarse y bloquearse si sus dependencias quedan inválidas.
La presencia/alcanzabilidad de fechas inexistentes en los controles React sigue siendo
una decisión pendiente: una prueba de occurs/frame sobre etiquetas no certifica todos
los flujos de navegación ni su equivalencia con una fecha físicamente existente.

## 7. Política conservadora para México y B.3b

| Alcance | B.2 actual | Motor general B.3a |
| --- | --- | --- |
| Semanal/diario/laboral/custom indefinido local | Demostrable con todos los estados semanales, particiones, alternativas y frames | Sin through explícito devuelve indeterminate; no se amplía ese contrato |
| Puntuales/dates/ocasiones | Comprobación de sus puntos/segmentos y estados pertinentes | Dar un rango exacto explícito que incluya todo el efecto |
| Monthly/yearly/every indefinido UTC | Sigue bloqueado en B.2 | Período combinado o rango completo, dentro del presupuesto |
| Monthly/yearly/every indefinido local | Bloqueado | Bloqueado sin through; no se promueve una prueba finita |
| Recurrencia local finita | Agotamiento entero de tramos irregulares; resto semanal probado | Agotamiento completo del rango explícito |
| Fecha normalizada al crear captura | Indeterminada en adaptador | Su prueba de etiquetas no habilita la captura |

En America/Mexico_City las programaciones semanales habituales no necesitan cambiar a
UTC ni asumir que nunca volverá a cambiar el horario legal. La prueba de siete estados
sirve bajo las funciones/runtime presentes. No garantiza una política horaria futura,
otro motor o cambios de TZDB en caliente. Reabrir/reconstruir recalcula; el nombre IANA
no es una huella de la versión de sus reglas. Cambiar la zona invalida una preparación.

Contrato para las operaciones futuras: **demostrado** solo si datos, componente,
intervalo de efecto, reglas y entorno tienen cobertura completa; **inválido** requiere
contraejemplo real; **indeterminado** incluye supuestos/presupuesto/entorno sin prueba.
Solo demostrado puede pasar a la fase CAS/TX. Errores generales de validación no son
certificados de contraejemplo: también detienen escrituras. No se interpreta un mensaje
ni una muestra UTC como autorización local. Un rango válido no autoriza lo posterior.

## 8. Límites y mediciones

Se conservan límites B.2: 256 combinaciones, 20000 fechas, 100000 comprobaciones
precalculadas. La búsqueda no tiene un horizonte que habilite aprobar parcialmente.
La reserva del centinela no reducía el número de perfiles: duplicaba algunos. El arreglo
mantiene el producto de (1+variantes) y restaura su cobertura real, sin podar ramas.
La nueva cobertura puede necesitar más fechas locales; si no cabe, se bloquea.

Corpus Chromium 156, misma máquina/datos para comparador completo e incremental:
5000 ejecuciones, 501 revisiones, **42175847 bytes** de 65 JPEG/PNG sintéticos reales.
[Resultado íntegro](measurements/history-calendar-hardening.capacity.json).

| Operación | Preparación incremental | Relaciones | Validación | TX | Confirmación | Lectura |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fija sin alternativa | 24,5 ms | 5,4 ms | 1,4 ms | 8,5 ms | 4,2 ms | 11,1 ms |
| Añadir variante real __base | 21,0 ms | 5,3 ms | 2,3 ms | 7,3 ms | 3,0 ms | 11,9 ms |

La segunda evalúa 2 perfiles sobre 8 fechas, frente a 1 sobre 8. Su preparación física
completa cuesta 7458,7 ms, con igual raíz/hechos; la sesión completa anterior **rechaza**
el corpus por complejidad, no se registra como operación lenta. El coste incremental
incluye raíz O(N) de descriptores, no hidratación de 5000 logs ni base64 de imágenes.
Lectura reporta cero bytes hidratados; recibos, cero imágenes nuevas. Verificación de
fuentes/linaje 4,3 ms antes y ~0,1 ms después en esa muestra; apertura completa 1288,3 ms.
Exportación/importación/restauración ~1546,8/6509,8/3726,9 ms; hechos y fotos iguales.

Es una muestra de escritorio, no un percentil ni una mejora de velocidad atribuible
al cambio de centinela. Heap observado ~363,8 MB contiene ambos comparadores, documentos,
canvases y archivos; no se midió pico, retención tras GC ni memoria exclusiva de la ruta.
No demuestra viabilidad móvil física ni ausencia de fugas. No se relajó validación.

## 9. Pruebas y resultados de cierre

16 pruebas Node nuevas (8 alternativas y 8 locales); reproducción __base anterior de
B.3a actualizada para exigir la cobertura correcta, sin seguir esperando el defecto.
Casos: base/variante válidas e inválidas, ramas manuales anidadas/inactivas, días,
flexibles/fijas, tiempos/dependencias, IDs ambiguos y presupuesto; codec y snapshots;
UTC vs locales, finitos completos, fuentes semánticas incompatibles y fechas normalizadas.

| Comando | Resultado |
| --- | --- |
| npm run check | Correcto |
| npm run check:history-contract | Correcto |
| npm run test:regression | 164 aprobadas |
| npm run test:history-contract | 231 aprobadas, 6 TODO |
| npm test | 395 aprobadas, 6 TODO y único fallo conocido público BUG-05 |

Chromium: rutinas B.2, fallos/cuota/recuperación, calendario B.3a/Worker, almacenamiento,
linaje, integración, legado, guardado pendiente público y horarios. Suites nuevas de
alternativas/transacciones/cambio de zona y Mexico City/New York/Madrid/Apia.
[Recuperación](measurements/history-calendar-hardening.recovery.json) ·
[Zonas y cobertura](measurements/history-calendar-hardening.zones.json).
Los viewports 1280/390 son Chromium adaptable. Firefox, WebKit y teléfonos físicos
**no probados**; no se inventan resultados para ellos. Sin errores JS en las suites.

## 10. Condiciones para B.3b y bloqueos pendientes

Puede proponerse B.3b **experimental y con dominio explícito**, sin iniciarlo aquí:

1. Usar prueba completa UTC o rango local exacto para cambios cuyo efecto sea finito;
   fuera de ese rango demostrar que la planificación no cambió. Nunca poner un final
   arbitrario a una serie indefinida para obtener un certificado favorable.
2. Si se quiere usar el argumento semanal local en un verificador general, portar su
   cobertura al contrato/certificado correspondiente y probar efectos de saveEvent,
   corte/series/overrides y orden de candidatos; no importar metadatos de B.2 como permiso.
3. Componentes completos y ordenados, hashes vigentes, zona fija, autoridad/CAS/TX y
   lectura de recibo obligatorios. Un certificado no permite cambiar capturas o claves.
4. Decidir comportamiento de capturas existentes en el corte y futuras, fechas locales
   inexistentes, cambios de zona y significado de duraciones. No se cambian reglas visibles.
5. Aprobar representación no ambigua antes de capturar/adoptar variantes __base y cerrar
   otras incompatibilidades de IDs/diccionarios. No reescribir elecciones guardadas.
6. Resolver preview sintético y cortes addDays antes de confiar en rutas de eventos para
   esas fechas. B.2 sigue usando recursión real de eventFrame: grafos grandes pueden ser
   costosos; B.3b debe conservar presupuestos y usar la memoización ya probada de B.3a.

Antes de 4C siguen pendientes además barrera de capacidades para todos los escritores
experimentales antiguos, privacidad/borrado físico aprobados, paridad React, otros motores,
dispositivos físicos, previsualización y autorización. La versión física 2 no vuelve
seguros por sí mismos a todos los binarios B.2 anteriores con prueba semanal defectuosa.
No se elimina la reproducción pública BUG-05 ni se declara resuelto su funcionamiento.


### Consumidor experimental B.3b.1

La creación de eventos utiliza el motor B.3a para efectos finitos/UTC y la cobertura
semanal local B.2/B.3a.1 para componentes que cumplen sus supuestos. No amplía el
verificador general ni sustituye la ruta de rutinas B.2. Sin edición, cortes,
movimientos ni activación pública. Véase [SCOPED_EVENTS_CREATE](HISTORY_V2_SCOPED_EVENTS_CREATE.md)
para límites, transacciones, identidades y pruebas nuevas.
