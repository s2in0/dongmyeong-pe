// Classroom roster contains numbers only; music remains a group activity.
export function classRoster(grade,classNo){
 const total=Number(grade)===1?({1:15,2:15,3:14}[Number(classNo)]||0):0;
 return total?{numbers:Array.from({length:total},(_,i)=>i+1),total,maxNumber:total}:null;
}
export function validateStudentNumber(identity){
 const roster=classRoster(identity.grade,identity.classNo);
 if(roster&&!roster.numbers.includes(identity.number))throw Error(`${identity.grade}학년 ${identity.classNo}반 번호는 1~${roster.maxNumber}번이에요.`);
 return identity;
}
export function ropeParticipation(rows,roster){
 if(!roster)return null;
 const present=new Set(rows.map(row=>Number(row.number)).filter(n=>roster.numbers.includes(n))),missing=roster.numbers.filter(n=>!present.has(n));
 return {total:roster.total,completed:present.size,missing};
}
