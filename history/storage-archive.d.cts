import type {StoragePlan} from './storage-model.cjs';
export function exportArchive(plan:StoragePlan,legacy:(value:unknown)=>boolean):Promise<Blob>;
export function importArchive(file:Blob,legacy:(value:unknown)=>boolean):Promise<StoragePlan>;
