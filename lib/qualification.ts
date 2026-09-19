export type QualificationState='hot'|'warm'|'cold'|'unqualified';

export function qualificationStateForScore(score:number):QualificationState{
  if(score>=80)return'hot';
  if(score>=60)return'warm';
  if(score>=30)return'cold';
  return'unqualified';
}
