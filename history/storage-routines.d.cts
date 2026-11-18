export type RoutineMethod='saveRoutine'|'deleteRoutine';
export type RoutineContext=Omit<import('./storage-goals.cjs').PlanningContext,'state'>&{state?:{selectedDate?:string}};
export interface RoutinePayloads {saveRoutine:Routine;deleteRoutine:{id:string}}
export interface CalendarCatalog {dates:string[];zone:string;domain:{min:string;max:string};segments:{from:string;through:string;coverage:'all-local-weekdays'|'finite-exhaustion';weekdays:number[];representatives:number}[]}
export function calendarDates(events:readonly EventItem[],from:string,parseDay?:(date:string)=>Date):CalendarCatalog;
export function proofDates(events:readonly EventItem[],from:string,parseDay?:(date:string)=>Date):string[];
export function choices(routine:Routine):Record<string,string>[];
export function calendarZone():string;
