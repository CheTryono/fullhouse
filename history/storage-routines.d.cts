export type RoutineMethod='saveRoutine'|'deleteRoutine';
export type RoutineContext=Omit<import('./storage-goals.cjs').PlanningContext,'state'>&{state?:{selectedDate?:string}};
export interface RoutinePayloads {saveRoutine:Routine;deleteRoutine:{id:string}}
