import type {Head,Receipt} from './storage-idb.cjs';
import type {EditCommand,NativeRequest} from './legacy-compat.cjs';
import type {Row} from './storage-model.cjs';
declare const verifiedWindow:unique symbol,preparedDelta:unique symbol;
export interface VerifiedWindow {readonly [verifiedWindow]:true;readonly format:'verified-history-window';readonly generation:number;readonly rootHash:string}
export interface PreparedDelta {readonly [preparedDelta]:true;readonly format:'prepared-history-delta';readonly id:string;readonly prepareMs:number;readonly changedRows:number;readonly newImages:number}
export interface IncrementalAccess {
 reserveEventShift(token:VerifiedWindow,request:import('./storage-events-shift.cjs').EventShiftRequest,context:import('./storage-events-shift.cjs').EventShiftContext):Promise<import('./storage-events-shift.cjs').EventShiftReservation>;
 prepareEventShift(token:VerifiedWindow,reservation:import('./storage-events-shift.cjs').EventShiftReservation):Promise<PreparedDelta>;
 commitEventShift:IncrementalAccess['commitExecution'];
 eventShiftMetrics(operation:PreparedDelta):import('./storage-events-shift.cjs').EventShiftMetrics|null;
 readEventShift(token:VerifiedWindow,request:import('./storage-events-shift.cjs').EventShiftRequest,context:import('./storage-events-shift.cjs').EventShiftContext):Promise<{readonly event:Readonly<import('../contracts/history-v2').EventV2>;readonly segments:readonly Readonly<import('../contracts/history-v2').EventV2>[];readonly component:readonly string[];readonly date:string;readonly seriesId:string;readonly recorded:false;readonly photoBytesHydrated:0;readonly readMs:number}>;
 reserveEventEdit(token:VerifiedWindow,sourceEventId:string,operationId:string,expectedIds?:{sourceEventId:string;eventId:string;seriesId:string}):Promise<import('./storage-events-edit.cjs').EventEditReservation>;
 prepareEventEdit(token:VerifiedWindow,reservation:import('./storage-events-edit.cjs').EventEditReservation,payload:import('./storage-events-edit.cjs').EventDraftEdit,context:import('./storage-events-edit.cjs').EventEditContext):Promise<PreparedDelta>;
 commitEventEdit:IncrementalAccess['commitExecution'];
 eventEditMetrics(operation:PreparedDelta):import('./storage-events-edit.cjs').EventEditMetrics|null;
 readEventEdit(token:VerifiedWindow,id:string):Promise<{readonly event:Readonly<import('../contracts/history-v2').EventV2>;readonly segments:readonly Readonly<import('../contracts/history-v2').EventV2>[];readonly captures:readonly {key:string;executionId:string|null;seriesId:string|null;day:string|null;legacy:boolean;hash:string}[];readonly readMs:number;readonly photoBytesHydrated:0}>;
 reserveEvent(token:VerifiedWindow,operationId:string,expectedIds?:{eventId:string;seriesId:string}):Promise<import('./storage-events.cjs').EventReservation>;
 prepareEvent(token:VerifiedWindow,reservation:import('./storage-events.cjs').EventReservation,payload:import('./storage-events.cjs').EventDraftCreate,context:import('./storage-events.cjs').EventContext):Promise<PreparedDelta>;
 commitEvent:IncrementalAccess['commitExecution'];
 eventMetrics(operation:PreparedDelta):import('./storage-events.cjs').EventMetrics|null;
 readEvent(token:VerifiedWindow,id:string,options?:{after?:string;limit?:number}):Promise<{readonly records:readonly {readonly key:string;readonly executionId:string|null;readonly seriesId:string|null;readonly legacy:boolean}[];readonly recordCount:number;readonly next:string|null;readonly event:Readonly<import('../contracts/history-v2').EventV2>|null;readonly related:readonly unknown[];readonly historicalIdentityKnown:boolean;readonly photoBytesHydrated:0;readonly readMs:number}>;
 prepareRoutine<M extends import('./storage-routines.cjs').RoutineMethod>(token:VerifiedWindow,method:M,payload:import('./storage-routines.cjs').RoutinePayloads[M],context:import('./storage-routines.cjs').RoutineContext):Promise<PreparedDelta>;
 commitRoutine:IncrementalAccess['commitExecution'];
 routineMetrics(operation:PreparedDelta):{readonly relationsMs:number;readonly validationMs:number;readonly proof:{readonly dates:number;readonly combinations:number;readonly checks:number;readonly proof:string;readonly from:string;readonly eventIds:readonly string[]}}|null;
 readRoutine(token:VerifiedWindow,id:string,options?:{after?:string;revisionAfter?:string;limit?:number}):Promise<{readonly routine:Readonly<Routine>|null;readonly related:readonly unknown[];readonly captures:readonly unknown[];readonly captureCount:number;readonly revisionCount:number;readonly revisionCatalog:readonly {readonly key:string;readonly hash:string}[];readonly next:string|null;readonly readMs:number;readonly photoBytesHydrated:0}>;
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
 page(token:VerifiedWindow,options?:{after?:string;revisionAfter?:string;limit?:number;date?:string}):Promise<{rows:Row[];next:string|null;readMs:number;photoBytesHydrated:0}>;
 readExecution(token:VerifiedWindow,key:string):Promise<unknown>;
 readPhoto(token:VerifiedWindow,owner:string,id:string):Promise<{metadata:unknown;blob:Blob}>;
 statistics(token:VerifiedWindow,options?:{from?:string;to?:string}):Promise<unknown>;
}
