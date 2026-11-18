# BUG-05 · 4B.3b B.2: rutinas incrementales experimentales

Base origin/main **0e9e25c**, PR #13. Rama feature/history-scoped-routines-v2.
Planner público sigue en v1; no se activa 4C ni se migran usuarios.

## Arquitectura e invariantes

storage-routines selecciona planificación y usa los métodos reales extraídos de
Planner (saveRoutine/deleteRoutine/routineIssue/cancelFutureDependencies).
prepareRoutine prepara un delta de rutinas/eventos sobre un catálogo verificado;
no construye Data2 con todos sus logs ni convierte fotografías a dataURL.
El orden de eventos del encabezado se conserva: eventFrame elige el primer límite
aplicable. Se leen/verifican todos los registros de planificación y las revisiones
referenciadas por eventos actuales; es un alcance conservador, no coste constante.

Las tablas de ejecuciones, evidencias y recipeRevisions no se modifican al editar o
eliminar la plantilla. Capturas, marcas, notas, alternativas resueltas y denominadores
mantienen hashes por clave. Los step IDs identifican pasos editables de la plantilla;
la misma identidad puede cambiar de texto en una versión actual sin cambiar el paso
capturado en una revisión anterior. Una nueva ejecución reserva una revisión nueva
cuando su definición difiere; el motor rechaza reutilizar un revisionId para otros
contenidos y comparte revisiones exactamente iguales, como antes.

El catálogo por rutina indexa revisiones y descriptores de capturas al abrir la ventana.
Se comparte en operaciones de planificación que no modifican capturas; se reconstruye
cuando cambian ejecuciones. readRoutine pagina capturas (50 por defecto, máximo 1000),
comprueba filas consultadas y devuelve relaciones y versiones sin hidratar blobs.
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
Los resultados ampliados de eliminación/fallos/capacidad se documentan al cerrar.
