import type { Frozen, History, ExecutionCapture, ProgressCheckpoint } from '../contracts/history-v2';
import type { SourceDocument, Adapter } from './adapter.cjs';
export interface ReadNode {
  id: string; title: string; description: string; variantId: string | null;
  decisionPending: boolean; plannedMinutes: number | null; flexible: boolean;
  checked: boolean; note: string; evidenceIds: string[]; children: ReadNode[];
}
export interface Facts extends Required<RecordLog> {}
interface BaseView { key: string; label: string; date: string | null }
export interface HistoricalView extends BaseView {
  kind: 'historical'; provenance: 'recorded' | 'adopted-current'; executionId: string; seriesId: string; eventId: string;
  capturedAt: string; title: string; description: string; routineDescription: string;
  plan: ExecutionCapture['plan']; plannedMinutes: number | null; tree: ReadNode[]; facts: Facts; status: History['state'];
  actualTiming: History['actualTiming']; continuations: History['continuations'];
  progress: { done: number; total: number | null; knownUnits: number };
  inactiveMarks: { id: string; title: string; note: string; evidenceIds: string[] }[];
  corrections: { id: string; kind: 'choice' | 'reopen'; at: string; reason: string;
    before: Frozen<ProgressCheckpoint>; lifecycle: History['state'] | null;
    changedChoices: { stepId: string; from: string | null; to: string | null }[] }[];
}
export interface LegacyView extends BaseView { kind: 'legacy'; facts: Facts; tree: []; estimateUnavailable?: boolean }
export interface EstimatedView extends BaseView { kind: 'estimated'; facts: Facts; tree: ReadNode[]; title: string; description: string; source: 'current-template' }
export interface IncompleteView extends BaseView { kind: 'incomplete'; facts?: Facts; errors: string[] }
export type ReadView = Frozen<HistoricalView | LegacyView | EstimatedView | IncompleteView | { kind: 'missing'; key: string; label: string }>;
export interface Progress {
  steps: { done: number; total: number; unknownExecutions: number };
  executions: { completed: number; total: number }; legacy: { completed: number; total: number };
  incomplete: number; adopted: number; scheduled: number | null;
  planning: { completed: number; total: number | null; invalid: number };
}
export interface Reader {
  read(document: SourceDocument, key: string, options?: { estimate?: boolean }): ReadView;
  index(document: SourceDocument): ReadView[];
  timeline(document: SourceDocument, date: string): readonly ( { id: string; kind: 'record'; view: ReadView; continued: boolean } | { id: string; kind: 'planned'; event: Frozen<EventItem>; frame: {start:number;end:number;length:number} | null } )[];
  progress(document: SourceDocument, date?: string): Frozen<Progress>;
}
export function createReader(validateLegacy: (value: unknown) => boolean, adapter: Adapter): Reader;
