# BUG-05 · 4B.3b B.1: metas, progreso, hitos y revisiones por alcance

Base `origin/main` cc1d901 (PR #12). Rama `feature/history-scoped-goals-v2`.
Solo módulos experimentales, puertos inyectados y bases `fullhouse-lab-*`.
No activa 4C, IndexedDB público ni migración. Planner sigue en v1.

## Arquitectura y contrato

`storage-goals.cjs` selecciona entidades y prepara una proyección mínima sin logs,
revisiones de rutinas ni fotografías. Invoca los métodos reales extraídos por AST de
Planner mediante un puerto `plannerActions`; no copia sus algoritmos en otra implementación.
El extractor admite un instante explícito para Date, conservando el reloj normal
cuando no se proporciona. El día local también se proporciona explícitamente.

`incremental.preparePlanning(token,method,payload,context)` requiere wrapper con
linaje y una capacidad emitida después de verificación íntegra. `context` incluye
operationId, today, at, ids y estado acotado del formulario. No admite estado React,
logs ni datos arbitrarios en contexto. Se valida la proyección con el modelo existente;
se calculan hashes nuevos solo de filas cambiadas y la raíz sobre el catálogo completo.
No se afirma coste constante: raíz, catálogos y nuevos tokens siguen siendo O(N).

`readGoal` consulta meta, antecedentes, hijos, dependientes, actividades vinculadas y
rutinas que la referencian en pasos/alternativas; comprueba esas filas contra el
catálogo verificado y sus hashes. No consulta ejecuciones históricas. `readDayReview`
consulta una fecha. Las etiquetas capturadas de metas eliminadas siguen disponibles
mediante el lector histórico existente; no se inventa una meta actual.

`commitPlanning` reutiliza la transacción de deltas: CAS de cabeza/autoridad, recibo,
filas relacionadas y ausencia de IDs nuevos; datos, autoridad y recibo se confirman
juntos. Se añade eliminación acotada del evento review-* con lectura posterior de
su ausencia. No permite borrar metas, registros, rutinas, fotos o revisiones históricas.
La barrera y el formato de linaje no cambian: los escritores A entienden estos
estados, respetan la misma autoridad y quedan obsoletos al cambiar la cabeza.

`goals-session.cjs` separa token confirmado, candidato y borradores. Un fallo conserva
el candidato y su ID; retry no vuelve a ejecutar el formulario. Exportación binaria
incluye candidato completo, comando y borradores como pendiente, nunca como guardado.
Resume valida el candidato completo y vuelve a ejecutar el comando sobre la base
esperada, o reconoce un acuse ya confirmado. Una base obsoleta exige reconciliación.
Cancelar quita el candidato de memoria; no revierte una escritura que hubiera
terminado sin acuse. Los borradores no son durables hasta exportación/confirmación.

## Operaciones e invariantes

- saveGoal crea/edita una meta y su review-* en la misma TX. Conserva historial
  de progreso, orden de IDs del documento y excepciones existentes. Planner retira
  el evento de revisión si se elimina el plan review de la meta; se conserva todo log.
- saveProgress conserva la semántica de coma decimal, estado cualitativo y notas
  recortadas; agrega historial una sola vez gracias al recibo de la operación.
- toggleMilestone marca/desmarca, recalcula current/target y agrega «Hito actualizado».
- saveDayReview usa **today**, no selectedDate. Reemplaza nota/closedAt de esa fecha,
  igual que v1. El contrato actual no contiene diario de versiones de revisión diaria;
  no se promete conservar en el documento activo el texto reemplazado ni se añade
  silenciosamente un esquema de auditoría. Las notas previas del historial de progreso
  sí permanecen en su lista original. Auditoría adicional requeriría decisión de producto.

La selección incluye la meta afectada, ancestros/referencias que se consultan, evento
de revisión propio y/o revisión diaria. Todas se comparan en la TX. No se reasignan
capturas, marcas, notas ni fotos al editar plantillas o metas. La adopción de legado
no es incremental en este hito; solo se conservan sus enlaces y hechos existentes.

## Diferencias de protección explícitas

Se rechazan: ID nuevo que ya existe, edición de meta/hito desaparecido, enlaces nuevos
inexistentes o ciclos nuevos y colisión review-* con una actividad de otro tipo/meta.
No se corrigen referencias heredadas huérfanas por similitud ni se exige resucitar
metas eliminadas. Las relaciones antiguas sin cambios pueden seguir existiendo.

Una revisión generada debe caber en el día (24:00 válido), incluidas sus excepciones.
Al carecer de rutina/anclas, su duración es siempre 30 minutos y no altera dependencias
entre rutinas. Se verifican fecha inicial y todas las excepciones aplicables a la regla actual: no se
acepta una recurrencia no comprobada por tomar solo nueve fechas como prueba universal.
No se prohíben solapamientos que v1 permite. Rutinas/eventos arbitrarios quedan fuera.

## Estado del checkpoint básico

Antes de ampliar escrituras se ejecutó Chromium de linaje: 101 grupos aprobados.
Ensayo adicional: 8.389.508 bytes UTF-16 de fuentes y 501 recibos; autoridad continua,
reapertura correcta y conflicto persistente al cambiar el alias. Sin problemas de
integridad observados. Hay coste de parseo/huellas y cadena completa; no existe
exclusión perfecta v1/IDB ni detección garantizada de ABA entre sondas.

Puertos básicos: siete pruebas Node aprobadas, tipos correctos; comparación Chromium
con sesión anterior: 12 operaciones y tres fallos/reintentos por viewport 1280/390,
recuperación, obsolescencia, corrupción relacionada y legado/adopción preservados.
La verificación ampliada y sus mediciones se documentarán al cerrar la entrega.

## Integridad, lecturas y límites de validación incremental

La apertura sigue verificando todo el plan, referencias, bytes de fotos, originales,
autoridad y cadena. Después cada operación compara las filas de su alcance con ese
catálogo, revalida su proyección, calcula hashes de cambios y comprueba la persistencia.
No detecta toda corrupción ajena al alcance en cada escritura: se vuelve a verificar
íntegramente al abrir/importar/exportar o efectuar una auditoría completa. Un cambio
concurrente participante siempre modifica la cabeza y se rechaza por CAS, aunque
fuera sobre otra meta. No hay fusión optimista de modificaciones independientes.

El índice de IDs de metas presentes en capturas se construye al crear la ventana
verificada. Se comparte al confirmar cambios B.1 porque estos no alteran capturas;
se vuelve a construir al confirmar ejecuciones. Impide reutilizar para una meta nueva
un ID histórico conocido, sin recorrer capturas en cada preparación de meta. No
reconstruye IDs perdidos de legado sin contexto ni prueba que un ID nunca existió.
Debe seguir usándose un generador/reserva de IDs únicos en el adaptador futuro.

La TX utiliza los stores compartidos del escritor incremental para serializar
operaciones compatibles, pero solo lee/escribe las filas del alcance; las fotos
anteriores no se hidratan ni se escriben. El catálogo completo y la raíz mantienen
coste lineal de descriptores. Leer una meta o revisión no revalida toda la cadena;
la autoridad y fuentes vuelven a comprobarse al confirmar, abrir y auditar.

La vigilancia de v1 conserva los límites del hito A: no hay TX conjunta con
localStorage; quedan carreras después de la última sonda y ABA entre sondas.
Una divergencia detiene escrituras y conserva ramas, sin escoger fechas recientes.
Ni hashes ni barreras de versión autentican contra código malicioso del mismo origen.

## Recuperación y compatibilidad funcional

- Las doce operaciones de referencia pequeña incluyen meta/submeta, revisión semanal,
  progreso numérico/cualitativo, hitos, revisión diaria, retirada del plan de revisión
  y cambio de meta después de completar una actividad. Se compara la raíz con la
  sesión anterior, no solo el texto visible ni el número de filas.
- El corpus pequeño contiene una actividad completada con plantilla modificada,
  revisión de meta registrada, varias actividades vinculadas, legado con foto y
  adopción explícita. Sus logs y revisiones históricas deben permanecer idénticos.
- El caso de meta eliminada parte de un documento sin esa meta: consulta sin
  resucitarla, rechazo de progreso sobre ID desaparecido, rechazo de reutilización
  de ID capturado y creación de otra meta conservando registros. **No introduce
  deleteGoal** ni una nueva política de eliminación.
- No se añade auditoría a dayReviews: su reemplazo conserva la semántica actual.
  Crear un historial de versiones de estas notas exige ampliar contrato y decidir
  retención antes de implementarlo. Las entradas de goal.history sí se conservan.
- Los paquetes pendientes pueden ser grandes porque contienen un candidato íntegro
  portable. Se mantienen límites de recuperación y archivo; no se degrada la salida
  a una proyección sin fotos presentándola como respaldo completo.
- `.fharchive` conserva hechos y bytes, no la cadena operacional de recibos. Restaurar
  crea autoridad nueva explícita en destino vacío; no es rollback transparente a v1.
- No se implementan controles React ni beforeunload públicos nuevos. El consumidor
  futuro debe conectar estado pendiente/borradores con avisos de navegación. El motor
  no promete conservar memoria tras cierre forzado antes de confirmación/exportación.

## Comparación con la sesión anterior

La sesión anterior se intenta ejecutar sobre el corpus grande real. Su copia global
excede el límite defensivo de complejidad; no se modifica ese límite. Ese rechazo
no debe representarse como una operación exitosa lenta ni como un ratio de mejora.

Se mide por separado un comparador de **validación física completa**: métodos reales
sobre planificación, conservación de los logs/revisiones anteriores y el pipeline
completo prepareDocument/commit. Valida igualdad de raíz con la ruta nueva en cada
operación, pero no se hace pasar por una sesión antigua que haya aceptado el corpus.
En el conjunto pequeño sí se compara contra la sesión completa anterior sin sustitutos.

Las mediciones incluyen preparación, TX (incluida espera de IDB), comprobación de
linaje antes/después, confirmación y lectura. Confirmación incluye la sonda posterior;
no se suman dos veces los mismos intervalos. El comparador completo informa su
preparación y commit con lectura íntegra, sin inventar una separación de etapas que
su API no expone. Se solicitan GC y memoria en páginas nuevas del mismo contexto y
origen, con raíces iguales; JS heap no representa memoria total del navegador.
Una muestra de cada operación no acredita percentiles, teléfonos físicos ni latencia
universal; entorno de nube compartido, mismo navegador y corpus para ambos caminos.

## Límites y plan para B.2, B.3 y B.4

B.1 cubre solamente saveGoal, saveProgress, toggleMilestone y saveDayReview. Sus
puertos rechazan saveRoutine/deleteRoutine, saveEvent/shiftEvent/deleteEvent y adopción.
Los flujos completos experimentales anteriores siguen disponibles con sus límites.
No hay nuevos servicios, sincronización, borrado físico ni políticas de retención.

1. **B.2: rutinas.** Edición/eliminación por alcance, catálogo de dependencias y
   versiones históricas inmutables; no reescribir ejecuciones ni referencias de fotos.
2. **B.3: programación.** Eventos, series, excepciones, desplazamientos y dependencias
   encadenadas; conservar BUG-04. Rechazar alcances temporales no verificables en vez
   de truncar la comprobación de una recurrencia arbitraria.
3. **B.4: adopción por alcance.** Validar conjuntamente fuente legada, definición
   elegida y tramo nuevo; preservar propietario de fotos, diario, progreso vacío y CAS.
   Mantener ruta completa hasta demostrar equivalencia y recuperación del conjunto.

Antes de 4C siguen pendientes paridad React completa, reconciliación pública, UX de
pendientes, estrés adicional/cuotas de conflicto, navegadores/dispositivos, privacidad
aprobada y autorización explícita de integración y activación. Las restricciones más
estrictas sobre referencias/IDs deben revisarse al diseñar la experiencia pública.
BUG-05 público permanece conocido mientras Planner continúe utilizando v1.


## Mediciones completas observadas

Chromium 156.0.8078.79, Node v24.22.1, nube compartida; un ensayo por operación.
5.000 ejecuciones completadas, 501 versiones históricas de rutina, 65 blobs únicos,
**42.175.847 bytes de fotografías**. Se actualizó coherentemente la cronología de
las capturas sintéticas completadas; el modelo completo valida cada una.
[Resultados originales de los ensayos completos](HISTORY_V2_SCOPED_GOALS_MEASUREMENTS.json).

| Operación | Preparación completa / incremental | TX incremental | Linaje previo | Confirmación | Lectura posterior | Filas cambiadas |
| --- | --- | --- | --- | --- | --- | --- |
| saveGoal | 7283.9 / 18.1 | 6.0 | 4.2 | 3.7 | 2.9 | 1 |
| saveGoal | 7137.6 / 29.2 | 40.5 | 10.5 | 14.9 | 3.0 | 2 |
| saveProgress | 6503.0 / 15.1 | 6.2 | 3.6 | 3.7 | 2.6 | 1 |
| saveGoal | 6688.3 / 13.6 | 14.8 | 3.8 | 5.0 | 6.9 | 1 |
| saveProgress | 6974.8 / 26.1 | 17.3 | 11.0 | 3.6 | 3.0 | 1 |
| saveGoal | 6662.5 / 12.9 | 7.1 | 3.8 | 3.6 | 4.0 | 1 |
| toggleMilestone | 6611.3 / 13.2 | 7.2 | 6.7 | 4.7 | 4.5 | 1 |
| toggleMilestone | 6734.6 / 12.9 | 7.5 | 3.8 | 3.7 | 3.6 | 1 |
| saveDayReview | 6720.4 / 13.1 | 6.2 | 3.9 | 3.9 | 3.6 | 1 |
| saveGoal | 7234.4 / 16.4 | 5.6 | 5.0 | 3.4 | 2.6 | 2 |
| saveGoal | 6480.0 / 12.8 | 7.2 | 3.9 | 3.5 | 3.6 | 1 |

Todos los tiempos en ms. El commit completo con verificación global adicional tarda
2511.2–2916.6 ms; no es una TX pura comparable a la columna de TX incremental.
Apertura sesión anterior: 4540.2 ms; ventana verificada nueva: 1386.1 ms.
La operación de la sesión anterior se rechaza en 97.8 ms con «Documento demasiado complejo».
Ese rechazo no se cuenta como prueba aprobada de escritura ni latencia exitosa.

Se ensayan 50 ediciones adicionales de la revisión de un mismo día;
cada una conserva identidad propia, sin tocar ejecuciones. Las once operaciones del
comparador tienen raíces iguales y cero imágenes nuevas. Al final se verifican todos
los hashes históricos por clave (no por posición de arrays), se exporta/restaura y
se verifican los hashes de las fotografías.

Exportación: 1302.6 ms; importación/verificación: 5879.5 ms;
restauración confirmada en destino nuevo: 3462.4 ms.
La apertura/verificación completa sigue siendo deliberadamente global; una lectura
por alcance no se anuncia como una auditoría íntegra de la base.

Memoria: heap informado tras solicitar GC en páginas nuevas con raíz idéntica: 66.12 MB
(sesión anterior) y 65.99 MB (ventana nueva). **No demuestra una reducción de memoria**:
las páginas comparten proceso/contexto de Chromium y esta API no aísla toda retención
ni contabiliza de forma completa los blobs y el navegador. El heap de la página del
benchmark al final fue 340.7 MB, con ambas rutas y corpus simultáneamente retenidos,
no un pico medido ni coste de la ruta nueva aislada. Falta un perfil de proceso fresco
por modalidad y pruebas en móviles físicos antes de fijar un presupuesto de memoria.

El ensayo inicial de autoridad usa 8.389.508 bytes UTF-16 combinados, 501 recibos,
253,7 ms de apertura, 353,8 ms de reapertura y 99,9 ms de auditoría. En el último
recibo muestreado: preparación local 106,3 ms, TX 23,1 ms, linaje previo 115,7 ms y
confirmación 75,6 ms. Esta preparación modifica un diario de ejecución creciente;
no es una latencia de meta. Las fuentes son copias inyectadas en memoria, no prueba
que ambas quepan en localStorage de todos los navegadores. La revisión completa de
fuentes y recibos conserva coste lineal y puede dominar operaciones pequeñas.

Los primeros intentos del harness no son mediciones finales: se corrigieron cronología
sintética, comparación por posición y contexto de páginas para compartir la misma base.
No se relajaron validadores ni se eliminaron aserciones de igualdad. El archivo adjunto
contiene únicamente resultados de ejecuciones completas y las limitaciones señaladas.
La cuota de Chromium se impone antes de abrir la base en un perfil persistente
borrable; imponerla después no provocó rechazo en un ensayo y no se contó como éxito.
Los límites reales de capacidad y confirmación dependen del navegador, no del override.

## Verificaciones finales y escenarios

| Comando / suite | Resultado |
| --- | --- |
| npm run check | Correcto; TypeScript y app.js coinciden, sin escribirlos |
| npm run check:history-contract | Correcto; contratos nuevos del puerto/sesión incluidos |
| npm run test:regression | 164 aprobadas |
| npm run test:history-contract | 163 aprobadas, 6 TODO, sin fallos |
| npm test | 327 aprobadas, 6 TODO y único fallo público conocido BUG-05; salida 1 |
| history-scoped-goals | 12 operaciones equivalentes por viewport, 3 fallos/reintentos, recuperación, obsolescencia, corrupción, fotos, legado/adopción y dos pestañas reales; 1280/390 px |
| history-scoped-goals-faults | Cuota real, reintento, lectura posterior fallida y cierre durante TX multi-entidad: aprobados |
| history-scoped-goals-performance | Once operaciones con raíces equivalentes, 50 revisiones repetidas, 5.000 capturas/501 versiones/42,2 MB, respaldo y restauración: aprobados |
| history-goals-lineage-stress | 502 recibos: migración + 500 ediciones + meta/review; reapertura y conflicto persistente aprobados |
| history-lineage | 101 grupos aprobados |
| history-storage | 65 casos aprobados, incluidos nueve respaldos históricos, cuota/crash/denegación reales |
| history-legacy | 186 casos aprobados; cinco paletas y ambos viewports |
| history-integration | 28 casos aprobados |
| pending-save | 4 combinaciones públicas sintéticas aprobadas |
| day-shifts | 2 viewports públicos sintéticos aprobados |

El estrés final confirma una meta con revisión después de los 501 recibos iniciales:
preparación 10,8 ms, TX 1,9 ms, verificación previa de linaje 121,9 ms y confirmación
70,2 ms (incluye sonda posterior de 69,0 ms). Apertura 350,4 ms, reapertura 348,9 ms y
auditoría 89,2 ms. Esta muestra separa el coste del alcance local del coste de vigilar
fuentes grandes. No permite prometer una meta guardada en 10,8 ms en todos los casos.
La revisión se confirma junto con la meta y la generación final es 502.

No se han omitido ni convertido en aprobados los seis TODO de fases posteriores.
BUG-05 sigue fallando en producción simulada; su reproducción no cambia. Firefox,
WebKit, Android/iPhone y dispositivos físicos **no se probaron**. Viewport estrecho
es Chromium de escritorio, no un ensayo de sistema operativo móvil.

Los puertos reciben snapshots JSON. Los drafts React con propiedades opcionales
undefined no se conectan directamente: el adaptador público deberá preparar un
snapshot válido sin ejecutar getters ni relajar el codec. Tampoco se comprueban aquí
los efectos visuales de guía/modales/notificaciones de nuevos controles React.
Esta paridad e integración siguen pendientes; las pruebas públicas verifican v1.

## Matriz de salida y recuperación

| Requisito | Estado |
| --- | --- |
| Cuatro operaciones y relaciones B.1, paridad de hechos pequeña | Aprobado en laboratorio |
| Catálogo/raíz, hashes y fotos sin reconstrucción global por edición | Aprobado en escenarios medidos; coste O(N) de descriptores permanece |
| Transacción, confirmación, reintento, candidatos y borradores | Aprobado; no garantiza recuperar memoria no confirmada tras cierre forzado |
| Autoridad persistente y fuentes voluminosas/cadena de cientos | Aprobado en el ensayo descrito; ABA/carreras residuales y cuotas de conflicto pendientes |
| Respaldos y restauración de hechos/bytes | Aprobado; autoridad nueva explícita, no rollback a v1 |
| Memoria aislada/percentiles y capacidad física móvil | Pendiente; no se demostró reducción de heap |
| Contrato de diario para versiones de revisión diaria | No implementado; decisión de producto si se desea ampliar |
| B.2, B.3, B.4 y controles React | No implementados en esta entrega |
| Borrado físico, reconciliación pública y autorización de activación | Bloqueados por decisiones/aprobación del propietario |

No activar 4C con esta matriz. Conservar respaldo completo y diagnóstico/paquete
pendiente según el caso; restaurar solo en destino nuevo y validar antes de adoptar.
No se borra la fuente anterior ni se elige una rama por fecha. El checkpoint básico
es `5e22a8b`; el commit final cierra pruebas y documentación. No quedan procesos de
prueba activos al cerrar la entrega. Producción y workflow permanecen sin cambios.


## Avance B.2 sobre 0e9e25c (experimental)

[Operaciones incrementales de rutinas](HISTORY_V2_SCOPED_ROUTINES.md) añade lectura,
creación/edición, eliminación y recuperación por componente de planificación. Conserva
los formatos/autoridad y filas históricas. Calendarios no demostrables se bloquean,
sin usar ocho ocurrencias como garantía. B.3, B.4 y 4C permanecen pendientes; no hay
activación ni cambios de Planner público.
