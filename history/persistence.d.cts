import type {DocumentV2,Frozen} from '../contracts/history-v2';
export interface StoragePort { read(key:string):Promise<string|null>; write(key:string,raw:string):Promise<void>; remove(key:string):Promise<void> }
export interface LockPort { exclusive<T>(fn:()=>Promise<T>):Promise<T> }
declare const tokenBrand: unique symbol, operationBrand: unique symbol;
export interface BaseToken { readonly [tokenBrand]:true }
export interface StoredOperation { readonly [operationBrand]:true; readonly document:Frozen<DocumentV2> }
export interface Originals { readonly raw:Readonly<Record<string,string|null>>; readonly errors:readonly {key:string;error:string}[] }
export type OpenResult = {status:'ready';document:Frozen<DocumentV2>;token:BaseToken} | {status:'uninitialized';token:BaseToken} | {status:'recovery';error:string;originals:Readonly<Record<string,string|null>>};
export interface Repository {
  open():Promise<OpenResult>;
  prepare(base:BaseToken,document:DocumentV2|Frozen<DocumentV2>,id:string):Promise<StoredOperation>;
  write(operation:StoredOperation):Promise<{document:Frozen<DocumentV2>;token:BaseToken}>;
  recoverOperation():Promise<StoredOperation>;
  originals():Promise<Originals>;
}
export const KEYS:Readonly<{legacy:string;historical:string;a:string;b:string;manifest:string;intent:string}>;
export function sha256(raw:string):Promise<string>;
export function createRepository(options:{storage:StoragePort;lock:LockPort;legacy:(value:unknown)=>boolean;digest?:(raw:string)=>Promise<string>}):Repository;
