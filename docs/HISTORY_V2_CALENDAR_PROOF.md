# BUG-05 · B.3a: demostración experimental del calendario

Base `33bd80a` (PR #14), rama `feature/history-calendar-proof-v2`.
**Motor puro implementado, sin integrar en B.2 ni en Planner. Producción permanece v1.**
No prepara ni confirma saveEvent, shiftEvent o deleteEvent. No activa 4C.

Actualización B.3a.1: [alternativas B.2 y prueba de estados locales](HISTORY_V2_CALENDAR_HARDENING.md).
B.2 comparte ahora la barrera de helpers aprobados, no el verificador general.

## 1. Inventario exacto de reglas actuales

La fuente de semántica es `app.tsx`; `scripts/history-browser.cjs` extrae las funciones
reales por AST, sin exportaciones públicas. No se utiliza una biblioteca de recurrencias.

| Función/regla | Semántica conservada |
| --- | --- |
| parseDay | `new Date(y,m-1,d)` a medianoche **local**. Años 00–99 remapean a 1900–1999; una zona puede normalizar un día inexistente. |
| occurs: límites | Comparación de strings date/endDate, ambos inclusivos. override.skip vence toda regla. applyFrom NO afecta occurs. |
| none / occasion | Puntual en date; occasion + none + endDate ocupa todos los días del intervalo. |
| dates | Incluye date además de specificDates; los límites y skip siguen aplicando. |
| daily / weekly | Todos los días / weekday del origen local. |
| weekdays / custom | Lunes–viernes / inclusión en repeatDays. |
| monthly / yearly | Número de día exacto / mes y día exactos del origen. No ajusta el 31 a meses cortos; febrero 29 no ocurre en años comunes. |
| every | `round((localMidnight-localOrigin)/86400000) % max(1,everyDays||1) === 0`. No equivale universalmente a diferencia de días UTC. |
| activeStep(s) | selected filtra weekday. Modo ausente se infiere por variantes, pero la rama de días base comprueba mode explícito. Primera variante aplicable gana. Manual desconocida o ausente usa base. Hijos, metas, flexibilidad y evidencia proceden de la rama elegida. |
| baseLength | Duración fija positiva **sin redondear**, o suma de pasos activos para día/choices. Sin plantilla, max(1,minutes). |
| eventFrame | allDay da [0,1440]. between elige el **primer** evento aplicable de cada rutina límite, excluyendo su ID, en orden del array; evalúa ambos límites recursivamente. Ciclo, límites iguales/ausentes o hueco no positivo devuelven null. Otros bloques usan override.time si es truthy, luego anchor=end/endTime o time. |
| routineBalance | Suma de hojas fijas y cantidad de flexibles. Rechaza fijos mayores que espacio, y suma no exacta si no hay flexibles. No sustituye disponibilidad por mínimo flexible. |
| routineMinutesOn | Redondea duración fija; no confundir con longitud no redondeada de eventFrame. |
| schedulePreview | Hasta ocho resultados en 370 días; puede marcar un between sin límites como skipped. Es vista preliminar, no demostración. |
| dependentMovementIssue | En una fecha, comprueba frames dependientes que cambiaron; eventFrame recorre la cadena. |
| repeatCollision | Misma rutina y coocurrencia, NO solapamiento de intervalos. Busca 1462 días más specificDates; no tiene llamadas públicas actuales. |

La selección de límites no ordena por hora ni busca el hueco más conveniente. Un
límite inválido elegido primero no puede sustituirse por otro posterior que funcione.
Los solapamientos ordinarios están permitidos: el verificador no introduce una
prohibición global. `overlapMode=move` no hace que mueva actividades.

## 2. Pendientes de B.2 y contraejemplos encontrados

B.2 conserva su verificador semanal/segmentado o finito. Bloquea monthly, yearly y
every indefinidos. Esta entrega no lo reemplaza ni autoriza sus escrituras con un
certificado nuevo. Se comparan fechas representativas, frames y balances conocidos,
y se vuelven a comprobar sus rutas Chromium de edición, eliminación y fallos.

Tres limitaciones se reproducen sin modificar producción:

1. Constructor local remapea 0099 a 1999: no se extrapola una aritmética civil nueva.
2. repeatCollision devuelve false para every365 desde 2000-01-01 y every366 desde
   2000-01-11; existe coocurrencia 129940 días después del primer origen. No es
   aceptable interpretar ese false como demostración de ausencia.
3. En esa base, `storage-routines.choices()` usaba `__base` como centinela.
   B.3a.1 corrige el catálogo y su reproducción ahora exige base ausente y variante
   real. La escritura completa antes fallaba por reserva global del codec; ahora
   admite la plantilla actual, pero no una revisión capturada ambigua. Ver HARDENING.

Samoa aporta otro contraejemplo a una sustitución UTC: con origen 2011-12-29,
every2 no ocurre el 31 según el cálculo local de Apia, aunque la diferencia civil
UTC sea dos días. Se reproduce en procesos Node y Chromium con esa zona.

## 3. Modelo matemático y dominio

Entrada: `{events,routines,from,through?,budgets?,disallowSameRoutineCooccurrence?}`.
Solo planificación. `projectPlan` conserva el orden de header.eventIds/routineIds y
copia esas tablas de un StoragePlan previamente verificado; no lee ejecuciones,
revisiones ni blobs. El resultado demuestra propiedades **de los datos recibidos**;
el integrador debe garantizar que el componente esté completo, sin omitir candidatos
que podrían ser el primer límite. El adaptador actual proyecta toda la planificación.

Dominio conservador explícito: etiquetas Gregorianas canónicas **0100-01-01 a
9999-12-31**, subconjunto de las fechas de cuatro dígitos de los respaldos actuales.
0000–0099 y fuera de rango son indeterminadas. No se normalizan datos ni se cambia
el contrato de almacenamiento. Sin through se examina todo el resto de ese dominio,
no un horizonte arbitrario. Un certificado nunca promete validez fuera de su dominio.
Este alcance debe aceptarse explícitamente antes de convertirlo en política pública.

En UTC, parseDay es medianoche UTC. Los milisegundos y diferencias del dominio son
enteros exactos menores que 2^53; la división por 86400000 da días enteros exactos,
y round no cambia el resultado. Cada every con N efectivo entero seguro tiene fase
fija respecto de su origen y período N. N efectivo menor que uno se convierte en uno,
como en producción. Fracciones mayores que uno no reciben prueba periódica aquí.

## 4. Demostración de periodicidad y supuestos

El calendario gregoriano tiene 97 bisiestos por cada 400 años: 400×365+97 = 146097
días. Es múltiplo de siete. Trasladar una fecha 400 años conserva mes, día válido,
weekday y condición bisiesta; los siglos no divisibles por 400 no son bisiestos.

Por componente se calcula, con BigInt:

`P = MCM(7, 146097 si hay monthly/yearly, N1, N2, ...)`.

El siete incluye pasos por weekday incluso si la recurrencia es diaria. Cada N
conserva su fase porque divide P. Una intersección entre períodos a y b con fases
separadas d existe solamente si MCD(a,b) divide d; los tests recorren exhaustivamente
los períodos 1…7 y sus fases. El motor no necesita inventar una fecha de intersección:
recorre estados suficientes o devuelve indeterminado. No usa ese test de MCD como
sustituto de validar límites, alternativas y dependencias.

**400 años no bastan para cualquier every.** Por ejemplo,
MCM(7,146097,365)=53325405 días. Varios N coprimos pueden producir un P enorme.
El motor conserva el BigInt exacto; no construye un array de P fechas ni convierte
P a Number salvo cuando cabe en la longitud finita del segmento.

Se particiona en origen y sucesor, cada specificDate y sucesor, cada override y
sucesor, endDate+1 y extremos del análisis. Dentro de cada segmento, los guardas de
inicio/final son constantes y las excepciones puntuales quedan aisladas. none/dates
son puntuales o falsos constantes; occasion es constante en su intervalo. Las demás
reglas, weekday, elección automática y duraciones se conservan al trasladar P días.
Para todo día restante existe un representante congruente en los primeros
`min(longitud,P)` días del mismo segmento. El orden de candidatos no cambia, por lo
que tampoco cambia la selección ni el resultado recursivo de sus frames.

Esto demuestra suficiencia del conjunto finito **bajo esos supuestos**, no por
haber observado ocho, 365 o 1462 resultados correctos. Excepciones muy lejanas crean
segmentos nuevos y nunca se descartan por estar fuera de una ventana habitual.

La reducción periódica exige zona reconocida exactamente como UTC y los helpers
aprobados. En otras zonas solo se permite through explícito y enumeración completa
con ocurre/frame/balance reales. Se enumeran etiquetas de fechas canónicas, incluso
si JavaScript las normaliza localmente. No se infiere el comportamiento futuro de
una zona observando unas muestras de offsets o de DST. Certificar otras zonas,
fijar TZDB o cambiar a fechas civiles requeriría otro diseño y aprobación, sin
reescribir silenciosamente la semántica actual. No se ejecuta un Worker UTC para
autorizar un calendario de una pestaña con otra zona.

## 5. Algoritmos y resultados

`createCalendarProof(schedule).prove(input,{signal,yieldControl})`:

1. Toma un snapshot JSON acotado **antes del primer await**. Rechaza getters,
   símbolos, ciclos, entradas amplias/profundas y exceso de caracteres, incluidas claves.
2. Valida el modelo de planificación con validData real y fechas canónicas del dominio.
   Fija la huella de helpers aprobados; cambios de semántica requieren revisión explícita.
3. Forma componentes no dirigidos: misma rutina no vacía y todas las referencias de
   between a posibles límites. Conserva el orden original. Componentes independientes
   se prueban por separado, evitando un MCM global innecesario.
4. Construye particiones, P y producto cartesiano de elecciones manuales por evento.
   Incluye base y cada variante, también hijos/ramas que podrían activarse. Dos eventos
   de la misma rutina pueden elegir alternativas distintas.
5. Evalúa cada estado representativo completo. Para eventos que occurs incluye:
   frame válido, intervalo positivo dentro de [0,1440] y balance real de rutina.
   24:00 exacto se permite; 24:01 no. Plantilla ausente usa minutes, como v1.
6. Devuelve **valid** solo al terminar toda la cobertura; **invalid** con testigo real
   a la primera infracción; **indeterminate** por presupuesto, cancelación, entorno,
   modelo o supuesto no admitido. Ningún prefijo autoriza una escritura.

`disallowSameRoutineCooccurrence:true` agrega una restricción analítica opcional.
No equivale a las reglas completas de saveEvent ni al manejo de duplicados futuros.
Por defecto no se prohíben overlaps ni coocurrencias. Una rutina sin eventos no tiene
ocurrencias que balancear: validez vacía del calendario no reemplaza routineIssue.

## 6. Certificado determinista

Resultado: `{status,certificate,proofHash,metrics:{elapsedMs}}`. Certificate congelado:

- format fullhouse-calendar-proof, version 1, algoritmo gregorian-component-proof-v1.
- inputHash del snapshot normalizado y ordenado, semanticsHash de las funciones reales, incluido validData,
  y DAYS; entorno (zona/constructor), dominio, from/through y presupuestos.
- Recurrencias con identidad, origen, final, repeatDays, N, fechas y overrides.
- Componentes: eventIds ordenados, routineIds, período decimal exacto.
- Segmentos: extremos, cobertura finite/periodic, representantes y perfiles requeridos,
  estados realmente examinados; contadores globales de estados, checks, trabajo y segmentos.
- Restricciones, estado, razón de bloqueo o contraejemplo con fecha, actividad, elecciones,
  frame, balance y límites seleccionados; los ciclos incluyen el camino detectado.

proofHash usa SHA-256 de canonical(certificate), con la misma codificación UTF-16LE
que la infraestructura existente. Los tiempos están fuera del hash: no son prueba.
`verify` repite el algoritmo y compara contenido y hash; alteraciones de datos, orden,
semántica o certificado fallan. Un diagnóstico cancelado puede no reproducir el mismo
punto de interrupción; no se reutiliza como autorización. Los certificados no se persisten
como verdad alternativa, ni sustituyen lectura íntegra, codec v2, linaje, CAS o recibo.

Se asumen ECMAScript Date nativo, entorno confiable y WebCrypto disponible. La huella
no autentica frente a código malicioso ni certifica una implementación nativa del
navegador. TZDB no tiene huella portable en esta API: los rangos locales se verifican
nuevamente en el entorno actual, no se confía en certificados transportados sin replay.
Un fallo de infraestructura criptográfica puede rechazar la promesa; jamás autoriza guardar.

## 7. Dependencias y alternativas

El evaluador memoizado llama los helpers reales para occurs, hojas no-between/allDay
y routineBalance. Solo replica la composición between. La selección fija de límites
produce un grafo dirigido por fecha; DFS detecta el ciclo seleccionado, no simplemente
un ciclo en la unión de candidatos de todos los días. La memoización no cambia el primer
candidato: en un DAG, inducción desde hojas demuestra igualdad de cada frame; una rama
que alcanza un ciclo no puede producir un frame válido en ninguno de los evaluadores.
Permite compartir subgrafos sin el coste exponencial de repetir eventFrame recursivamente.

No se podan alternativas suponiendo cuál elegirá el usuario ni se elimina una selección
actual del catálogo. Todas las combinaciones aplicables quedan incluidas, con límites
explícitos. La enumeración puede contener elecciones de ramas inactivas (redundancia
conservadora), pero no omite estados activos para ahorrar presupuesto.

## 8. Complejidad, límites y ejecución

Para E eventos, R rutinas, K puntos de corte, C perfiles y S estados requeridos:
componentes O(E²); cortes O(K log K); evaluación por estado O(E²+E×R+pasos visitados)
con memoización, no expansión exponencial de cadenas. Tiempo O(S×coste de estado).
Memoria del snapshot/catálogo, segmentos y perfiles acotados, más memo O(E) por estado;
no se retiene el historial de estados ni se hidratan fotografías.

| Presupuesto | Predeterminado | Máximo aceptado |
| --- | ---: | ---: |
| Estados | 300000 | 1000000 |
| Comprobaciones de evento | 2000000 | 4000000 |
| Unidades ponderadas de trabajo | 20000000 | 50000000 |
| Perfiles por rutina/componente | 256 | 256 |
| Segmentos totales | 2048 | 4096 |

Entrada: 64 eventos y 64 rutinas, 32 eventos por componente, 512 nodos por rutina,
20000 nodos JSON, profundidad 40, dos millones de caracteres de valores+claves.
Para replay del certificado se admiten 120000 nodos/cuatro millones de caracteres,
porque el certificado enumera segmentos; no amplía el presupuesto de entrada.

El trabajo pondera búsquedas de límites/rutinas y pasos; no es un contador de
instrucciones de CPU ni una garantía de milisegundos. Comprueba signal y cede el
control cada ~4096 unidades; una evaluación individual puede cruzar ese umbral.
Las fases de snapshot/hash/catálogos también son acotadas, pero son síncronas en parte.
Para trabajos grandes, el puerto usa Worker dedicado cancelable y devuelve exactamente
el mismo certificado. No escribe almacenamiento. Terminar el Worker rechaza el trabajo,
no devuelve valid. Un timeout de producto deberá cancelar y mostrar indeterminado.

No hay caché persistente de certificados. Un futuro caché solo podrá vincularse a datos
ordenados, semántica, dominio, entorno y política exactos; jamás saltarse CAS/linaje.

## 9. Pruebas realizadas y mediciones

40 nuevas pruebas Node: motor (23), aritmética (4), diferenciales (8), presupuestos (4)
y puerto (1). Se incluyen todos los N solicitados (2/3/5/7/14/30/365), orígenes 29/31,
Feb29, siglos, dos ciclos Gregorianos exhaustivos, MCD/fases pequeños, generación
reproducible de 70 calendarios finitos y todos los grafos de tres nodos con cuatro
configuraciones de límites, dos órdenes y siete fechas (128 grafos × siete días).
Las propiedades y exploraciones finitas apoyan las demostraciones anteriores;
no se proclama una demostración general basada en muestreo aleatorio.

También: límites encadenados/ausentes/cíclicos, elección por orden, cambios de día,
alternativas cruzadas/base, fechas/ocasiones finitas, cierres distintos, segmentos,
specificDates/skip/override lejano, presupuesto por tipo, snapshots, corrupción de
certificado, cancelación y rechazo de fechas/entradas inválidas.

Comandos Node requeridos y suites Chromium: ver resultado final en CAMBIOS y
[guía de pruebas](../tests/README.md). Se mantienen seis TODO de integración/activación
y la reproducción pública BUG-05, que continúa fallando. Los nuevos casos no son TODO
convertidos artificialmente en éxito; no se modificó ese fallo conocido.

Chromium **156.0.8078.79**, loopback/perfiles desechables, UTC, viewports 1280 y 390.
Node y Chromium prueban también New York, Madrid y Apia: finito real admitido,
indefinido local bloqueado. **Firefox, WebKit y dispositivos físicos no probados.**
No se repitieron intentos de descarga bloqueados de fases anteriores.

Muestra sintética única por viewport, tras calentamiento de motor/Worker; no percentiles
ni benchmark de teléfonos. [Datos crudos, máquina y hashes de implementación](measurements/history-calendar-proof.chromium.json).

| Caso | Estados | Hilo principal 1280 / 390 | Worker 1280 / 390 |
| --- | ---: | ---: | ---: |
| Diario pequeño | 8 | 9,7 / 3,9 ms | 4,4 / 4,3 ms |
| Mensual 31, cobertura gregoriana | 146098 | 2035,0 / 1631,7 ms | 1671,2 / 1670,0 ms |
| Monthly + every365, presupuesto 10000 | 10000 | 494,3 / 428,7 ms | No medido; resultado indeterminado |

Worker mantuvo 420/419 ticks de interfaz durante la prueba mensual; cancelación
comprobada antes de completar el trabajo (384/640 estados en esa muestra).
No se afirma que Worker acelere el algoritmo: separa el trabajo de la interfaz.
La preparación síncrona de entrada en estas muestras fue 0,3–0,9 ms; no representa
el peor caso permitido. Warmup combinado 117,4/65,9 ms incluye inicialización del
Worker. Heap retenido de ventana tras solicitar GC: aproximadamente 1,21 MB antes
y 1,49 MB después. Excluye Worker, memoria nativa, pico y futuros datos personales;
no es demostración de ausencia de fugas ni de viabilidad móvil física.

B.2 rechazaba mensuales indefinidos: ese rechazo no se presenta como una latencia
lenta anterior. No se vuelve a medir su corpus 5000 ejecuciones/501 revisiones/42,2 MB:
el motor recibe únicamente planificación. Getters que fallan si se accede a ejecuciones,
revisiones o fotos demuestran esa separación; no simulan una nueva prueba de capacidad.

## 10. Casos indeterminados y bloqueos

- Zona local no UTC sin rango final explícito: no hay prueba periódica general.
- every fraccionario sin rango finito explícito, fechas fuera del dominio o semántica
  no aprobada; entradas inválidas, modelos ambiguos o excesivamente complejos.
- MCM enorme, demasiados segmentos, elecciones o relaciones, o cancelación.
- Componente incompleto no certificado por el integrador: no debe usarse su resultado
  para un calendario mayor, aunque los datos parciales por sí mismos sean válidos.

Un resultado invalid contiene un contraejemplo comprobable, no una sugerencia de
mover automáticamente un bloque. Uno indeterminate nunca habilita confirmar cambios.
No hay solución CRT simbólica de todas las dependencias ni reducción general de
múltiples N coprimos. Es trabajo posible posterior, no una garantía implementada.

## 11. Compatibilidad con B.2

Se comparan los casos ya admitidos por su catálogo semanal/finito contra los helpers
reales y el nuevo motor, con frames válidos e inválidos. Se comprueban meses que antes
bloqueaba. Las suites existentes de rutinas siguen siendo la referencia de paridad de
limpieza, edición/eliminación y persistencia; el nuevo módulo no implementa esos métodos.
La diferencia necesaria conocida es incluir la base manual sin colisión de ID.

No se importa calendar-proof desde storage-routines, storage-incremental, storage-lineage,
Planner o app.js. Solo el bundle de laboratorio lo ofrece. El protocolo de autoridad,
capacidad física, hashes de filas, CAS y transacciones no se cambia ni se elude.

## 12. Diseño para B.3b: crear/editar y desplazar (NO implementado)

1. Leer ventana verificada y componente completo por índices de rutina/límites,
   conservando el orden del encabezado; reservar operationId e IDs de segmentos una vez.
2. Reutilizar métodos reales para limpieza/validaciones y documentar diferencias v2.
   from es el corte de efecto, no un campo que haga que occurs ignore el pasado.
3. Separar segmento anterior (endDate inclusivo = corte-1) y nuevo ID/seriesId estable.
   Repartir overrides/specificDates por corte; preservar excepciones y finales previos.
   **No** copiar la reasignación de logs de saveEvent v1: capturas y legado conservan
   sus claves/identidad, notas, fotografías y definición, incluso en fechas futuras.
   Si hoy ya tiene registro, definir explícitamente qué ejecución sigue perteneciendo
   al segmento original. Bloquear una transformación ambigua hasta resolver su política.
4. Probar el calendario candidato completo del componente desde el corte. En shiftEvent,
   conservar el clamp inferior a 00:00 de BUG-04, override solo de esa fecha, 24:00
   exacto, límites directos/encadenados y rechazo de between/allDay como en Planner.
5. Duplicado de programación futura de una rutina se rige por sameScheduleActive y
   confirmaciones de Planner; no sustituirlo por repeatCollision ni por esta prueba.
   Solapamiento normal permitido; overlapMode=move requiere confirmación y ampliar
   el alcance a todos los bloques realmente desplazados y sus dependientes.
6. Solo con valid: verificar de nuevo hashes/cierre del alcance, autoridad y fuentes;
   CAS y transacción de entidades+cabecera+raíz+recibo+linaje; lectura de confirmación.
   Reintento usa mismo candidato/identidades. Cambio de base invalida certificado y
   requiere nueva preparación, sin sobrescribir un candidato o historial posterior.

Una prueba de calendario no comprueba por sí misma integridad de Data2, propiedad de
blobs, conservación histórica o alcance correcto. Esas guardas siguen siendo obligatorias.

## 13. Diseño para B.3c: eliminación y dependencias (NO implementado)

deleteEvent requiere confirmación y usa cutoff de hoy o mañana si hoy tiene registro,
como Planner, pero ninguna captura/nota/foto se elimina ni se reasigna. El cierre de
series pasadas y cancelación futura debe determinarse antes de escribir. Si depende
de una rutina eliminada, propagar cancelación por todo el grafo con límite temporal
explícito; conservar segmentos previos y excepciones anteriores al corte.

Revisiones review-* requieren efectos asociados sobre la meta. Las capturas de
actividades dependientes ya registradas permanecen consultables aunque su programación
futura se cancele. Registros futuros preexistentes, dependientes sin rutina y cortes
incompatibles necesitan una representación explícita o bloqueo; nunca una eliminación
parcial. La transacción debe contener todas las entidades afectadas o no escribir nada.
Después se verifica el calendario restante y la conservación por clave/hash del historial.

## 14. Preparación y decisiones pendientes

| Requisito | Estado |
| --- | --- |
| Modelo matemático UTC, resultados y certificados | Aprobado en Node/Chromium para el dominio y presupuestos descritos |
| Worker/cancelación, sin historial/fotos | Implementado y verificado; latencia física móvil/otros motores pendiente |
| Verificador B.2 reemplazado por el nuevo | No reemplazado; B.3a.1 corrige catálogo B.2 y su cobertura semanal local |
| Recurrencias indefinidas en zona local arbitraria | No implementado; bloqueadas conservadoramente |
| Dominio experimental y política de timezone pública | Decisión pendiente antes de activación |
| saveEvent/shiftEvent/deleteEvent por alcance | No implementado; B.3b/c requieren autorización nueva |
| Registros capturados en fecha/corte futuro | Política y pruebas de integración pendientes |
| Adopción incremental B.4 / paridad React completa | Pendiente |
| Privacidad/borrado físico, otros motores y teléfonos | Pendiente de aprobación/pruebas |
| Activación 4C / BUG-05 público | NO preparados / fallo público permanece |

Recomendación: revisar este motor y las restricciones temporales antes de autorizar
B.3b. Puede servir de base experimental para componentes demostrables UTC o rangos
locales finitos; no justifica desbloquear todos los calendarios locales indefinidos.
B.3a.1 ya corrige la enumeración base y las garantías semanales locales de B.2.
El dominio del verificador general sigue igual: fuera de UTC requiere through explícito.
Acordar cortes/capturas y el dominio de las operaciones sigue siendo obligatorio;
no se empieza B.3b automáticamente.

Checkpoints conservados: investigación e8b0659 con corrección del arnés 87786aa;
motor/contrato y 36 pruebas Node en 38341be; cierre de presupuestos, navegador,
mediciones y documentación en el commit final de esta rama. No hay despliegue.


### Consumidor experimental B.3b.1

La creación de eventos utiliza el motor B.3a para efectos finitos/UTC y la cobertura
semanal local B.2/B.3a.1 para componentes que cumplen sus supuestos. No amplía el
verificador general ni sustituye la ruta de rutinas B.2. Sin edición, cortes,
movimientos ni activación pública. Véase [SCOPED_EVENTS_CREATE](HISTORY_V2_SCOPED_EVENTS_CREATE.md)
para límites, transacciones, identidades y pruebas nuevas.
