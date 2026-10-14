export function cameraErrorMessage(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return '카메라가 차단되어 있어요. 주소 옆 카메라 권한을 허용한 뒤 아래 연결 버튼을 다시 눌러 주세요.';
 if(error?.name==='NotFoundError')return '카메라를 찾지 못했어요. 카메라가 있는 기기에서 열어 주세요.';
 if(error?.name==='NotReadableError')return '다른 앱에서 카메라를 사용 중일 수 있어요. 그 앱을 닫고 연결 버튼을 다시 눌러 주세요.';
 if(error?.name==='CameraPermissionTimeout')return '카메라 허용 창에서 허용을 눌러 주세요. 연결 버튼으로 다시 시도할 수 있어요.';
 if(error?.name==='PoseModelTimeout')return '화면은 연결됐지만 점프 인식 준비가 지연되고 있어요. 연결 버튼을 다시 눌러 주세요.';
 return '카메라 연결을 완료하지 못했어요. 아래 연결 버튼을 다시 눌러 주세요.';
}
function timed(promise,ms,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const error=new Error(name);error.name=name;reject(error);},ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
const stop=stream=>stream?.getTracks().forEach(track=>track.stop());
// Request permission synchronously from the tap. Model work cannot delay the preview.
export function createCameraStart({requestStream,prepareModel,attachPreview,onStatus,onReady,onError,permissionTimeout=20000,modelTimeout=45000}){
 let generation=0,flight=null,active=null;
 return {
  start(){
   if(flight)return flight.promise;
   const token=++generation,pending={promise:null};flight=pending;onStatus('permission');
   let requested;try{requested=requestStream();}catch(error){requested=Promise.reject(error);}
   // Consume failures immediately even when permission is still waiting.
   const model=Promise.resolve().then(prepareModel);model.catch(()=>{});
   let attached=false;
   const media=Promise.resolve(requested).then(stream=>{if(token!==generation){stop(stream);return null;}active=stream;return stream;});
   pending.promise=(async()=>{try{
    const stream=await timed(media,permissionTimeout,'CameraPermissionTimeout');if(token!==generation||!stream)return false;
    await timed(attachPreview(stream),10000,'VideoPlaybackTimeout');if(token!==generation)return false;attached=true;onStatus('model');
    const prepared=await timed(model,modelTimeout,'PoseModelTimeout');if(token!==generation)return false;
    onReady(stream,prepared);onStatus('ready');return true;
   }catch(error){if(token===generation){generation++;stop(active);active=null;onError(error,cameraErrorMessage(error),attached);}return false;}
   finally{if(flight===pending)flight=null;}})();return pending.promise;
  },
  cancel(){generation++;stop(active);active=null;flight=null;},
  isStarting(){return !!flight;}
 };
}
