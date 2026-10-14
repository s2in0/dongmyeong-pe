// Student links carry the class and public sheet endpoint, never teacher credentials.
export function studentLink(pageUrl, endpoint, identity) {
  const link=new URL('./',pageUrl);
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))throw Error('시트 연결 주소를 확인해 주세요.');
  const {grade,classNo}=identity;
  if(!Number.isInteger(grade)||grade<1||grade>6||!Number.isInteger(classNo)||classNo<1||classNo>30)throw Error('반을 선택해 주세요.');
  link.searchParams.set('sheet',endpoint);
  link.searchParams.set('grade',grade);
  link.searchParams.set('classNo',classNo);
  return link.href;
}

export function studentClass(search) {
  const params=new URLSearchParams(search),grade=Number(params.get('grade')),classNo=Number(params.get('classNo'));
  return Number.isInteger(grade)&&grade>=1&&grade<=6&&Number.isInteger(classNo)&&classNo>=1&&classNo<=30?{grade,classNo}:null;
}
