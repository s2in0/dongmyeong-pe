const CACHE='jump-rope-pwa-v37',CAMERA_CACHE='jumpy-camera-assets-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./record_delivery.js','./class_roster.js','./camera_start.js','./music_track.js','./music_timeline.js','./music_rhythm.js','./music_sequence.js','./music_bars.js','./teacher.html','./teacher.js','./teacher_qr.js','./student_access.js','./vendor/qrcode.mjs','./teacher_records.js','./symbol_fit.js','./ranking_motion.js','./jump_counter.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./medals/first-step.svg','./medals/silver-rhythm.svg','./medals/sky-jump.svg','./medals/steady-star.svg','./medals/fire-jump.svg','./medals/moon-jump.svg','./medals/rainbow-jump.svg','./medals/crown-jump.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==CAMERA_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const external=(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/@mediapipe/tasks-vision@1.0.1/'))||(u.hostname==='storage.googleapis.com'&&u.pathname.startsWith('/mediapipe-models/pose_landmarker/'));
  if(u.origin!==location.origin&&!external)return;
  const cameraAsset=u.origin===location.origin&&u.pathname.includes('/vendor/mediapipe/');
  if(cameraAsset){e.respondWith(caches.open(CAMERA_CACHE).then(async cache=>{const hit=await cache.match(e.request);if(hit)return hit;const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response;}));return;}
  const appShell=u.origin===location.origin;
  const online=()=>fetch(e.request).then(r=>{
    if(r.ok||r.type==='opaque'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});}return r;
  });
  e.respondWith(appShell?online().catch(()=>caches.match(e.request)):caches.match(e.request).then(hit=>hit||online()));
});
