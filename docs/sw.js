const CACHE='jump-rope-pwa-v9';
const ASSETS=['./','./index.html','./app.js','./jump_counter.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const external=(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/@mediapipe/tasks-vision@1.0.1/'))||(u.hostname==='storage.googleapis.com'&&u.pathname.startsWith('/mediapipe-models/pose_landmarker/'));
  if(u.origin!==location.origin&&!external)return;
  const appShell=u.origin===location.origin&&(/\/(?:index\.html|app\.js|jump_counter\.js|manifest\.webmanifest|sw\.js)$/.test(u.pathname)||u.pathname.endsWith('/docs/'));
  const online=()=>fetch(e.request).then(r=>{
    if(r.ok||r.type==='opaque'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});}return r;
  });
  e.respondWith(appShell?online().catch(()=>caches.match(e.request)):caches.match(e.request).then(hit=>hit||online()));
});
