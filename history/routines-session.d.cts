import type {GoalsSession,GoalsState} from './goals-session.cjs';
import type {IncrementalAccess} from './storage-incremental.cjs';
import type {RoutineMethod,RoutinePayloads,RoutineContext} from './storage-routines.cjs';
export interface RoutinesSession extends Omit<GoalsSession,'save'|'readGoal'|'readDayReview'> {save<M extends RoutineMethod>(method:M,payload:RoutinePayloads[M],context:RoutineContext,options?:Parameters<IncrementalAccess['commitRoutine']>[1]):Promise<GoalsState>;readRoutine(id:string,options?:{after?:string;revisionAfter?:string;limit?:number}):ReturnType<IncrementalAccess['readRoutine']>}
export function createRoutinesSession(access:IncrementalAccess):RoutinesSession;
