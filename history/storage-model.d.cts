import type {DocumentV2,Frozen} from '../contracts/history-v2';
export type Table='goals'|'routines'|'events'|'revisions'|'executions'|'evidence'|'reviews';
export interface Row {readonly key:string;readonly hash:string;readonly value:unknown}
export interface Image {readonly hash:string;readonly size:number;readonly blob:Blob}
export interface SourceBackup {readonly id:string;readonly migrationId:string;readonly source:'main'|'alias';readonly raw:string|null;readonly hash:string|null}
declare const storagePlan: unique symbol;
/** Formato físico, nunca debe presentarse como un Data v2 con src ficticios. */
export interface StoragePlan {
 readonly [storagePlan]:true;readonly format:1;readonly rootHash:string;
 readonly header:Readonly<{version:2;goalIds:readonly string[];routineIds:readonly string[];eventIds:readonly string[];revisionIds:readonly string[];logKeys:readonly string[];reviewDates:readonly string[];dayReviewsPresent:boolean}>;
 readonly tables:Readonly<Record<Table,readonly Row[]>>;readonly images:readonly Image[];readonly sourceBackups?:readonly SourceBackup[];
}
export function prepareDocument(document:DocumentV2|Frozen<DocumentV2>,legacy:(value:unknown)=>boolean):Promise<StoragePlan>;
export function verifyPlan(plan:StoragePlan,legacy:(value:unknown)=>boolean):Promise<StoragePlan>;
export function hydrate(plan:StoragePlan,legacy:(value:unknown)=>boolean):Promise<DocumentV2>;
export function bytesHash(blob:Blob):Promise<string>;
export function rootHash(plan:StoragePlan):Promise<string>;
