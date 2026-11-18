import type {Result} from './calendar-proof.cjs';
export function createCalendarProofPort(factory:()=>Worker):{
 prove(id:string,input:unknown,options?:{signal?:AbortSignal}):Promise<Result>;
 cancel(id:string):boolean;close():void;
};
