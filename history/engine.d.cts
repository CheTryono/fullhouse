import type { DocumentV2, Frozen } from '../contracts/history-v2';
export type Action =
  | { type: 'view' }
  | { type: 'step'; stepId: string; checked: boolean }
  | { type: 'note'; text: string; stepId?: string }
  | { type: 'evidence'; evidence: Evidence }
  | { type: 'choice'; stepId: string; variantId: string; correctionId?: string; reason?: string }
  | { type: 'complete'; source: 'manual' | 'steps' }
  | { type: 'close-partial' }
  | { type: 'continue'; localDate: string; timezoneOffsetMinutes: number }
  | { type: 'reopen'; correctionId: string; reason: string };
export interface CaptureContext {
  eventId: string;
  date: string;
  seriesId: string;
  revisionId?: string;
  budgetMinutes?: number;
  window?: { startMin: number; endMin: number };
}
export interface Command {
  executionId: string;
  at: string;
  context?: CaptureContext;
  action: Action;
}
declare const preparedOperation: unique symbol;
export interface Operation {
  readonly [preparedOperation]: true;
  readonly before: Frozen<DocumentV2>;
  readonly after: Frozen<DocumentV2>;
}
export type DecodeResult = { ok: false; errors: string[] } |
  { ok: true; kind: 'legacy' | 'history-v2'; document: Frozen<Data | DocumentV2> };
export interface Engine {
  prepare(document: DocumentV2 | Frozen<DocumentV2>, command: Command): Operation;
  accept(current: DocumentV2 | Frozen<DocumentV2>, operation: Operation): Frozen<DocumentV2>;
  createRevision(document: DocumentV2 | Frozen<DocumentV2>, routineId: string, options: { revisionId: string; at: string }): {
    readonly document: Frozen<DocumentV2>; readonly revisionId: string;
  };
  validate(document: unknown): string[];
  decode(raw: string): DecodeResult;
  encode(document: unknown): string;
}
export function createEngine(validateLegacy: (value: unknown) => boolean): Engine;
