import type { DocumentV2, RecipeRevision, ExecutionCapture, LegacyView } from '../../contracts/history-v2';
declare const document: DocumentV2;
declare const recipe: RecipeRevision;
declare const capture: ExecutionCapture;
const supported: 2 = document.version;
// @ts-expect-error La definición histórica no es una plantilla editable.
recipe.definition.title = 'Changed';
// @ts-expect-error Tampoco lo son sus pasos anidados.
recipe.definition.steps[0].min = 99;
// @ts-expect-error La identidad no cambia al continuar otro día.
capture.executionId = 'replacement';
// @ts-expect-error El formato nuevo no se anuncia como version 1.
const oldVersion: 1 = document.version;
// @ts-expect-error Una estimación no puede declararse verificable.
const estimate: LegacyView = { kind: 'estimate', confidence: 'recorded', label: 'Estimate', source: 'current-template', generatedAt: '2030-01-01T00:00:00Z' };
void supported; void oldVersion; void estimate;
