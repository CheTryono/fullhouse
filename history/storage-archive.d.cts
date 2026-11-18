import type {StoragePlan} from './storage-model.cjs';
export function exportArchive(plan:StoragePlan,legacy:(value:unknown)=>boolean):Promise<Blob>;
export function importArchive(file:Blob,legacy:(value:unknown)=>boolean):Promise<StoragePlan>;

export function writeArchive(plan:StoragePlan,legacy:(value:unknown)=>boolean,sink:{write(chunk:string|Uint8Array|Blob):unknown|Promise<unknown>;close():unknown|Promise<unknown>;abort(error:unknown):unknown|Promise<unknown>}):Promise<{complete:true}>;
