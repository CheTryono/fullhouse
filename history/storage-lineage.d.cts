import type {LabDatabase,Head,Receipt,OpenState,CommitResult} from './storage-idb.cjs';
import type {SourceCopies,Fingerprint,MigrationProposal} from './storage-sources.cjs';
import type {StoragePlan} from './storage-model.cjs';
export const CAPS:readonly ['authority-v1','source-watch-v1','receipt-chain-v1'];
export interface Point {readonly id:string;readonly generation:number;readonly rootHash:string;readonly receiptHash:string}
export interface Authority {
 readonly key:'authority';readonly protocol:1;readonly databaseVersion:2;readonly recordFormat:1;readonly documentVersion:2;
 readonly requiredCapabilities:typeof CAPS;readonly id:string;readonly identityHash:string;readonly checksum:string;
 readonly origin:{readonly kind:'native'|'migration'|'restored';readonly migrationId:string|null;readonly selected:'main'|'alias'|null;readonly keys:{readonly main:'fullhouse-v01';readonly alias:'botanica-planificador-v01'};readonly fingerprints:Fingerprint};
 readonly genesis:Point;readonly tip:Point;
}
export interface LineageHead extends Head {readonly authorityId:string;readonly receiptHash:string}
export interface LineageReceipt extends Receipt {readonly receiptHash:string;readonly lineage:{readonly protocol:1;readonly authorityId:string;readonly authorityHash:string;readonly genesis:Omit<Point,'receiptHash'>;readonly parent:Point|null}}
export type LineageOpen=Exclude<OpenState,{status:'ready'}>|{status:'ready'|'readonly';head:LineageHead;plan:StoragePlan;authority:Authority;storedImages:number;sources:readonly import('./storage-model.cjs').SourceBackup[]};
export interface LineageDatabase extends Omit<LabDatabase,'open'|'commit'|'finalizeMigration'> {
 open():Promise<LineageOpen>;
 commit(plan:StoragePlan,options:{id:string;expected?:Head|null;confirmRestore?:boolean;fault?:'before-writes'|'after-records'|((tx:IDBTransaction)=>void)}):Promise<CommitResult>;
 finalizeMigration(id:string,options:{confirm:true;fault?:'before-writes'|'after-records'|((tx:IDBTransaction)=>void)}):Promise<CommitResult>;
 auditLineage():Promise<{valid:true;authority:Authority}>;
 sourceRecovery():Promise<{format:'fullhouse-lineage-recovery';version:1;meaning:'sources-and-authority-not-a-complete-data-backup';originals:unknown;current:unknown;memoryConflict:unknown;state:unknown}>;
}
export function verifyAuthority(authority:unknown,head:unknown,receipts:readonly unknown[]):Promise<true>;
export function createLineageDatabase(options:{factory:IDBFactory|null|undefined;name:`fullhouse-lab-${string}`;legacy:(value:unknown)=>boolean;schedule?:unknown;plannerActions?:(document:unknown,context:unknown)=>unknown;readSources:()=>SourceCopies|Promise<SourceCopies>;writerCapabilities?:readonly string[];readOnly?:boolean}):LineageDatabase;
