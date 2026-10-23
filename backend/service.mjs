import {createRun,step,move,blast,STEP,hashSeed,utcDay,VERSION} from '../public/core.js';
import {createAssault,stepAssault,moveAssault,nova,chooseUpgrade} from '../public/assault.js';
const MAX_BODY=49152,MAX_EVENTS=2400,MAX_TICKS=72000;
const enc=new TextEncoder(),dec=new TextDecoder(),keyCache=new Map(),limiters=new Map();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unb64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export class APIError extends Error{constructor(status,message){super(message);this.status=status}}
async function key(secret){if(!secret||secret.length<32)throw new APIError(503,'Online scores are temporarily unavailable.');if(!keyCache.has(secret)){if(keyCache.size>2)keyCache.clear();keyCache.set(secret,await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']))}return keyCache.get(secret)}
export async function signTicket(payload,secret){const body=b64(enc.encode(JSON.stringify(payload)));const signature=await crypto.subtle.sign('HMAC',await key(secret),enc.encode(body));return body+'.'+b64(new Uint8Array(signature))}
export async function verifyTicket(token,secret,now=Date.now()){
 try{if(typeof token!=='string'||token.length>1600)throw 0;const parts=token.split('.');if(parts.length!==2)throw 0;const[body,signature]=parts;if(!await crypto.subtle.verify('HMAC',await key(secret),unb64(signature),enc.encode(body)))throw 0;const t=JSON.parse(dec.decode(unb64(body)));if(t.v!==VERSION||!Number.isSafeInteger(t.exp)||t.exp<now||t.iat>now+5000||!Number.isInteger(t.seed)||t.seed<0||t.seed>4294967295||!['assault','rush','daily','endless'].includes(t.mode)||(t.assaultVersion!==undefined&&![1,2,3].includes(t.assaultVersion))||!/^[-\w]{16,64}$/.test(t.id)||!/^[-\w]{16,64}$/.test(t.player))throw 0;return t}catch(e){if(e instanceof APIError)throw e;throw new APIError(401,'This run ticket is invalid or expired.')}
}
export async function readJSON(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new APIError(415,'Send JSON.');
 if(Number(request.headers.get('content-length'))>MAX_BODY)throw new APIError(413,'Replay too large.');
 const reader=request.body?.getReader();if(!reader)throw new APIError(400,'Missing body.');let size=0,parts=[];
 while(true){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new APIError(413,'Replay too large.')}parts.push(value)}
 const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length}
 try{const body=JSON.parse(dec.decode(data));if(!body||typeof body!=='object'||Array.isArray(body))throw 0;return body}catch{throw new APIError(400,'Expected a JSON object.')}
}
// Isolate-local admission control is a second layer, not a substitute for edge WAF limits.
function rateLimit(request,route,now){const ip=request.headers.get('cf-connecting-ip')||'local';const id=route+':'+ip;const allowance=route==='start'?12:8,period=60000;const previous=limiters.get(id);if(!previous||now-previous.time>period){if(limiters.size>=10000)limiters.delete(limiters.keys().next().value);limiters.set(id,{time:now,count:1});return}if(++previous.count>allowance)throw new APIError(429,'Too many requests. Try again in a minute.')}
export function replayRun(ticket,body,now=Date.now()){
 const ticks=body.ticks,events=body.events;
 if(!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS)throw new APIError(400,'Invalid run length.');
 if(!Array.isArray(events)||events.length>MAX_EVENTS)throw new APIError(400,'Invalid replay.');
 if(ticks*STEP*1000>now-ticket.iat+2500)throw new APIError(400,'Run completed faster than real time.');
 let previous=-1;for(const e of events){if(!Array.isArray(e)||e.length!==2||!Number.isInteger(e[0])||e[0]<0||e[0]>=ticks||e[0]<previous||!(ticket.mode==='assault'?(ticket.assaultVersion>=2?['L','R','B','U0','U1','U2','U3','U4','U5']:['L','R','B','U0','U1','U2']):['L','R','B']).includes(e[1]))throw new APIError(400,'Invalid replay event.');previous=e[0]}
 const assault=ticket.mode==='assault',run=assault?createAssault(ticket.seed,ticket.assaultVersion||1):createRun(ticket.seed,ticket.mode);let index=0;
 for(let tick=0;tick<ticks;tick++){if(run.ended)throw new APIError(400,'Replay continues after the run ended.');while(index<events.length&&events[index][0]===tick){const action=events[index++][1];if(action.startsWith('U')){if(!chooseUpgrade(run,Number(action[1])))throw new APIError(400,'Invalid upgrade choice.')}else if(action==='B')(assault?nova:blast)(run);else(assault?moveAssault:move)(run,action==='L'?-1:1)}if(assault&&run.awaitingUpgrade)throw new APIError(400,'Missing upgrade choice.');(assault?stepAssault:step)(run);run.events=[]}
 if(!run.ended)throw new APIError(400,'Run has not ended.');
 return{score:Math.floor(run.score),shards:run.shards,duration:Math.round(run.time*1000),combo:run.bestCombo,won:run.won};
}
const breakers=new WeakMap(),boardCaches=new WeakMap();
async function withDB(env,action){if(!env.DB)throw new APIError(503,'Leaderboard is not configured.');if((breakers.get(env.DB)||0)>Date.now())throw new APIError(503,'Leaderboard is busy. Your local score is safe.');try{return await action(env.DB)}catch(e){breakers.set(env.DB,Date.now()+5000);throw new APIError(503,'Leaderboard is busy. Your local score is safe.')}}
function boardFor(mode,day,assaultVersion=1){return mode==='daily'?'daily:'+day:mode==='assault'?'assault-v'+assaultVersion:mode}
export async function handleAPI(request,env,context={waitUntil:()=>{}},now=Date.now()){
 try{
  const url=new URL(request.url),route=url.pathname;
  if(route==='/api/health'&&request.method==='GET')return reply({ok:true,version:VERSION,service:'rift-rush',onlineScores:!!(env.RUN_SIGNING_KEY&&env.DB)});
  if(request.method==='POST'){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)throw new APIError(403,'Cross-origin writes are not accepted.');
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new APIError(403,'Cross-site writes are not accepted.');
  }
  if(route==='/api/runs/start'&&request.method==='POST'){
   rateLimit(request,'start',now);const body=await readJSON(request);
   if(!['assault','rush','daily','endless'].includes(body.mode)||typeof body.playerId!=='string'||!/^[a-f0-9-]{36}$/.test(body.playerId))throw new APIError(400,'Invalid run request.');
   const assaultVersion=body.assaultVersion??1;if(![1,2,3].includes(assaultVersion))throw new APIError(400,'Unknown combat version.');
   const day=utcDay(new Date(now));const seed=body.mode==='daily'?hashSeed(`rift-${VERSION}-${day}`):(Number.isInteger(body.seed)&&body.seed>=0&&body.seed<=4294967295?body.seed:crypto.getRandomValues(new Uint32Array(1))[0]);
   const identity=request.headers.get('oai-authenticated-user-id')||body.playerId;
   const player=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env.RUN_SIGNING_KEY),enc.encode('player:'+identity)))).slice(0,22);
   const ticket={v:VERSION,id:crypto.randomUUID(),player,seed,mode:body.mode,assaultVersion,day,iat:now,exp:now+30*60000};
   return reply({token:await signTicket(ticket,env.RUN_SIGNING_KEY),seed,day,expiresAt:ticket.exp,alias:'Pilot-'+player.slice(0,6).toUpperCase()},201);
  }
  if(route==='/api/runs/finish'&&request.method==='POST'){
   rateLimit(request,'finish',now);const body=await readJSON(request),ticket=await verifyTicket(body.token,env.RUN_SIGNING_KEY,now),result=replayRun(ticket,body,now),board=boardFor(ticket.mode,ticket.day,ticket.assaultVersion||1);
   // One indexed UPSERT per player/board. Repeating an identical ticket is harmless.
   await withDB(env,db=>db.prepare('INSERT INTO best_scores (board, player, run_id, score, duration_ms, shards, combo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(board, player) DO UPDATE SET run_id=excluded.run_id, score=excluded.score, duration_ms=excluded.duration_ms, shards=excluded.shards, combo=excluded.combo, created_at=excluded.created_at WHERE excluded.score > best_scores.score').bind(board,ticket.player,ticket.id,result.score,result.duration,result.shards,result.combo,now).run());
   return reply({accepted:true,verified:result,alias:'Pilot-'+ticket.player.slice(0,6).toUpperCase(),board});
  }
  if(route==='/api/leaderboard'&&request.method==='GET'){
   const mode=url.searchParams.get('mode')||'daily';if(!['assault','rush','daily','endless'].includes(mode))throw new APIError(400,'Unknown mode.');
   const assaultVersion=Number(url.searchParams.get('av')||1);if(![1,2,3].includes(assaultVersion))throw new APIError(400,'Unknown combat version.');
   const day=utcDay(new Date(now)),board=boardFor(mode,day,assaultVersion),cacheKey=new Request(url.origin+'/api/leaderboard?mode='+mode+'&av='+assaultVersion+'&day='+day);
   // Some hosted Worker dispatch environments do not expose the Cache API.
   // Cache availability must never turn a healthy database into a failed board.
   let cache;try{cache=globalThis.caches?.default;const hit=await cache?.match(cacheKey);if(hit)return hit}catch{cache=undefined}
   const memory=env.DB&&boardCaches.get(env.DB),local=memory?.get(board);
   if(local&&local.expiresAt>now)return local.response.clone();
   const data=await withDB(env,db=>db.prepare('SELECT player,score,duration_ms,combo FROM best_scores WHERE board=? ORDER BY score DESC,created_at DESC LIMIT 25').bind(board).all());
   const response=reply({board,asOf:new Date(now).toISOString(),entries:(data.results||[]).map((r,i)=>({rank:i+1,alias:'Pilot-'+r.player.slice(0,6).toUpperCase(),score:r.score,duration:r.duration_ms,combo:r.combo}))},200,{'Cache-Control':'public, max-age=60, stale-while-revalidate=120'});
   if(env.DB){let entries=boardCaches.get(env.DB);if(!entries){entries=new Map();boardCaches.set(env.DB,entries)}if(entries.size>=6)entries.delete(entries.keys().next().value);entries.set(board,{expiresAt:now+60000,response:response.clone()})}
   if(cache){try{context.waitUntil(cache.put(cacheKey,response.clone()).catch(()=>{}))}catch{}}
   return response;
  }
  return reply({error:'Not found.'},404);
 }catch(e){const status=e instanceof APIError?e.status:500;return reply({error:e instanceof APIError?e.message:'Scores are temporarily unavailable. Your game still works.'},status,status===429||status===503?{'Retry-After':'60'}:{})}
}
