/** Contrato de diseño. No importado por app.tsx ni activado en el navegador.
 * Los tipos base globales proceden de app.tsx durante check:history-contract.
 */
export type Frozen<T> = T extends readonly unknown[] ? ReadonlyArray<Frozen<T[number]>> :
  T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T;
export type CaptureReason = 'complete' | 'step' | 'choice' | 'note' | 'evidence';
export type Provenance = 'recorded' | 'adopted-current';
export interface RecipeRevision {
  readonly id: string;
  readonly sourceRoutineId: string;
  readonly createdAt: string;
  readonly definition: Frozen<Routine>;
}
export interface GoalLabel {
  readonly id: string;
  readonly title: string | null;
  readonly area?: LifeArea;
  readonly color?: string;
}
export interface ExecutionCapture {
  readonly format: 1;
  readonly executionId: string;
  readonly seriesId: string;
  readonly sourceEventId: string;
  readonly sourceRoutineId: string | null;
  readonly scheduledDate: string;
  readonly capturedAt: string; // Primer registro; no inicio físico.
  readonly captureReason: CaptureReason;
  readonly provenance: Provenance;
  readonly recipeRevisionId: string | null;
  readonly plan: {
    readonly title: string;
    readonly description: string;
    readonly kind: 'activity' | 'routine' | 'review' | 'occasion';
    readonly allDay: boolean;
    readonly durationMode: 'steps' | 'fixed' | 'between' | 'event';
    readonly window: { readonly startMin: number; readonly endMin: number } | null;
    readonly budgetMinutes: number | null;
    readonly goals: readonly GoalLabel[];
  };
}
export interface ResolvedNode {
  stepId: string;
  variantId: string | null; // null = base; variants se identifican dentro del paso.
  plannedMinutes: number | null; // null si aún falta una elección.
  decisionPending: boolean;
  children: ResolvedNode[];
}
export interface Resolution {
  rule: 'leaf-count-v1';
  tree: ResolvedNode[];
  unitStepIds: string[];
  unitsKnown: boolean;
  totalPlannedMinutes: number | null;
}
export interface ProgressCheckpoint {
  completed: boolean;
  checkedSteps: string[];
  choices: Record<string, string>;
  note: string;
  stepNotes: Record<string, string>;
  evidenceIds: string[]; // Referencias; nunca bytes de imagen.
  resolution: Resolution;
}
export interface Correction {
  readonly id: string;
  readonly recordedAt: string;
  readonly reason: string;
  readonly kind: 'choice' | 'reopen';
  readonly before: Frozen<ProgressCheckpoint>;
}
export interface History {
  capture: ExecutionCapture;
  resolution: Resolution;
  state: {
    status: 'active' | 'completed' | 'closed-partial';
    completionSource: 'manual' | 'steps' | null;
    lastRecordedAt: string;
    completedRecordedAt: string | null;
  };
  actualTiming: null | { minutes: number; source: 'manual' | 'timer'; recordedAt: string };
  continuations: { recordedAt: string; localDate: string; timezoneOffsetMinutes: number }[];
  corrections: Correction[];
}
export type LegacyLog = RecordLog & { history?: never };
export type CapturedLog = RecordLog & { history: History };
export type LogV2 = LegacyLog | CapturedLog;
export type EventV2 = EventItem & { seriesId?: string; recipeRevisionId?: string };
export type DocumentV2 = Omit<Data, 'version' | 'events' | 'logs'> & {
  version: 2;
  recipeRevisions: Record<string, RecipeRevision>;
  events: EventV2[];
  logs: Record<string, LogV2>;
};
/** DTO de lectura no persistido: jamás se convierte en captura verificable. */
export type LegacyView = { kind: 'legacy'; confidence: 'unknown'; facts: RecordLog } |
  { kind: 'estimate'; confidence: 'estimated'; label: string; source: 'current-template'; generatedAt: string };
export type Transition = 'progress' | 'complete' | 'correct-choice' | 'continue' |
  'close-partial' | 'reopen' | 'edit-template' | 'delete-template' | 'reprogram';
