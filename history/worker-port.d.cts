export interface WorkerPort {run(id:string,type:'prepare'|'verify'|'export'|'import',value:unknown):Promise<unknown>;close():void}
export function createWorkerPort(factory:()=>Worker):WorkerPort;
