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
entre rutinas. Se verifican fecha inicial y todas las excepciones explícitas: no se
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
