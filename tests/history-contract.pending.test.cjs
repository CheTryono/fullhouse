const test = require('node:test');
// Son requisitos de integración, NO pruebas aprobadas ni sustitutos de BUG-05.
for (const scenario of [
  'P4: confirmar captura y progreso juntos mediante el guardado real de BUG-01',
  'P4: importar v1/v2, exportar y recuperar conservan todas las evidencias',
  'P4: migración con cuota llena, lectura fallida o interrupción conserva fuente íntegra',
  'P4: pestaña v1 concurrente no sobrescribe v2; conflicto requiere recuperación explícita',
  'P4: ambigüedad entre claves, rollback y cambios pendientes no descartan datos',
]) test.todo(scenario);
