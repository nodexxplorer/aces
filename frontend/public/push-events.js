/* Loaded by the production Workbox worker. Only the account binding is stored,
   never notification bodies. Suppress queued alerts for a signed-out/other user. */
const ownerCache='notification-owner-v1';
const ownerKey='/__notification_owner';
self.addEventListener('message',(event)=>{
 if(event.data?.type!=='NOTIFICATION_OWNER')return;
 if(!event.source?.url||new URL(event.source.url).origin!==self.location.origin)return;
 event.waitUntil(caches.open(ownerCache).then(cache=>cache.put(ownerKey,new Response(JSON.stringify(event.data.owner||null)))));
});
self.addEventListener('push', (event) => {
 let payload;try{payload=event.data.json();}catch{return;}
 if(!payload||typeof payload.title!=='string')return;
 event.waitUntil((async()=>{
  const cache=await caches.open(ownerCache);const stored=await cache.match(ownerKey);const owner=stored?await stored.json():null;
  if(!owner||payload.data?.recipient_id!==owner.user||payload.data?.tenant_slug!==owner.tenant)return;
  await self.registration.showNotification(payload.title,{body:payload.body||'',icon:'/aces-logo.png',tag:payload.data?.event_id,data:payload.data||{}});
 })());
});
self.addEventListener('notificationclick',(event)=>{
 event.notification.close();let target=new URL('/notifications',self.location.origin);
 try{const requested=new URL(event.notification.data?.action_url||'/notifications',self.location.origin);if(requested.origin===self.location.origin)target=requested;}catch{}
 event.waitUntil((async()=>{
  const cache=await caches.open(ownerCache);const stored=await cache.match(ownerKey);const owner=stored?await stored.json():null;
  if(!owner||event.notification.data?.recipient_id!==owner.user||event.notification.data?.tenant_slug!==owner.tenant)return;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);return client.focus();}}return self.clients.openWindow(target.href);
 })());
});
