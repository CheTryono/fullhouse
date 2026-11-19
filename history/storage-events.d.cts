import type {Budgets,Result} from './calendar-proof.cjs';
import type {VerifiedWindow,PreparedDelta} from './storage-incremental.cjs';
declare const reservation:unique symbol;
export interface EventReservation {readonly [reservation]:true;readonly format:'event-reservation-v1';readonly operationId:string;readonly parentReceiptHash:string;readonly generation:number;readonly eventId:string;readonly seriesId:string}
export type EventDraftCreate=Omit<EventItem,'id'>&{id?:''};
export interface EventContext {operationId:string;today:string;at:string;budgets?:Partial<Budgets>}
export interface EventMetrics {readonly scopeReadMs:number;readonly componentMs:number;readonly normalizationMs:number;readonly calendarMs:number;readonly constructionMs:number;readonly rootMs:number;readonly proof:Result|{readonly status:'valid';readonly certificate:Readonly<{format:'fullhouse-local-event-calendar-proof';version:1;algorithm:string;zone:string;from:string;through:string;eventIds:readonly string[];segments:readonly unknown[];counts:{states:number;checks:number;work:number;profiles:number}}>;readonly proofHash:string;readonly metrics:{elapsedMs:number}}}
