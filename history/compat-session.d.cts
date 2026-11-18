import type {DocumentV2,Frozen} from '../contracts/history-v2';
import type {LabDatabase,Head} from './storage-idb.cjs';
import type {Engine} from './engine.cjs';
import type {LegacyCompat,EditCommand,NativeRequest,Adoption} from './legacy-compat.cjs';
export interface SessionState {confirmed:Frozen<DocumentV2>|null;head:Head|null;pending:{id:string;document:Frozen<DocumentV2>;error:string|null}|null;busy:boolean;recovery:string|null;drafts:Record<string,unknown>}
export interface CompatSession {
 state():Frozen<SessionState>;open():Promise<Frozen<SessionState>>;
 save(document:DocumentV2|Frozen<DocumentV2>,id:string):Promise<Frozen<SessionState>>;
 edit(key:string,command:EditCommand):Promise<Frozen<SessionState>>;native(request:NativeRequest):Promise<Frozen<SessionState>>;adopt(key:string,request:Adoption):Promise<Frozen<SessionState>>;
 retry():Promise<Frozen<SessionState>>;
 plan(method:'saveRoutine'|'saveEvent'|'shiftEvent'|'deleteRoutine'|'deleteEvent'|'saveGoal'|'saveProgress'|'saveDayReview',payload:unknown,context:{today:string;ids:string[];operationId:string;confirm?:boolean;state?:Record<string,unknown>}):Promise<Frozen<SessionState>>;
 photo(target:{kind:'legacy';key:string}|{kind:'native';request:NativeRequest},process:()=>Promise<Evidence>,command:EditCommand|NativeRequest):Promise<Frozen<SessionState>>;
 packet():unknown;resume(value:unknown):Frozen<SessionState>;setDraft(key:string,value:unknown):void;clearDraft(key:string):void;
}
export function createCompatSession(options:{database:LabDatabase;compat:LegacyCompat;legacy:(value:unknown)=>boolean;plannerActions:Function;engine:Engine}):CompatSession;
