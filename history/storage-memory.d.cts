import type {StoragePort,LockPort} from './persistence.cjs';
export interface MemoryStorage extends StoragePort {
 failNext(spec:{op:'read'|'write'|'remove';key?:string;after?:boolean;skip?:number;message?:string}):void;
 setQuota(bytes:number):void; bytes():number; externalWrite(key:string,raw:string):void;
 raw(key:string):string|null;dump():Record<string,string>;readonly trace:{op:string;key:string}[];
}
export function createMemoryStorage(initial?:Record<string,string>,quotaBytes?:number):MemoryStorage;
export function createMemoryLock():LockPort;
