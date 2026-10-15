// 동작 기호가 길면(예: '가위바위보뛰기') 칸 크기는 그대로 두고 글자만 줄여 맞춥니다.
// class="fit-sym": 한 줄에 맞춤. class="fit-sym fit-2": 원래 한 줄 높이 안에서 두 줄까지 나눠 더 크게 맞춤.
// 기호를 표시하는 요소에 클래스만 붙이면 새로 그려지거나 칸 크기가 바뀔 때 자동으로 맞춥니다.
const MIN_PX=9;
let scheduled=false;
const sized=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedule()):null;
const watched=new WeakSet();

function overflows(el,maxHeight){
  return el.scrollWidth>el.clientWidth+0.5||(maxHeight&&el.scrollHeight>maxHeight+0.5);
}

export function fitSymbol(el){
  if(!el||!el.isConnected)return;
  el.style.fontSize='';el.style.whiteSpace='';
  if(!el.clientWidth||!overflows(el))return;
  let size=parseFloat(getComputedStyle(el).fontSize)||16,maxHeight=0;
  if(el.classList.contains('fit-2')){
    // 한 줄일 때의 높이를 예산으로 두고, 그 안에서 두 줄로 나눕니다.
    maxHeight=el.clientHeight;el.style.whiteSpace='normal';
  }
  for(let i=0;i<24&&overflows(el,maxHeight)&&size>MIN_PX;i++){
    size=Math.max(MIN_PX,Math.floor(size*0.92*10)/10);
    el.style.fontSize=size+'px';
  }
}

function fitAll(){
  scheduled=false;
  document.querySelectorAll('.fit-sym').forEach(el=>{
    if(sized&&!watched.has(el)){watched.add(el);sized.observe(el)}
    fitSymbol(el);
  });
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(fitAll);
}

export function initSymbolFit(){
  if(typeof document==='undefined')return;
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule);
  if(document.fonts?.ready)document.fonts.ready.then(schedule);
  schedule();
}
