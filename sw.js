const CACHE='wordstep-cet4-v7';
const assets=['./','index.html','style.css?v=20261106-7','training.css?v=20261106-7','app.js?v=20261106-7','engine.js?v=20261106-7','training.js?v=20261106-7','rounds.js?v=20261106-7','pronunciation.js?v=20261106-7','data/pronunciation.json?v=20261106-7','audio/words.mp3','exams.js?v=20261106-7','data/exams.json?v=20261106-7','icon.svg','manifest.webmanifest','icon-192.png','icon-512.png','data/words.json','data/practice.json?v=20261106-7','data/source.json','data/LICENSE-ECDICT.txt',...Array.from({length:48},(_,i)=>'audio/listen-'+String(i+1).padStart(2,'0')+'.mp3')];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(assets)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wordstep-cet4-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.status===200){const copy=response.clone();await caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request,{ignoreSearch:true});if(!cached)throw new Error('Offline');
    const range=event.request.headers.get('range');
    if(!range)return cached;
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match)return cached;
    const bytes=await cached.arrayBuffer(),size=bytes.byteLength;
    const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
    const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
    if(start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
    return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'audio/mpeg','Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`}});
  }));
});
