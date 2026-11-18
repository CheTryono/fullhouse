export type PlanningMethod='saveGoal'|'saveProgress'|'toggleMilestone'|'saveDayReview';
export interface PlanningPayloads {saveGoal:GoalDraft;saveProgress:Record<string,never>;toggleMilestone:{goalId:string;milestoneId:string};saveDayReview:Record<string,never>}
export interface PlanningContext {operationId:string;today:string;at:string;ids:string[];state?:{selectedDate?:string;progressGoalId?:string;progressValue?:string;progressStatus?:GoalStatus;progressNote?:string;reviewDraft?:string};confirm?:boolean}
