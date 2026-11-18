import type { Frozen } from '../contracts/history-v2';
export interface Budgets {
    states: number;
    checks: number;
    work: number;
    profiles: number;
    segments: number;
}
export interface CalendarInput {
    events: EventItem[];
    routines: Routine[];
    from: string;
    through?: string;
    budgets?: Partial<Budgets>;
    disallowSameRoutineCooccurrence?: boolean;
}
export type Status = 'valid' | 'invalid' | 'indeterminate';
export interface Segment {
    from: string;
    through: string;
    periodDays: string | null;
    representatives: number;
    profiles: number;
    states: number;
    coverage: 'periodic' | 'finite';
}
export interface Component {
    eventIds: string[];
    routineIds: string[];
    periodDays: string | null;
    segments: Segment[];
}
export interface Certificate {
    format: 'fullhouse-calendar-proof';
    version: 1;
    algorithm: string;
    status: Status;
    reason: string | null;
    inputHash: string | null;
    semanticsHash: string;
    environment: {
        zone: string;
        dateConstructor: string;
        utc: boolean;
    };
    domain: {
        min: string;
        max: string;
    };
    from: string | null;
    through: string | null;
    budgets?: Budgets;
    restrictions: string[];
    recurrences: unknown[];
    components: Component[];
    counts: {
        states: number;
        checks: number;
        work: number;
        segments: number;
    };
    counterexample: unknown | null;
}
export interface Result {
    readonly status: Status;
    readonly certificate: Frozen<Certificate>;
    readonly proofHash: string;
    readonly metrics: {
        readonly elapsedMs: number;
    };
}
export interface Options {
    signal?: AbortSignal;
    yieldControl?: () => Promise<void>;
}
export interface CalendarProof {
    prove(input: unknown, options?: Options): Promise<Result>;
    verify(input: unknown, result: Result, options?: Options): Promise<boolean>;
}
export function createCalendarProof(schedule: Record<string, unknown>): CalendarProof;
export function projectPlan(plan: import('./storage-model.cjs').StoragePlan, options: Omit<CalendarInput, 'events' | 'routines'>): CalendarInput;
export const ALGORITHM: string, APPROVED: string, DEFAULTS: Readonly<Budgets>, HARD: Readonly<Budgets>;
