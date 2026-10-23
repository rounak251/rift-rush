import {rng,STEP} from './core.js';
import * as legacy from './assault-legacy.js';
export const ASSAULT_VERSION=2,ASSAULT_LIMIT=75;
export const UPGRADES=[
 {id:'power',name:'Twin cannon',icon:'Ⅱ',description:'+1 damage per shot. Melt armored drones and the boss.',color:'#ffcb69'},
 {id:'rapid',name:'Overclock',icon:'ϟ',description:'35% shorter shot delay. Recharge your nova bomb faster.',color:'#bda2ff'},
 {id:'shield',name:'Second wind',icon:'⬡',description:'Repair 2 hull and gain a shield that blocks one hit.',color:'#7bffdb'},
 {id:'wings',name:'Wingmen',icon:'⋔',description:'Every third volley fires into all three lanes.',color:'#69deff'},
 {id:'reactor',name:'Nova reactor',icon:'✹',description:'+10 nova recharge per second. Bombs hit harder.',color:'#ff9477'},
 {id:'magnet',name:'Salvage field',icon:'◇',description:'Collect pickups from every lane. Shards score double.',color:'#f5e698'}
];
export function createAssault(seed,rules=ASSAULT_VERSION){if(rules===1)return{...legacy.createAssault(seed),rules:1};return{rules:2,fever:0,heat:0,overdrives:0,damageTaken:0,volleys:0,wings:0,novaDamage:4,magnet:false,seed:seed>>>0,mode:'assault',rand:rng(seed),time:0,lane:1,hull:5,maxHull:5,shield:0,energy:100,score:0,shards:0,combo:0,bestCombo:0,dodges:0,blasts:0,destroyed:0,kills:0,invincible:0,pulse:0,events:[],ended:false,won:false,zone:0,rows:[],enemies:[],shots:[],bullets:[],pickups:[],shotClock:0,waveClock:.35,damage:1,fireInterval:.24,recharge:12,upgradeIndex:0,awaitingUpgrade:false,upgrades:[],boss:null,id:0,killClock:0,warning:null};}
export function moveAssault(s,dir){if(s.rules===1)return legacy.moveAssault(s,dir);if(!s.ended&&!s.awaitingUpgrade)s.lane=Math.max(0,Math.min(2,s.lane+Math.sign(dir)));}
function hit(s){if(s.ended||s.invincible>0)return;if(s.shield>0){s.shield--;s.invincible=.65;s.events.push({type:'shield'});return}s.hull--;s.damageTaken++;s.combo=0;s.heat=0;s.invincible=1.1;s.events.push({type:'hit'});if(s.hull<=0)s.ended=true;}
function awardKill(s,e){if(e.dead)return;e.dead=true;s.kills++;s.destroyed++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.score+=(120+Math.min(s.combo,20)*18)*(s.fever>0?2:1);if(s.fever<=0){s.heat++;if(s.heat>=8){s.heat=0;s.fever=6;s.overdrives++;s.events.push({type:'overdrive'})}}s.energy=Math.min(100,s.energy+8);s.killClock=s.time;s.events.push({type:'kill',lane:e.lane,z:e.z,kind:e.kind});s.pickups.push({lane:e.lane,z:e.z,kind:s.kills%11===0?'repair':s.kills%7===0?'charge':'shard'});}
export function nova(s){if(s.rules===1)return legacy.nova(s);if(s.ended||s.awaitingUpgrade||s.energy<99.99)return false;s.energy=0;s.pulse=.65;s.blasts++;s.events.push({type:'blast'});for(const e of s.enemies){e.hp-=s.novaDamage;if(e.hp<=0)awardKill(s,e)}s.bullets=[];if(s.boss&&!s.boss.dead){s.boss.hp=Math.max(0,s.boss.hp-(s.novaDamage===4?10:18));s.boss.flash=.15}return true;}
export function upgradeOptions(s){
 if(s.rules===1)return[0,1,2];
 const roll=rng((s.seed^Math.imul(s.upgradeIndex+1,0x9e3779b9))>>>0);
 const attack=[0,1,3,4].filter(i=>i!==3||!s.wings);for(let i=attack.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[attack[i],attack[j]]=[attack[j],attack[i]]}
 // Every checkpoint offers a damage path and a repair path; the third changes the build.
 return[attack[0],roll()<.3&&!s.magnet?5:attack[1],2];
}
export function chooseUpgrade(s,index){
 if(s.rules===1)return legacy.chooseUpgrade(s,index);
 if(s.ended||!s.awaitingUpgrade||!upgradeOptions(s).includes(index))return false;
 s.awaitingUpgrade=false;s.upgradeIndex++;s.upgrades.push(index);
 if(index===0)s.damage++;
 if(index===1){s.fireInterval*=.65;s.recharge+=5}
 if(index===2){s.hull=Math.min(s.maxHull,s.hull+2);s.shield++}
 if(index===3)s.wings++;
 if(index===4){s.recharge+=10;s.novaDamage+=2}
 if(index===5)s.magnet=true;
 s.events.push({type:'upgrade',index});return true;
}
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
 if(b.phase===1&&b.hp<=b.maxHP*.5){b.phase=2;b.warning=null;b.cycle=0;s.bullets=[];s.events.push({type:'enrage'})}
 if(b.warning){b.warning.remaining-=dt;if(b.warning.remaining<=0){for(const lane of b.warning.lanes)s.bullets.push({lane,z:.82,speed:b.phase===2?.8:.72,kind:'boss'});s.events.push({type:'bossfire'});b.warning=null;}}
 if(b.cycle>=(b.phase===2?2:2.45)&&!b.warning){
  b.cycle=0;b.attack++;b.lane=Math.floor(s.rand()*3);
  // In phase two the core can be in a danger lane: aim, then dodge the telegraph.
  const safe=b.phase===2&&b.attack%2===0?(b.lane+1)%3:b.lane;
  b.warning={lanes:[0,1,2].filter(l=>l!==safe),remaining:b.phase===2?.85:1.05};
 }
}
export function stepAssault(s,dt=STEP){
 if(s.rules===1)return legacy.stepAssault(s,dt);
 if(s.ended||s.awaitingUpgrade)return;
 s.fever=Math.max(0,s.fever-dt);s.time+=dt;if(s.boss&&s.boss.hp===0){win(s);return}s.zone=Math.min(2,Math.floor(s.time/18));s.invincible=Math.max(0,s.invincible-dt);s.pulse=Math.max(0,s.pulse-dt);s.energy=Math.min(100,s.energy+dt*s.recharge);s.score+=dt*12;
 if(s.time-s.killClock>4.5){s.combo=0;s.heat=0}
 if(s.upgradeIndex<2&&s.time>=[18,34][s.upgradeIndex]){s.awaitingUpgrade=true;s.events.push({type:'choice'});return;}
 if(s.time<40&&s.time>=s.waveClock)spawnWave(s);
 if(s.time>=42&&!s.boss){s.boss={hp:120,maxHP:120,phase:1,attack:0,lane:1,cycle:0,warning:null,flash:0,dead:false};s.enemies=[];s.bullets=[];s.events.push({type:'boss'});}
 if(s.boss&&!s.boss.dead)bossStep(s,dt);
 s.shotClock-=dt;if(s.shotClock<=0){s.shotClock+=s.fireInterval*(s.fever>0?.6:1);s.volleys++;const lanes=s.wings>0&&s.volleys%Math.max(1,4-s.wings)===0?[0,1,2]:[s.lane];for(const lane of lanes)s.shots.push({lane,z:.04,damage:s.damage});s.events.push({type:'shot'});}
 for(const e of s.enemies){if(e.dead)continue;e.z-=e.speed*dt;if(e.kind==='gunner'&&s.time>=e.fireAt&&e.z>.2){e.fireAt=s.time+1.8;s.bullets.push({lane:e.lane,z:e.z-.04,speed:.48,kind:'drone'});}
  if(e.z<=.035){if(e.lane===s.lane)hit(s);else s.dodges++;e.dead=true;}}
 for(const shot of s.shots){const before=shot.z;shot.z+=dt*1.9;
  const target=s.enemies.filter(e=>!e.dead&&e.lane===shot.lane&&e.z>=before-.07&&e.z<=shot.z+.07).sort((a,b)=>a.z-b.z)[0];
  if(target){target.hp-=shot.damage;shot.dead=true;s.events.push({type:'impact',lane:target.lane,z:target.z});if(target.hp<=0)awardKill(s,target)}
  else if(s.boss&&!s.boss.dead&&shot.z>=.82){if(shot.lane===s.boss.lane){s.boss.hp=Math.max(0,s.boss.hp-shot.damage);s.boss.flash=.09;s.score+=18;if(s.boss.hp===0)win(s)}shot.dead=true;}
 }
 for(const b of s.bullets){b.z-=b.speed*dt;if(b.z<=.035){if(b.lane===s.lane)hit(s);else{s.dodges++;s.score+=25}s.events.push({type:'pass',lane:b.lane});b.dead=true;}}
 for(const p of s.pickups){p.z-=dt*.44;if(p.z<=.045){if(p.lane===s.lane||s.magnet){if(p.kind==='repair'){s.hull=Math.min(s.maxHull,s.hull+1);s.events.push({type:'repair'})}else if(p.kind==='charge'){s.energy=100;s.events.push({type:'charge'})}else{s.shards++;s.score+=s.magnet?160:80;s.events.push({type:'gem',lane:p.lane})}}p.dead=true;}}
 s.enemies=s.enemies.filter(e=>!e.dead);s.shots=s.shots.filter(b=>!b.dead&&b.z<1.2);s.bullets=s.bullets.filter(b=>!b.dead);s.pickups=s.pickups.filter(p=>!p.dead);
 if(s.time>=ASSAULT_LIMIT&&!s.ended){s.time=ASSAULT_LIMIT;s.ended=true;s.events.push({type:'timeout'})}
}
