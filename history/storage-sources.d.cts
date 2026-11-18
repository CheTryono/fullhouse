import type {StoragePlan} from './storage-model.cjs';
export interface SourceCopies {readonly main:string|null;readonly alias:string|null}
export interface Fingerprint {readonly main:string|null;readonly alias:string|null}
export interface SourceInfo {readonly raw:string|null;readonly hash:string|null;readonly valid:boolean;readonly factsHash?:string|null}
export interface Inspection {readonly status:'missing'|'same-bytes'|'same-facts'|'divergent'|'single';readonly main:SourceInfo;readonly alias:SourceInfo}
export interface MigrationProposal {readonly selection:'main'|'alias';readonly sources:SourceCopies;readonly fingerprint:Fingerprint;readonly sourceStatus:Inspection['status'];readonly plan:StoragePlan}
export function inspectSources(copies:SourceCopies,legacy:(value:unknown)=>boolean):Promise<Inspection>;
export function fingerprint(inspection:Inspection):Fingerprint;
export function proposeMigration(copies:SourceCopies,selection:'main'|'alias',legacy:(value:unknown)=>boolean):Promise<MigrationProposal>;
