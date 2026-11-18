import type {StoragePlan} from './storage-model.cjs';
export interface RecoveryPacket {meaning:'pending-not-confirmed';metadata:Readonly<{format:'fullhouse-pending-recovery';version:1;id:string;base:unknown;drafts:unknown;operation?:unknown;candidateRoot:string;meaning:'pending-not-confirmed';archiveBytes:number;checksum:string}>;candidate:StoragePlan}
export function exportRecovery(value:{id:string;base:unknown;candidate:StoragePlan;drafts:unknown;operation?:unknown},legacy:(value:unknown)=>boolean):Promise<Blob>;
export function inspectRecovery(file:Blob,legacy:(value:unknown)=>boolean):Promise<RecoveryPacket>;
