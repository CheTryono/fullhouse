import type {StoragePlan,SourceBackup} from './storage-model.cjs';
import type {MigrationProposal,SourceCopies} from './storage-sources.cjs';
export interface Head {readonly key:'head';readonly format:1;readonly generation:number;readonly id:string;readonly rootHash:string}
export interface Receipt {readonly id:string;readonly rootHash:string;readonly generation:number;readonly operationHash:string;readonly changedRows:number;readonly newImages:number}
export interface CandidateSummary {readonly id:string;readonly rootHash:string;readonly status:'staged'|'committed'}
export type OpenState={status:'ready';head:Head;plan:StoragePlan;storedImages:number;sources:readonly SourceBackup[];candidates:readonly CandidateSummary[]} |
 {status:'empty'|'candidate-awaiting-confirmation';head:null;plan:null;candidates:readonly CandidateSummary[]} |
 {status:'recovery';error:string;head?:Head;plan?:StoragePlan};
export interface CommitResult {readonly status:'confirmed'|'committed-but-superseded'|'recovery';readonly receipt:Receipt;readonly head:Head;readonly repeated?:boolean;readonly error?:string}
type Fault='before-writes'|'after-records'|((tx:IDBTransaction)=>void);
export interface LabDatabase {
 open():Promise<OpenState>;
 commit(plan:StoragePlan,options:{expected?:Head|null;id:string;replace?:boolean;fault?:Fault}):Promise<CommitResult>;
 stageMigration(proposal:MigrationProposal,options:{id:string;expected?:Head|null;fault?:'abort'}):Promise<unknown>;
 verifyCandidate(id:string):Promise<unknown>;
 finalizeMigration(id:string,options:{confirm:true;readSources:()=>SourceCopies|Promise<SourceCopies>;fault?:Fault}):Promise<CommitResult>;
 listExecutions(day:string,limit?:number):Promise<readonly unknown[]>;
 readEvidence(owner:string,id:string):Promise<unknown>;
 close():void;
}
export function createLabDatabase(options:{factory:IDBFactory|null|undefined;name:`fullhouse-lab-${string}`;legacy:(value:unknown)=>boolean}):LabDatabase;
