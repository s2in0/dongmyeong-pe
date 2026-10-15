// 동작 기호가 길면(예: '가위바위보뛰기') 칸 크기는 그대로 두고 글자만 줄여 한 줄에 맞춥니다.
// 기호를 표시하는 요소에 class="fit-sym"만 붙이면 새로 그려지거나 칸 크기가 바뀔 때 자동으로 맞춥니다.
const MIN_PX=9;
let scheduled=false;
const sized=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedule()):null;
const watched=new WeakSet();

export function fitSymbol(el){
  if(!el||!el.isConnected)return;
  el.style.fontSize='';
  const width=el.clientWidth;
  if(!width||el.scrollWidth<=width+0.5)return;
  let size=parseFloat(getComputedStyle(el).fontSize)||16;
  for(let i=0;i<4&&el.scrollWidth>width+0.5&&size>MIN_PX;i++){
    size=Math.max(MIN_PX,Math.floor(size*width/el.scrollWidth*10)/10);
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
