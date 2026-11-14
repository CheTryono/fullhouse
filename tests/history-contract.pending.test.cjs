const test = require('node:test');
// Son requisitos de integración, NO pruebas aprobadas ni sustitutos de BUG-05.
for (const scenario of [
  'P2: capturar una sola vez al primer paso, completado, elección, nota o foto persistidos',
  'P2: no capturar al abrir la vista ni interpretar capturedAt como inicio físico',
  'P2: reintento de escritura fallida confirma captura y progreso juntos sin pérdida',
  'P2: alternativas por día y manuales, subpasos y reparto fijo/flexible se congelan',
  'P2: corrección y reapertura explícitas conservan marcas y auditoría',
  'P2: continuidad entre días, recurrencia y excepciones preservan executionId/seriesId',
  'P3: historial no cambia al editar, reprogramar, cancelar o eliminar plantillas',
  'P3: progreso usa denominadores congelados y distingue legado estimado',
  'P3: metas eliminadas y revisiones no cambian etiquetas históricas',
  'P4: importar v1/v2, exportar y recuperar conservan todas las evidencias',
  'P4: migración con cuota llena, lectura fallida o interrupción conserva fuente íntegra',
  'P4: pestaña v1 concurrente no sobrescribe v2; conflicto requiere recuperación explícita',
  'P4: ambigüedad entre claves, rollback y cambios pendientes no descartan datos',
]) test.todo(scenario);
