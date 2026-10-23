// k6: a complete run per virtual player, then submit its real deterministic replay.
// Large tests generate hosting charges. This script is not run automatically.
import http from 'k6/http';
import {sleep,check} from 'k6';
import {createRun,step,move} from '../public/core.js';
const users=Number(__ENV.USERS||50),base=__ENV.BASE_URL;
if(!base)throw Error('Set BASE_URL to your dedicated staging origin.');
if(users>500&&__ENV.ALLOW_COSTLY_LOAD_TEST!=='yes')throw Error('Large distributed tests require explicit hosting authorization; set ALLOW_COSTLY_LOAD_TEST=yes only after approval.');
export const options={scenarios:{players:{executor:'ramping-vus',startVUs:0,stages:[{duration:'2m',target:users},{duration:'10m',target:users},{duration:'2m',target:0}],gracefulRampDown:'90s'}},thresholds:{http_req_failed:['rate<0.001'],http_req_duration:['p(95)<500','p(99)<1000']}};
function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
const playerId=uuid();
export default function(){
 sleep(Math.random()*10);const headers={'Content-Type':'application/json',Origin:base};
 const start=http.post(base+'/api/runs/start',JSON.stringify({mode:'daily',playerId}),{headers});
 if(!check(start,{'ticket issued':r=>r.status===201})){sleep(60);return}
 const ticket=start.json(),s=createRun(ticket.seed,'daily'),events=[];let ticks=0;
 while(!s.ended){const row=s.rows.find(r=>!r.passed&&r.z<.2);if(row)while(s.lane!==row.safe){const d=row.safe>s.lane?1:-1;events.push([ticks,d===1?'R':'L']);move(s,d)}step(s);s.events=[];ticks++}
 sleep(61+Math.random()*15);
 const finish=http.post(base+'/api/runs/finish',JSON.stringify({token:ticket.token,ticks,events}),{headers});check(finish,{'score accepted':r=>r.status===200});
 if(Math.random()<.2)check(http.get(base+'/api/leaderboard?mode=daily'),{'board available':r=>r.status===200});
}
