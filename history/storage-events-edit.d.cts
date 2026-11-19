import type {EventContext,EventMetrics} from './storage-events.cjs';
import type {PreparedDelta,VerifiedWindow} from './storage-incremental.cjs';
declare const editReservation:unique symbol;
export interface EventEditReservation {readonly [editReservation]:true;readonly format:'event-edit-reservation-v1';readonly operationId:string;readonly sourceEventId:string;readonly eventId:string;readonly seriesId:string;readonly parentReceiptHash:string;readonly generation:number}
export type EventDraftEdit=EventItem & {seriesId?:string;recipeRevisionId?:string};
export interface EventEditContext extends EventContext {confirm?:boolean;capturedFuture?:'retain-frozen'}
export interface EventEditMetrics {readonly scopeReadMs:number;readonly rootMs:number;readonly split:boolean;readonly componentMs:number;readonly normalizationMs:number;readonly calendarMs?:number;readonly proof:EventMetrics['proof']|{status:'valid';kind:'metadata-no-calendar-effect'}}
