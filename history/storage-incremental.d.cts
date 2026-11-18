import type {Head,Receipt} from './storage-idb.cjs';
import type {EditCommand,NativeRequest} from './legacy-compat.cjs';
import type {Row} from './storage-model.cjs';
declare const verifiedWindow:unique symbol,preparedDelta:unique symbol;
export interface VerifiedWindow {readonly [verifiedWindow]:true;readonly format:'verified-history-window';readonly generation:number;readonly rootHash:string}
export interface PreparedDelta {readonly [preparedDelta]:true;readonly format:'prepared-history-delta';readonly id:string;readonly prepareMs:number;readonly changedRows:number;readonly newImages:number}
export interface IncrementalAccess {
 preparePlanning<M extends import('./storage-goals.cjs').PlanningMethod>(token:VerifiedWindow,method:M,payload:import('./storage-goals.cjs').PlanningPayloads[M],context:import('./storage-goals.cjs').PlanningContext):Promise<PreparedDelta>;
 commitPlanning:IncrementalAccess['commitExecution'];
 readGoal(token:VerifiedWindow,id:string):Promise<{readonly goal:Readonly<Goal>|null;readonly related:readonly unknown[];readonly photoBytesHydrated:0;readonly readMs:number}>;
 readDayReview(token:VerifiedWindow,date:string):Promise<{readonly date:string;readonly review:Readonly<DayReview>|null;readonly photoBytesHydrated:0;readonly readMs:number}>;
 exportPending(operation:PreparedDelta,drafts:unknown):Promise<Blob>;
 resumePending(token:VerifiedWindow,packet:import('./recovery-binary.cjs').RecoveryPacket):Promise<PreparedDelta|{status:'already-confirmed';id:string;token:VerifiedWindow}>;
 inspectOperation(operation:PreparedDelta):Promise<unknown>;
 openWindow():Promise<{token:VerifiedWindow;verifiedMs:number;executions:number;photoBytesHydrated:0}>;
 prepareExecution(token:VerifiedWindow,key:string,command:EditCommand|NativeRequest):Promise<PreparedDelta>;
 commitExecution(operation:PreparedDelta,options?:{fault?:'before-writes'|'after-records'|'lost-ack'|((tx:IDBTransaction)=>void)}):Promise<{status:'confirmed'|'committed-but-superseded';receipt:Receipt;token:VerifiedWindow|null;writeMs:number;transactionMs:number;lineagePrepareMs:number;lineageAfterMs:number;confirmationMs:number}>;
 page(token:VerifiedWindow,options?:{after?:string;limit?:number;date?:string}):Promise<{rows:Row[];next:string|null;readMs:number;photoBytesHydrated:0}>;
 readExecution(token:VerifiedWindow,key:string):Promise<unknown>;
 readPhoto(token:VerifiedWindow,owner:string,id:string):Promise<{metadata:unknown;blob:Blob}>;
 statistics(token:VerifiedWindow,options?:{from?:string;to?:string}):Promise<unknown>;
}
