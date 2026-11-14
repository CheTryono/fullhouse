import type { DocumentV2, Frozen } from '../contracts/history-v2';
import type { Engine, Command, Operation, CaptureContext } from './engine.cjs';
export type SourceDocument = Data | DocumentV2 | Frozen<Data | DocumentV2>;
export interface Frame { start: number; end: number; length: number }
export interface Schedule {
  validData(value: unknown): boolean;
  occurs(event: EventItem | Frozen<EventItem>, date: string): boolean;
  eventFrame(event: EventItem | Frozen<EventItem>, date: string, document: SourceDocument): Frame | null;
}
export interface Adapter {
  context(document: SourceDocument, eventId: string, date: string, ids: { seriesId: string; revisionId: string }): Frozen<CaptureContext>;
  prepare(engine: Engine, document: DocumentV2 | Frozen<DocumentV2>, request: Command): Operation;
  scheduled(document: SourceDocument, date: string): readonly { event: Frozen<EventItem>; frame: Readonly<Frame> | null }[];
}
export function createAdapter(schedule: Schedule): Adapter;
