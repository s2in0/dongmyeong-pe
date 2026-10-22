// Usage: node tools/extract_browser_counter_tracks.cjs APP_ROOT FRAME_ROOT MANIFEST.json OUTPUT_DIR
// Requires npm package playwright and an installed Chromium browser. Input manifest:
// [{id,source,start,end,width,height,manualCount:null,frames:[[seconds,"clip/0.png"],...]}]
// Decode source video frames beforehand. Do not label counter peaks as ground truth.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const [appRoot,frameRoot,manifestFile,outDir]=process.argv.slice(2).map(p=>path.resolve(p));
if(!outDir)throw Error('Expected APP_ROOT FRAME_ROOT MANIFEST.json OUTPUT_DIR');
const clips=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
function inside(root,relative){const file=path.resolve(root,relative),rel=path.relative(root,file);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Path outside input directory');return file;}
const server=http.createServer((req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<meta charset="utf-8">');}
  const file=pathname.startsWith('/vendor/')?inside(path.join(appRoot,'docs'),pathname.slice(1)):inside(frameRoot,pathname.slice(1));
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.png')?'image/png':'application/octet-stream');
  const input=fs.createReadStream(file);input.on('error',()=>{res.statusCode=404;res.end();});input.pipe(res);
 }catch{res.statusCode=400;res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||undefined});
 try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{window.vision=await import('/vendor/mediapipe/vision_bundle.mjs');window.files=await vision.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');});
  fs.mkdirSync(outDir,{recursive:true});
  for(const clip of clips){
   if(!/^[a-zA-Z0-9_-]+$/.test(clip.id))throw Error('Invalid clip ID');
   const result=await page.evaluate(async clip=>{
    const model=await vision.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/vendor/mediapipe/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});
    const frames=[];let inferMs=0;
    try{for(const [t,file]of clip.frames){const img=new Image();img.src='/'+file;try{await img.decode();}catch{throw Error('Cannot decode source frame: '+file);}
      const before=performance.now(),pose=model.detectForVideo(img,Math.round(t*1000)).landmarks?.[0]||null;inferMs+=performance.now()-before;
      frames.push([t,pose?.map(p=>({x:p.x,y:p.y,visibility:p.visibility}))||null]);
    }}finally{model.close();}
    return {...clip,frames,meanInferenceMs:inferMs/frames.length};
   },clip);
   fs.writeFileSync(path.join(outDir,clip.id+'.json'),JSON.stringify(result));console.log(clip.id,result.frames.length,'frames');
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
