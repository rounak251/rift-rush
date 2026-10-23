export const STEP=1/120;
export const VERSION=1;
export function hashSeed(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export function utcDay(date=new Date()){return date.toISOString().slice(0,10)}
export function createRun(seed,mode='rush'){
 return {seed:seed>>>0,mode,rand:rng(seed),time:0,lane:1,hull:3,energy:100,score:0,shards:0,combo:0,bestCombo:0,dodges:0,blasts:0,destroyed:0,invincible:0,pulse:0,nextRow:1.8,rows:[],events:[],ended:false,won:false,zone:0,id:0};
}
export function move(s,dir){if(!s.ended)s.lane=Math.max(0,Math.min(2,s.lane+Math.sign(dir)))}
export function blast(s){if(s.ended||s.energy<99.99)return false;s.energy=0;s.pulse=.65;s.blasts++;s.events.push({type:'blast'});return true}
export function spawnRow(s){
 const safe=Math.floor(s.rand()*3),hard=s.rand()<(s.time>20?.5:.2),lanes=[0,1,2].filter(l=>l!==safe),blocked=hard?lanes:[lanes[Math.floor(s.rand()*2)]];
 const row={id:s.id++,z:1.15,safe,blocked,gem:s.rand()>.16?safe:-1,passed:false};s.rows.push(row);return row;
}
export function step(s,dt=STEP){
 if(s.ended)return;
 s.time+=dt;s.zone=Math.min(2,Math.floor(s.time/20));s.invincible=Math.max(0,s.invincible-dt);s.pulse=Math.max(0,s.pulse-dt);s.energy=Math.min(100,s.energy+dt*9);s.score+=dt*(18+s.zone*4);
 if(s.time>=s.nextRow){spawnRow(s);s.nextRow+=Math.max(.68,1.14-s.time*.006)}
 const speed=.30+Math.min(s.time,90)*.0020;
 for(const row of s.rows){
  row.z-=dt*speed;
  if(!row.passed&&s.pulse>0&&row.z<.35&&row.z>-.04&&row.blocked.length){s.destroyed+=row.blocked.length;s.score+=row.blocked.length*90;row.blocked=[];s.events.push({type:'destroy',lane:s.lane})}
  if(!row.passed&&row.z<=.035){
   row.passed=true;
   if(row.blocked.includes(s.lane)&&s.invincible<=0){s.hull--;s.combo=0;s.invincible=1.1;s.events.push({type:'hit'});if(s.hull<=0){s.ended=true;break}}
   else if(!row.blocked.includes(s.lane)){
    s.dodges++;if(row.gem===s.lane){s.shards++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.score+=75+Math.min(s.combo,20)*8;s.energy=Math.min(100,s.energy+5);s.events.push({type:'gem',lane:s.lane})}
    else{s.combo=0;s.score+=20}
   }
  }
 }
 s.rows=s.rows.filter(r=>r.z>-.18);
 if(s.mode!=='endless'&&s.time>=60){s.time=60;s.ended=true;s.won=s.hull>0;if(s.won)s.score+=s.hull*250}
}
export function challengeURL(origin,seed,score,mode='rush',rules=1){const u=new URL(origin);u.search='';u.hash='';u.searchParams.set('seed',String(seed>>>0));u.searchParams.set('target',String(Math.max(0,Math.min(99999999,Math.floor(score)))));u.searchParams.set('v',String(VERSION));if(mode==='assault'){u.searchParams.set('m','assault');if(rules===2)u.searchParams.set('av','2');}return u.href}
export function parseChallenge(search){const q=new URLSearchParams(search);if(q.get('v')!==String(VERSION)||!/^\d{1,10}$/.test(q.get('seed')||''))return null;const seed=Number(q.get('seed'));if(seed>4294967295)return null;const target=Number(q.get('target'));return{seed,target:Number.isFinite(target)?Math.max(0,Math.min(99999999,Math.floor(target))):0,...(q.get('m')==='assault'?{mode:'assault',...(q.get('av')==='2'?{rules:2}:{})}:{})}}
