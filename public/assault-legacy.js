// Frozen Assault 2.0 rules for old clients, replays, and challenge links.
import {rng,STEP} from './core.js';
export const ASSAULT_VERSION=1,ASSAULT_LIMIT=75;
export const UPGRADES=[
 {id:'power',name:'Twin cannon',icon:'Ⅱ',description:'+1 damage per shot. Melt armored drones and the boss.',color:'#ffcb69'},
 {id:'rapid',name:'Overclock',icon:'ϟ',description:'35% shorter shot delay. Recharge your nova bomb faster.',color:'#bda2ff'},
 {id:'shield',name:'Second wind',icon:'⬡',description:'Repair 2 hull and gain a shield that blocks one hit.',color:'#7bffdb'}
];
export function createAssault(seed){return{seed:seed>>>0,mode:'assault',rand:rng(seed),time:0,lane:1,hull:5,maxHull:5,shield:0,energy:100,score:0,shards:0,combo:0,bestCombo:0,dodges:0,blasts:0,destroyed:0,kills:0,invincible:0,pulse:0,events:[],ended:false,won:false,zone:0,rows:[],enemies:[],shots:[],bullets:[],pickups:[],shotClock:0,waveClock:.35,damage:1,fireInterval:.24,recharge:12,upgradeIndex:0,awaitingUpgrade:false,upgrades:[],boss:null,id:0,killClock:0,warning:null};}
export function moveAssault(s,dir){if(!s.ended&&!s.awaitingUpgrade)s.lane=Math.max(0,Math.min(2,s.lane+Math.sign(dir)));}
function hit(s){if(s.ended||s.invincible>0)return;if(s.shield>0){s.shield--;s.invincible=.65;s.events.push({type:'shield'});return}s.hull--;s.combo=0;s.invincible=1.1;s.events.push({type:'hit'});if(s.hull<=0)s.ended=true;}
function awardKill(s,e){if(e.dead)return;e.dead=true;s.kills++;s.destroyed++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.score+=120+Math.min(s.combo,20)*18;s.energy=Math.min(100,s.energy+8);s.killClock=s.time;s.events.push({type:'kill',lane:e.lane,z:e.z,kind:e.kind});s.pickups.push({lane:e.lane,z:e.z,kind:s.kills%11===0?'repair':s.kills%7===0?'charge':'shard'});}
export function nova(s){if(s.ended||s.awaitingUpgrade||s.energy<99.99)return false;s.energy=0;s.pulse=.65;s.blasts++;s.events.push({type:'blast'});for(const e of s.enemies){e.hp-=4;if(e.hp<=0)awardKill(s,e)}s.bullets=[];if(s.boss&&!s.boss.dead){s.boss.hp=Math.max(0,s.boss.hp-10);s.boss.flash=.15}return true;}
export function chooseUpgrade(s,index){if(s.ended||!s.awaitingUpgrade||![0,1,2].includes(index))return false;s.awaitingUpgrade=false;s.upgradeIndex++;s.upgrades.push(index);if(index===0)s.damage++;if(index===1){s.fireInterval*=.65;s.recharge+=5}if(index===2){s.hull=Math.min(s.maxHull,s.hull+2);s.shield++}s.events.push({type:'upgrade',index});return true;}
function win(s){if(s.ended)return;s.boss.dead=true;s.won=true;s.ended=true;s.score+=3000+s.hull*300+Math.ceil(ASSAULT_LIMIT-s.time)*40;s.shards+=15;s.events.push({type:'victory'});}
function spawnWave(s){
 const pattern=Math.floor(s.rand()*4),lane=Math.floor(s.rand()*3),wave=Math.floor(s.time/14);
 const spawn=(l,kind,z=1.05)=>s.enemies.push({id:s.id++,lane:l,z,kind,hp:kind==='armor'?3:1,maxHP:kind==='armor'?3:1,speed:kind==='dart'?.42:.21+wave*.025,fireAt:s.time+1.1,dead:false});
 if(pattern===0){spawn(lane,'dart');spawn((lane+1)%3,'dart',1.25)}
 else if(pattern===1){spawn(lane,'gunner');if(wave>0)spawn((lane+2)%3,'scout',1.24)}
 else if(pattern===2)spawn(lane,'armor');
 else{spawn(0,'scout');spawn(1,'scout',1.22);spawn(2,'scout',1.44)}
 s.waveClock+=Math.max(.85,1.65-s.time*.013);
}
function bossStep(s,dt){
 const b=s.boss;b.flash=Math.max(0,b.flash-dt);b.cycle+=dt;
 if(b.warning){b.warning.remaining-=dt;if(b.warning.remaining<=0){for(const lane of b.warning.lanes)s.bullets.push({lane,z:.82,speed:.72,kind:'boss'});s.events.push({type:'bossfire'});b.warning=null;}}
 if(b.cycle>=2.45&&!b.warning){b.cycle=0;const safe=Math.floor(s.rand()*3);b.warning={lanes:[0,1,2].filter(l=>l!==safe),remaining:1.05};b.lane=safe;}
}
export function stepAssault(s,dt=STEP){
 if(s.ended||s.awaitingUpgrade)return;
 s.time+=dt;if(s.boss&&s.boss.hp===0){win(s);return}s.zone=Math.min(2,Math.floor(s.time/18));s.invincible=Math.max(0,s.invincible-dt);s.pulse=Math.max(0,s.pulse-dt);s.energy=Math.min(100,s.energy+dt*s.recharge);s.score+=dt*12;
 if(s.time-s.killClock>4.5)s.combo=0;
 if(s.upgradeIndex<2&&s.time>=[18,34][s.upgradeIndex]){s.awaitingUpgrade=true;s.events.push({type:'choice'});return;}
 if(s.time<40&&s.time>=s.waveClock)spawnWave(s);
 if(s.time>=42&&!s.boss){s.boss={hp:78,maxHP:78,lane:1,cycle:0,warning:null,flash:0,dead:false};s.enemies=[];s.bullets=[];s.events.push({type:'boss'});}
 if(s.boss&&!s.boss.dead)bossStep(s,dt);
 s.shotClock-=dt;if(s.shotClock<=0){s.shotClock+=s.fireInterval;s.shots.push({lane:s.lane,z:.04,damage:s.damage});s.events.push({type:'shot'});}
 for(const e of s.enemies){if(e.dead)continue;e.z-=e.speed*dt;if(e.kind==='gunner'&&s.time>=e.fireAt&&e.z>.2){e.fireAt=s.time+1.8;s.bullets.push({lane:e.lane,z:e.z-.04,speed:.48,kind:'drone'});}
  if(e.z<=.035){if(e.lane===s.lane)hit(s);else s.dodges++;e.dead=true;}}
 for(const shot of s.shots){const before=shot.z;shot.z+=dt*1.9;
  const target=s.enemies.filter(e=>!e.dead&&e.lane===shot.lane&&e.z>=before-.07&&e.z<=shot.z+.07).sort((a,b)=>a.z-b.z)[0];
  if(target){target.hp-=shot.damage;shot.dead=true;s.events.push({type:'impact',lane:target.lane,z:target.z});if(target.hp<=0)awardKill(s,target)}
  else if(s.boss&&!s.boss.dead&&shot.z>=.82){if(shot.lane===s.boss.lane){s.boss.hp=Math.max(0,s.boss.hp-shot.damage);s.boss.flash=.09;s.score+=18;if(s.boss.hp===0)win(s)}shot.dead=true;}
 }
 for(const b of s.bullets){b.z-=b.speed*dt;if(b.z<=.035){if(b.lane===s.lane)hit(s);else{s.dodges++;s.score+=25}s.events.push({type:'pass',lane:b.lane});b.dead=true;}}
 for(const p of s.pickups){p.z-=dt*.44;if(p.z<=.045){if(p.lane===s.lane){if(p.kind==='repair'){s.hull=Math.min(s.maxHull,s.hull+1);s.events.push({type:'repair'})}else if(p.kind==='charge'){s.energy=100;s.events.push({type:'charge'})}else{s.shards++;s.score+=80;s.events.push({type:'gem',lane:p.lane})}}p.dead=true;}}
 s.enemies=s.enemies.filter(e=>!e.dead);s.shots=s.shots.filter(b=>!b.dead&&b.z<1.2);s.bullets=s.bullets.filter(b=>!b.dead);s.pickups=s.pickups.filter(p=>!p.dead);
 if(s.time>=ASSAULT_LIMIT&&!s.ended){s.time=ASSAULT_LIMIT;s.ended=true;s.events.push({type:'timeout'})}
}
