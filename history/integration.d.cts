import type {DocumentV2,Frozen} from '../contracts/history-v2';
import type {Engine,Command} from './engine.cjs';
import type {Adapter} from './adapter.cjs';
import type {Reader,ReadView,Progress} from './reader.cjs';
import type {Repository,Originals} from './persistence.cjs';
export interface RecoveryPacket {format:'fullhouse-experimental-recovery';version:1;confirmed:string|null;pending:string|null;drafts:Record<string,unknown>;storage:Originals}
export interface IntegrationState {readonly confirmed:Frozen<DocumentV2>|null;readonly pending:{readonly id:string;readonly document:Frozen<DocumentV2>;readonly error:string|null}|null;readonly recovery:unknown;readonly busy:boolean;readonly drafts:Readonly<Record<string,unknown>>}
export type PlanMethod='saveRoutine'|'saveEvent'|'shiftEvent'|'deleteRoutine'|'deleteEvent';
export interface Integration {
 state():IntegrationState;open():Promise<IntegrationState>;initialize(doc:DocumentV2|Frozen<DocumentV2>,id:string):Promise<IntegrationState>;
 dispatch(request:Command & {operationId:string}):Promise<IntegrationState>;
 plan(method:PlanMethod,payload:unknown,context:{today:string;ids:string[];confirm:boolean;operationId:string}):Promise<IntegrationState>;
 retry():Promise<IntegrationState>;recover():Promise<IntegrationState>;setDraft(id:string,value:unknown):void;
 importBackup(raw:string,options?:{id?:string;confirmReplace?:boolean}):Promise<IntegrationState|{status:'legacy-review';document:Frozen<Data>}>;
 exportConfirmed():string;exportRecovery():Promise<RecoveryPacket>;index():ReadView[];progress(date:string):Frozen<Progress>|null;
}
export function createIntegration(options:{engine:Engine;adapter:Adapter;reader:Reader;repository:Repository;plannerActions:Function;legacy:(value:unknown)=>boolean}):Integration;
