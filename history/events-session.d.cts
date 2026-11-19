import type {GoalsSession,GoalsState} from './goals-session.cjs';
import type {IncrementalAccess} from './storage-incremental.cjs';
import type {EventDraftCreate,EventContext} from './storage-events.cjs';
export interface EventsSession extends Omit<GoalsSession,'save'|'readGoal'|'readDayReview'> {
 save(method:'createEvent',payload:EventDraftCreate,context:EventContext,options?:Parameters<IncrementalAccess['commitEvent']>[1]):Promise<GoalsState>;
 readEvent(id:string):ReturnType<IncrementalAccess['readEvent']>;
}
export function createEventsSession(access:IncrementalAccess):EventsSession;
