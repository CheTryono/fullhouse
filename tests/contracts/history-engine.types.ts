import { createEngine, Command } from '../../history/engine.cjs';
import type { DocumentV2 } from '../../contracts/history-v2';
declare const document: DocumentV2;
const engine = createEngine((_value: unknown) => true);
const command: Command = { executionId: 'synthetic', at: '2030-01-07T12:00:00Z', action: { type: 'complete', source: 'manual' } };
const operation = engine.prepare(document, command);
engine.accept(document, operation);
// @ts-expect-error No se permite inventar una operación confirmable.
engine.accept(document, { before: document, after: document });
// @ts-expect-error El candidato devuelto es inmutable.
operation.after.logs.changed = { completed: true, checkedSteps: [] };
// @ts-expect-error El origen no puede deducirse de un tiempo previsto.
const invalid: Command = { executionId: 'x', at: '', action: { type: 'complete', source: 'planned' } };
void invalid;
