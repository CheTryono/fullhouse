import type {DocumentV2,Frozen} from '../contracts/history-v2';
import type {Engine,Command,CaptureContext} from './engine.cjs';
import type {Adapter} from './adapter.cjs';
export type EditAction={type:'step';stepId:string;checked:boolean}|{type:'complete'|'reopen'}|{type:'note';text:string;stepId?:string}|{type:'choice';stepId:string;variantId:string}|{type:'evidence';evidence:Evidence}|{type:'visibility';evidenceId:string;hidden:boolean};
export interface EditCommand {id:string;at:string;reason:string;action:EditAction}
export interface Adoption {id:string;at:string;confirm:true;reason:string;executionId:string;routineId:string;expectedDefinition:Routine|Frozen<Routine>;context:CaptureContext}
export type NativeRequest=(Omit<Command,'action'> & {action:Command['action']|{type:'visibility';evidenceId:string;hidden:boolean};editId:string;reason:string;operationId:string});
export interface Candidate {readonly before:Frozen<DocumentV2>;readonly after:Frozen<DocumentV2>}
export interface LegacyCompat {
 edit(document:DocumentV2|Frozen<DocumentV2>,key:string,command:EditCommand):Candidate;
 native(document:DocumentV2|Frozen<DocumentV2>,request:NativeRequest):Candidate;
 adopt(document:DocumentV2|Frozen<DocumentV2>,key:string,request:Adoption):Candidate;
}
export function createLegacyCompat(options:{legacy:(value:unknown)=>boolean;engine:Engine;adapter:Adapter}):LegacyCompat;
