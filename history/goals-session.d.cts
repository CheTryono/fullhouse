import type {IncrementalAccess,VerifiedWindow} from './storage-incremental.cjs';
import type {PlanningMethod,PlanningPayloads,PlanningContext} from './storage-goals.cjs';
import type {RecoveryPacket} from './recovery-binary.cjs';
export interface GoalsState {readonly confirmed:VerifiedWindow|null;readonly pending:{readonly id:string;readonly error:string|null}|null;readonly busy:boolean;readonly drafts:Readonly<Record<string,unknown>>}
export interface GoalsSession {
 state():GoalsState;open():Promise<GoalsState>;
 save<M extends PlanningMethod>(method:M,payload:PlanningPayloads[M],context:PlanningContext,options?:Parameters<IncrementalAccess['commitPlanning']>[1]):Promise<GoalsState>;
 retry(options?:Parameters<IncrementalAccess['commitPlanning']>[1]):Promise<GoalsState>;
 exportPending():Promise<Blob>;resume(packet:RecoveryPacket):Promise<GoalsState>;
 readGoal(id:string):ReturnType<IncrementalAccess['readGoal']>;
 readDayReview(date:string):ReturnType<IncrementalAccess['readDayReview']>;
 setDraft(key:string,value:unknown):void;cancel():GoalsState;
}
export function createGoalsSession(access:IncrementalAccess):GoalsSession;
