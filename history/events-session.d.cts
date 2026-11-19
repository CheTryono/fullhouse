import type {GoalsSession,GoalsState} from './goals-session.cjs';
import type {IncrementalAccess} from './storage-incremental.cjs';
import type {EventDraftEdit,EventEditContext} from './storage-events-edit.cjs';
import type {EventDraftCreate,EventContext} from './storage-events.cjs';
export interface EventsSession extends Omit<GoalsSession,'save'|'readGoal'|'readDayReview'> {
 save(method:'editEvent',payload:EventDraftEdit,context:EventEditContext,options?:Parameters<IncrementalAccess['commitEventEdit']>[1]):Promise<GoalsState>;
 readEventEdit(id:string):ReturnType<IncrementalAccess['readEventEdit']>;
 save(method:'createEvent',payload:EventDraftCreate,context:EventContext,options?:Parameters<IncrementalAccess['commitEvent']>[1]):Promise<GoalsState>;
 readEvent(id:string,options?:{after?:string;limit?:number}):ReturnType<IncrementalAccess['readEvent']>;
}
export function createEventsSession(access:IncrementalAccess):EventsSession;
