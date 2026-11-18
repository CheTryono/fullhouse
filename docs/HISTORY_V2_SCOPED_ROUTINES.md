# BUG-05 · 4B.3b B.2: rutinas incrementales experimentales

Base origin/main **0e9e25c**, PR #13. Rama feature/history-scoped-routines-v2.
Planner público sigue en v1; no se activa 4C ni se migran usuarios.

## Arquitectura e invariantes

storage-routines selecciona planificación y usa los métodos reales extraídos de
Planner (saveRoutine/deleteRoutine/routineIssue/cancelFutureDependencies).
prepareRoutine prepara un delta de rutinas/eventos sobre un catálogo verificado;
no construye Data2 con todos sus logs ni convierte fotografías a dataURL.
El orden de eventos del encabezado se conserva: eventFrame elige el primer límite
aplicable. Se identifica el componente conectado de planificación y se verifican sus filas,
las metas referenciadas y las revisiones de sus eventos. El resto se conserva en el
catálogo. Construir el componente y la raíz sigue recorriendo descriptores; no es
coste constante. El índice de capturas evita reconstruir años de registros.

Las tablas de ejecuciones, evidencias y recipeRevisions no se modifican al editar o
eliminar la plantilla. Capturas, marcas, notas, alternativas resueltas y denominadores
mantienen hashes por clave. Los step IDs identifican pasos editables de la plantilla;
la misma identidad puede cambiar de texto en una versión actual sin cambiar el paso
capturado en una revisión anterior. Una nueva ejecución reserva una revisión nueva
cuando su definición difiere; el motor rechaza reutilizar un revisionId para otros
contenidos y comparte revisiones exactamente iguales, como antes.

El catálogo por rutina indexa revisiones y descriptores de capturas al abrir la ventana.
Se comparte en operaciones de planificación que no modifican capturas; se reconstruye
cuando cambian ejecuciones. readRoutine pagina capturas y definiciones consultadas (50 por defecto, máximo 1000),
comprueba filas consultadas y devuelve relaciones y versiones sin hidratar blobs.
El catálogo de IDs/hash identifica todas las revisiones; revisionAfter permite
consultar otras páginas de definiciones. No se copian diarios de progreso de metas
al ejecutar el método real: sus filas solo se verifican para proteger las referencias.
No asocia registros heredados desconocidos por nombres ni los convierte en verificables.
Un ID nuevo no puede reutilizar una identidad ya presente en versiones o relaciones.

commitRoutine reutiliza la misma TX de deltas, autoridad persistente, CAS, recibo y
verificación posterior. Se modifican conjuntamente plantilla, minutos de eventos y
cancelaciones derivadas. routines-session reutiliza la semántica B.1 de confirmado,
candidato y borradores. Reintentar conserva ID; recuperar vuelve a preparar el comando
y comprueba su raíz íntegra; un candidato obsoleto no se aplica automáticamente.

## Demostración de calendario y límites

La planificación vigente se valida desde context.today, no desde una fecha elegida
arbitrariamente en la vista. Las capturas de fechas anteriores permanecen congeladas.
Las consultas estimadas de legado no se convierten en prueba de una estructura pasada.

Se construye el componente conectado de rutinas/eventos por routineId, afterRoutineId
y beforeRoutineId. Incluye todos los eventos candidatos para cada límite, sus series,
excepciones y cadenas. Se usan eventFrame, occurs, activeSteps y routineBalance reales.
No se emplea schedulePreview (máximo ocho filas) como certificado del calendario.

- Inicios, finales, fechas específicas y excepciones delimitan segmentos.
- none/dates/daily/weekly/weekdays/custom son semanales o puntuales entre límites;
  siete fechas consecutivas por segmento cubren todas las clases de día posibles.
- monthly/yearly/every con final se comprueban día a día durante su actividad.
- Una recurrencia indefinida monthly/yearly/every en el componente se bloquea: B.2
  no demuestra su periodicidad completa. No se usa un horizonte arbitrario.
- Se enumeran combinaciones manuales de alternativas, incluso anidadas y en los
  límites dependientes; reglas por día son semanales. Se bloquean IDs ambiguos.
- Presupuestos: 256 combinaciones, 20.000 fechas y 100.000 evaluaciones de eventos.
  Si se superan, se rechaza toda la operación; no se acepta un resultado parcial.

Cada intervalo debe existir y caber entre 00:00 y 24:00 (24:00 exacto válido).
Los presupuestos fijos/flexibles deben encajar en todas las elecciones aplicables.
No se rechazan solapamientos que Planner permite. Una configuración ya inválida en
el componente también puede bloquear una edición de nombre; no se repara en silencio.

## Eliminación y diferencias respecto a v1

deleteRoutine exige confirm:true, como sustituto del modal propio en el puerto aislado.
Desvincula actividades, conserva títulos y ejecuta cancelFutureDependencies real:
cancela futuros bloques y trunca segmentos anteriores hasta el día previo, transitivamente.
Retira recipeRevisionId de eventos desvinculados cuando ya no coincide su rutina,
como la sesión experimental anterior. Las revisiones y capturas originales permanecen.

Si quedan bloques activos sin límites (incluidos between sin rutina que el método
actual no cancelaría), la eliminación se rechaza. No se confirma una eliminación parcial.
La desaparición programada por cancelación explícita es distinta de un intervalo inválido.
No se implementa edición/segmentación general de eventos ni adopción incremental.

Se conserva limpieza de textos, normalización de árboles, días/alternativas, mínimos,
metas y evidencias requeridas de Planner. Diferencias de protección: rechazo de
calendarios no demostrables, colisiones de IDs, referencias nuevas a metas inexistentes
y árboles ambiguos. Referencias antiguas huérfanas sin cambio no se inventan ni reasignan.
No se cambian el esquema lógico, formatos portables ni la política de borrado físico.

## Checkpoint de creación/edición

Antes de ampliar pruebas de eliminación: ocho contratos Node aprobados; tipos correctos;
Chromium 1280/390, nueve operaciones equivalentes por viewport. La ejecución completada
con cinco pasos conserva cinco unidades tras añadir tres a la plantilla, incluidas
notas, fotografía y definición original. El corpus pequeño incluye legado y adopción.
Los resultados ampliados de eliminación/fallos/capacidad figuran a continuación.


## Verificación y escenarios de eliminación/fallos

Después del checkpoint se amplió a eliminación, cancelación transitoria y recuperación.
El caso pequeño contiene cinco pasos originales, una alternativa ya resuelta, notas
por paso, foto, un registro legado y un tramo adoptado. Se renombran propiedades,
añaden tres pasos, eliminan pasos marcados, reorganizan hijos y cambian alternativas,
días y duración fija/flexible. Se compara la raíz con la sesión experimental anterior.

Las diferencias intencionales no se comparan como paridad exacta con v1: los registros
usan sus revisiones, las nuevas versiones no sobrescriben anteriores y los calendarios
inseguros se rechazan antes de escribir. No se corrigen ni estiman hechos perdidos del
legado. Una nueva captura después de editar rechaza el revisionId antiguo si cambió
la definición y admite uno nuevo; la captura original sigue usando el anterior.

La suite de fallos prueba cuota real en un perfil persistente desechable, reintento
con el mismo ID, lectura posterior inyectada como fallida y cierre durante una TX
que modifica plantilla y dos eventos. Al reabrir se acepta el estado anterior o el
nuevo íntegro; nunca una mezcla. Dos pestañas reales parten de la misma cabeza: solo
la primera confirma y la otra conserva/rechaza su candidato obsoleto.

Se prueba una dependencia de segundo nivel que queda inválida aunque el primer bloque
flexible todavía encaje. La cancelación real tras eliminar el ancla conserva los
segmentos pasados y trunca los dependientes futuros. Si un bloque between sin rutina
quedara activo sin sus límites, se rechaza toda la eliminación. Se verifica corrupción
de una fila de evento relacionada y cambio de fuente v1, con bloqueo persistente.

Casos lejanos: excepción en 2045, fecha específica en 2050 y sustitución de una serie
límite en 2045. No se limitan a las primeras ocho ocurrencias. Las restricciones de
recurrencia y presupuesto descritas arriba siguen siendo bloqueos explícitos.

## Preparación para B.3 y límites antes de 4C

B.2 permite creación/edición y eliminación dentro de los alcances demostrables, con
lectura, reintento y recuperación. B.3 deberá ampliar a edición/segmentación general
de eventos y reglas de calendario no demostradas aquí. No se inicia automáticamente.
La conservación de archivos originales y las carreras v1/IndexedDB mantienen las
limitaciones de A: sondas no ofrecen exclusión perfecta ni detectan siempre ABA.
No se elige una rama por fecha; corrupción/conflicto exige recuperación explícita.

Pendientes para 4C: controles React reales y sus modales, navegación/borradores,
reconciliación pública, adopción incremental B.4, privacidad/borrado físico aprobado,
otros motores y dispositivos, memoria y percentiles con perfiles frescos. Los drafts
llegan como snapshots JSON; los estados React con undefined necesitan un adaptador
validado antes de conectarse. No se añade un selector público ni se cambia Planner.

El motor no conserva memoria tras cierre forzado antes de persistir/exportar. Los
paquetes pendientes son candidatos completos con comando/borradores, no acuses. Un
respaldo .fharchive incluye hechos y bytes, no toda la cadena operacional de recibos;
restaurar crea autoridad nueva explícita en otro destino. No es rollback transparente
a versiones v1. No se elimina automáticamente la fuente anterior ni sus fotografías.


## Mediciones completas

Chromium 156.0.8078.79, Node v24.22.1, mismo equipo de nube y datos para ambas rutas.
Una muestra por operación, escritorio; no demuestra percentiles ni latencias móviles.
5.000 ejecuciones completadas, 501 revisiones y 65 blobs únicos con 42.175.847 bytes.
[Resultados completos](HISTORY_V2_SCOPED_ROUTINES_MEASUREMENTS.json).

La sesión experimental anterior rechaza el corpus con «Documento demasiado complejo»;
no se eleva su límite ni se cuenta el rechazo como escritura exitosa. Se mide aparte
un comparador físico completo usando los métodos reales sobre planificación y el
pipeline prepareDocument/commit, conservando los mismos logs/revisiones. En el corpus
pequeño sí se usa la sesión anterior completa como referencia de cada operación.

| Acción | Preparación completa / incremental | Relaciones | Horarios | Linaje previo | TX | Confirmación | Lectura |
| --- | --- | --- | --- | --- | --- | --- | --- |
| new | 6833.4 / 18.4 | 3.8 | 0.9 | 5.7 | 7.1 | 3.5 | 3.0 |
| rename | 6725.3 / 16.5 | 5.1 | 0.7 | 3.3 | 7.0 | 4.4 | 14.8 |
| add | 7099.4 / 17.0 | 4.1 | 0.6 | 5.1 | 7.5 | 3.9 | 16.0 |
| reorder | 6643.0 / 15.3 | 3.5 | 0.7 | 3.2 | 7.3 | 3.3 | 11.5 |
| remove | 6284.0 / 16.6 | 3.9 | 0.9 | 3.4 | 6.2 | 4.4 | 13.6 |
| fixed | 7137.5 / 27.6 | 8.2 | 1.2 | 13.3 | 11.4 | 6.7 | 15.6 |
| delete | 6212.6 / 32.2 | 21.0 | 0.1 | 30.7 | 28.4 | 3.6 | 12.9 |

Tiempos en ms. Relaciones mide lectura/comparación/hash de filas; construir el
componente forma parte de preparación. Horarios incluye la demostración y validación
extra de la rutina. TX incluye espera de IDB; confirmación incluye sonda posterior
y creación del nuevo catálogo de trabajo. No se suman dos veces sus subintervalos.
El commit completo adicional tarda 2509.8–2957.4 ms, incluida lectura y validación íntegra.

Apertura anterior 4569.8 ms, apertura de ventana nueva 1272.2 ms;
el intento de escritura anterior rechazado tarda 104.5 ms. Exportación 1174.0 ms,
importación 7218.3 ms, restauración confirmada 2896.0 ms.
Las siete operaciones tienen raíces iguales al comparador. Al finalizar coinciden
todos los hashes de ejecuciones, revisiones y evidencias por clave, no por posición
ni solo cantidad. Se restaura en destino nuevo y se comprueban bytes de fotos.

Heap informado al final: 300.9 MB, con corpus y ambas rutas retenidas en la página.
No es pico ni consumo aislado de la ruta nueva y **no demuestra reducción de memoria**.
Falta medir cada modalidad en un proceso fresco y dispositivos físicos. Los índices
se comparten en cambios de planificación, pero raíz y catálogos conservan trabajo O(N).


## Cierre de verificación y recuperación del trabajo

Se recuperó íntegra la rama feature/history-scoped-routines-v2, basada en 0e9e25c,
con el checkpoint e935aa8 y los cambios posteriores sin commit. Se conservaron como
checkpoint adicional d5789c6 antes de editar documentación. No había procesos de
pruebas activos ni resultados grandes truncados que hubiera que reconstruir.

Los módulos actuales se habían guardado antes de las comprobaciones y mediciones
completas recuperadas. No se cambió lógica de implementación al retomar, por lo que
no se repitieron las suites completas ni el benchmark. La última modificación del
ensayo de fallos (retirada de eventos dependientes futuros) también tenía un registro
JSON completo posterior: pasó y queda añadido al archivo de mediciones. El ensayo
anterior de segmentos pasados y la prueba Node conservan la cobertura de truncación.

| Comando / suite | Resultado completo recuperado, válido para el código entregado |
| --- | --- |
| npm run check | Correcto: TypeScript, sintaxis y app.js sincronizado; sin escribirlos |
| npm run check:history-contract | Correcto, contratos de rutinas y sesión incluidos |
| npm run test:regression | 164 aprobadas |
| npm run test:history-contract | 175 aprobadas, 6 TODO, cero fallos |
| npm test | 339 aprobadas, 6 TODO y único fallo público conocido BUG-05; salida 1 |
| history-scoped-routines | 9 operaciones equivalentes por viewport 1280/390; invariantes de cinco pasos, alternativa, legado/adopción, eliminación, reintento y restauración aprobados |
| history-scoped-routines-faults | Cuota real, lectura posterior fallida, cierre multi-entidad, dos pestañas, fuente v1, corrupción y dependencias aprobados |
| history-scoped-routines-performance | 7 operaciones con raíces iguales; 5.000 ejecuciones, 501 revisiones y 42,2 MB de fotos; hashes por clave y restauración aprobados |
| history-lineage | 101 grupos aprobados |
| history-storage | 65 casos aprobados; cuota/crash/denegación y nueve formatos históricos incluidos |
| history-scoped-goals y sus fallos | Paridad B.1 en 1280/390, recuperación, cuota real y cierre aprobados |
| history-legacy | 186 casos aprobados; cinco paletas y ambos viewports |
| history-integration | 28 casos aprobados |
| pending-save | 4 combinaciones públicas sintéticas aprobadas |
| day-shifts | 2 viewports públicos sintéticos aprobados |

Los doce contratos Node nuevos cubren normalización, metas/evidencia requerida,
actualización de eventos, 24:00, insuficiencia fija, combinaciones simultáneas,
recurrencias finitas/bloqueadas, confirmación, cancelación, dependencias encadenadas,
excepciones/series lejanas y rechazo de eliminación parcial. Los seis TODO de fases
posteriores permanecen sin convertirlos artificialmente en aprobados. La reproducción
pública BUG-05 sigue fallando porque Planner permanece en v1; no se modifica su test.

Firefox, WebKit/Safari y teléfonos físicos no fueron probados. Un viewport de 390 px
representa Chromium de escritorio, no Android/iPhone. Las pruebas públicas existentes
usan datos sintéticos y orígenes/perfiles desechables, sin acceder al origen publicado.
No se identificaron errores JavaScript inesperados en los flujos verificados.

### Matriz de salida

| Requisito | Estado |
| --- | --- |
| Crear/editar/eliminar rutinas y efectos relacionados en el alcance admitido | Implementado y verificado en laboratorio |
| Inmutabilidad de revisiones, capturas, notas/fotos y progreso histórico | Verificada por hashes y lectura, incluso tras eliminación |
| Calendarios finitos y clases semanales por segmento | Verificados en los escenarios descritos; sin validación parcial silenciosa |
| Recurrencias indefinidas monthly/yearly/every y exceso de presupuesto | Bloqueados explícitamente; no admitidos por esta entrega |
| TX, acuses, reintentos, recuperación, obsolescencia y fuentes | Verificados; límites residuales v1/IDB del hito A conservados |
| Rendimiento del corpus de referencia | Medido; muestra única, catálogo O(N), memoria aislada pendiente |
| React público, B.3, B.4 y reconciliación de usuarios | No implementados aquí |
| Privacidad/borrado físico y activación 4C | Pendientes de decisión/autorización |

B.2 puede entregarse para revisión con estos límites. Hay base para planificar B.3,
que deberá tratar segmentación general y ampliar calendarios no demostrados; no se
inicia en esta rama. La matriz no autoriza 4C. El código público, carga/guardado,
app.tsx/app.js y workflow no tienen diferencias con la base 0e9e25c.


## Archivos de B.2

- Motor/puertos nuevos: history/storage-routines.cjs y su contrato .d.cts;
  history/routines-session.cjs y su contrato .d.cts.
- Integración experimental: history/storage-incremental.cjs/.d.cts,
  scripts/history-browser.cjs y contracts/tsconfig.json.
- Pruebas: tests/history-contract.scoped-routines.test.cjs,
  tests/contracts/history-scoped-routines.types.ts y las tres suites Chromium
  history-scoped-routines, history-scoped-routines-faults y
  history-scoped-routines-performance; sus README describen los comandos.
- Documentación: este contrato, HISTORY_V2_SCOPED_ROUTINES_MEASUREMENTS.json,
  ROADMAP.md, CAMBIOS.md y actualizaciones de LINEAGE_SCOPED, SCOPED_GOALS y READINESS.

No se modifican app.tsx, app.js, la carga/guardado públicos, el workflow de Pages
ni tests/known-bugs.test.cjs. No se publicaron laboratorios ni se activó almacenamiento
nuevo. El checkpoint de recuperación conserva también las pruebas de eliminación
antes de terminar este cierre documental.
