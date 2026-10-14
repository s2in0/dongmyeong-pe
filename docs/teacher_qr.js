import qrcode from './vendor/qrcode.mjs';
import {studentLink} from './student_access.js?v=23';

export function drawStudentQr(canvas,link) {
  const qr=qrcode(0,'M');qr.addData(link);qr.make();
  const modules=qr.getModuleCount(),quiet=4,cell=Math.ceil(720/(modules+quiet*2)),size=(modules+quiet*2)*cell;
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,size,size);context.fillStyle='#000000';
  for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))context.fillRect((col+quiet)*cell,(row+quiet)*cell,cell,cell);
}

export function initStudentQr(getIdentity,getEndpoint) {
  const $=id=>document.getElementById(id),dialog=$('studentQrDialog'),canvas=$('studentQrCanvas');
  let file=null,link='',sequence=0;
  const status=text=>{$('studentQrStatus').textContent=text};
  const download=()=>{
    if(!file)return;
    const href=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=href;anchor.download=file.name;
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  $('showStudentQr').onclick=()=>{
    try{
      const identity=getIdentity(),current=++sequence;file=null;
      link=studentLink(location.href,getEndpoint(),identity);drawStudentQr(canvas,link);
      $('studentQrTitle').textContent=`${identity.grade}학년 ${identity.classNo}반 · 학생 접속`;
      $('studentQrLink').href=link;$('studentQrLink').textContent=link;
      $('downloadStudentQr').disabled=$('shareStudentQr').disabled=true;status('');dialog.showModal();
      canvas.toBlob(blob=>{
        if(current!==sequence||!blob)return;
        file=new File([blob],`JUMPY_${identity.grade}학년_${identity.classNo}반_QR.png`,{type:'image/png'});
        $('downloadStudentQr').disabled=$('shareStudentQr').disabled=false;
      },'image/png');
    }catch(error){$('teacherStatus').textContent=`QR 생성 실패: ${error.message}`;}
  };
  $('closeStudentQr').onclick=()=>dialog.close();
  $('downloadStudentQr').onclick=()=>{download();status('QR 이미지를 저장했습니다. 학생들에게 보내거나 화면에 띄워 주세요.');};
  $('shareStudentQr').onclick=async()=>{
    if(!file)return;
    try{
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:$('studentQrTitle').textContent});status('QR 이미지를 공유했습니다.');}
      else{download();status('이 브라우저에서는 공유창을 지원하지 않아 QR 이미지를 저장했어요. 저장한 이미지를 보내 주세요.');}
    }catch(error){if(error.name!=='AbortError')status('공유하지 못했어요. ‘이미지 저장’을 이용해 주세요.');}
  };
  $('copyQrLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);status('이 반의 학생용 링크를 복사했습니다.');}catch{status('아래 접속 링크를 길게 눌러 복사해 주세요.');}};
  $('expandStudentQr').onclick=async()=>{
    if(document.fullscreenElement===dialog){await document.exitFullscreen();return;}
    if(dialog.requestFullscreen){try{await dialog.requestFullscreen();return;}catch{}}
    dialog.classList.toggle('qr-expanded');
  };
  dialog.addEventListener('close',()=>{sequence++;dialog.classList.remove('qr-expanded');if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});});
}
