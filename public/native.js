const replies=new Map();let sequence=0;
export const isNative=!!(window.RiftNative||window.webkit?.messageHandlers?.rift);
if(window.RiftNative)window.RiftNative.onmessage=e=>receive(e.data);
window.riftNativeReply=data=>receive(data);
function receive(raw){try{const data=typeof raw==='string'?JSON.parse(raw):raw;const callback=replies.get(data.id);if(callback){replies.delete(data.id);callback(data)}}catch{}}
export function nativeCall(action,data={},timeout=120000){if(!isNative)return Promise.resolve({status:'unavailable'});return new Promise(resolve=>{const id='rift-'+(++sequence);const timer=setTimeout(()=>{replies.delete(id);resolve({status:'timeout'})},timeout);replies.set(id,result=>{clearTimeout(timer);resolve(result)});const payload={id,action,...data};try{if(window.RiftNative)window.RiftNative.postMessage(JSON.stringify(payload));else window.webkit.messageHandlers.rift.postMessage(payload)}catch{clearTimeout(timer);replies.delete(id);resolve({status:'unavailable'})}})}

export function publicGameURL(){return isNative?'https://rift-rush-rounak.lunarbook256.chatgpt.site/':location.origin+location.pathname}
if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`};
