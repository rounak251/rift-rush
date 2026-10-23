import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssault,stepAssault,moveAssault,nova,chooseUpgrade,ASSAULT_LIMIT} from '../public/assault-legacy.js';
import {replayRun,signTicket,verifyTicket} from '../backend/service.mjs';
import {challengeURL,parseChallenge,STEP} from '../public/core.js';
export function fly(seed){const s=createAssault(seed),events=[];let ticks=0;
 while(!s.ended&&ticks<10000){
  if(s.awaitingUpgrade){const action=s.upgradeIndex===0?0:1;events.push([ticks,'U'+action]);chooseUpgrade(s,action)}
  const threats=s.bullets.filter(b=>b.z<.24).map(b=>b.lane).concat(s.enemies.filter(e=>e.z<.18).map(e=>e.lane));
  let target=s.boss?.lane??[...s.enemies].sort((a,b)=>a.z-b.z)[0]?.lane??s.lane;
  if(threats.includes(target))target=[0,1,2].find(l=>!threats.includes(l))??target;
  while(s.lane!==target){const d=target>s.lane?1:-1;events.push([ticks,d>0?'R':'L']);moveAssault(s,d)}
  if(s.energy>=99.99&&(s.enemies.length>=3||s.boss)){events.push([ticks,'B']);nova(s)}
  if(s.ended)break;
  stepAssault(s);s.events=[];ticks++;
 }
 return{s,ticks,events};
}
test('assault starts combat quickly and enemy variety changes across seeds',()=>{const s=createAssault(8);for(let i=0;i<120;i++)stepAssault(s);assert.ok(s.enemies.length||s.kills>0);assert.ok(s.shots.length>0);assert.equal(s.maxHull,5)});
test('upgrades pause the simulation and apply exactly one choice per checkpoint',()=>{const s=createAssault(1);s.time=17.999;stepAssault(s);assert.equal(s.awaitingUpgrade,true);const time=s.time;for(let i=0;i<100;i++)stepAssault(s);assert.equal(s.time,time);assert.equal(chooseUpgrade(s,0),true);assert.equal(s.damage,2);assert.equal(chooseUpgrade(s,0),false);assert.equal(chooseUpgrade(s,9),false)});
test('nova clears projectiles, destroys drones, and consumes energy',()=>{const s=createAssault(1);s.enemies=[{lane:1,z:.6,hp:3,kind:'armor'}];s.bullets=[{lane:1,z:.1}];assert.equal(nova(s),true);assert.equal(s.bullets.length,0);assert.equal(s.kills,1);assert.equal(nova(s),false);assert.ok(s.energy<100)});
test('shield upgrade repairs hull and absorbs one projectile',()=>{const s=createAssault(0);s.hull=2;s.awaitingUpgrade=true;chooseUpgrade(s,2);assert.equal(s.hull,4);assert.equal(s.shield,1);s.bullets=[{lane:1,z:.036,speed:1}];stepAssault(s);assert.equal(s.shield,0);assert.equal(s.hull,4)});
test('boss telegraphs blocked lanes and leaves its target lane safe',()=>{const s=createAssault(0);s.time=42;s.upgradeIndex=2;stepAssault(s);for(let i=0;i<300;i++)stepAssault(s);assert.ok(s.boss);assert.equal(s.boss.warning.lanes.length,2);assert.ok(!s.boss.warning.lanes.includes(s.boss.lane))});
test('a skilled pilot can defeat the boss across varied seeded formations',()=>{for(let seed=0;seed<40;seed++){const{s}=fly(seed);assert.equal(s.won,true,'seed '+seed);assert.ok(s.kills>=8);assert.ok(s.time<=ASSAULT_LIMIT);assert.equal(s.upgrades.length,2)}});
test('server replays combat and upgrade choices to the exact same score',()=>{const{ s,ticks,events}=fly(17);const ticket={seed:17,mode:'assault',iat:1000};const out=replayRun(ticket,{ticks,events},1000+ticks*STEP*1000+3000);assert.equal(out.score,Math.floor(s.score));assert.equal(out.won,true);assert.equal(out.shards,s.shards);assert.equal(out.combo,s.bestCombo)});
test('upgrade replay events cannot be injected before a checkpoint or in classic runs',()=>{assert.throws(()=>replayRun({seed:1,mode:'assault',iat:0},{ticks:10,events:[[0,'U0']]},10000));assert.throws(()=>replayRun({seed:1,mode:'rush',iat:0},{ticks:10,events:[[0,'U0']]},10000))});
test('assault challenge links retain mode while classic links stay compatible',()=>{const url=challengeURL('https://example.test',42,888,'assault');assert.deepEqual(parseChallenge(new URL(url).search),{seed:42,target:888,mode:'assault'});assert.deepEqual(parseChallenge('?seed=42&target=888&v=1'),{seed:42,target:888})});
