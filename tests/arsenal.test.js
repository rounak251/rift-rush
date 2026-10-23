import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssault,stepAssault,moveAssault,nova,chooseUpgrade,upgradeOptions,SYNERGIES,synergyPreview,isGuarded} from '../public/assault.js';
import * as previous from '../public/assault-overdrive-v2.js';
import {replayRun,handleAPI} from '../backend/service.mjs';
import {challengeURL,parseChallenge} from '../public/core.js';

function fly(seed,rules=3){
 const s=createAssault(seed,rules),events=[];let ticks=0,eliteSeen=false,carrierSeen=false,swerverSeen=false;
 while(!s.ended&&ticks<10000){
  if(s.awaitingUpgrade){const offers=upgradeOptions(s),choice=offers.find(i=>synergyPreview(s,i))??[0,1,4,3,5,2].find(i=>offers.includes(i));events.push([ticks,'U'+choice]);chooseUpgrade(s,choice)}
  carrierSeen ||= s.enemies.some(e=>e.kind==='carrier');swerverSeen ||= s.enemies.some(e=>e.kind==='swerver');eliteSeen ||= s.enemies.some(e=>e.kind==='elite');
  const targetEnemy=s.enemies.find(e=>e.kind==='carrier')??s.enemies.find(e=>e.kind==='elite')??[...s.enemies].sort((a,b)=>a.z-b.z)[0];
  const threats=s.bullets.filter(b=>b.z<.24).map(b=>b.lane).concat(s.enemies.filter(e=>e.z<.18).map(e=>e.lane));
  let target=s.boss?.lane??targetEnemy?.lane??s.lane;if(threats.includes(target))target=[0,1,2].find(l=>!threats.includes(l))??target;
  while(s.lane!==target){const dir=target>s.lane?1:-1;events.push([ticks,dir>0?'R':'L']);moveAssault(s,dir)}
  if(s.energy>=99.99&&(s.enemies.length>=3||s.enemies.some(e=>['carrier','elite'].includes(e.kind))||s.boss)){events.push([ticks,'B']);nova(s)}
  stepAssault(s);s.events=[];ticks++;
 }
 return{s,ticks,events,eliteSeen,carrierSeen,swerverSeen};
}
const enemy=(kind,lane,z,hp=3)=>({kind,lane,z,hp,maxHP:hp,speed:0,fireAt:999,dead:false});
test('carrier shields block cannon shots and disappear when the carrier is destroyed',()=>{
 const s=createAssault(1);s.waveClock=999;s.shotClock=999;const carrier=enemy('carrier',0,.8,4),escort=enemy('scout',1,.5,1);s.enemies=[carrier,escort];s.shots=[{lane:1,z:.44,damage:3}];stepAssault(s);assert.equal(escort.hp,1);assert.equal(isGuarded(s,escort),true);carrier.dead=true;s.shots=[{lane:1,z:.44,damage:3}];stepAssault(s);assert.equal(escort.dead,true);
});
test('nova bypasses the carrier shield',()=>{const s=createAssault(1);s.enemies=[enemy('carrier',0,.8,4),enemy('scout',1,.5,1)];nova(s);assert.equal(s.kills,2);});
test('swerver lane changes wait for their visible warning',()=>{
 const s=createAssault(1);s.waveClock=999;s.shotClock=999;const e=enemy('swerver',0,.7,2);s.enemies=[e];stepAssault(s);assert.equal(e.shift.lane,1);for(let i=0;i<70;i++)stepAssault(s);assert.equal(e.lane,0);for(let i=0;i<20;i++)stepAssault(s);assert.equal(e.lane,1);assert.equal(e.shifted,true);
});
test('the elite telegraphs its aimed shot and grants its bonus exactly once',()=>{
 const s=createAssault(1);s.time=26;s.upgradeIndex=1;s.waveClock=999;stepAssault(s);const e=s.enemies.find(e=>e.kind==='elite');assert.ok(e);e.fireAt=s.time;stepAssault(s);assert.ok(e.warning);assert.equal(s.bullets.length,0);for(let i=0;i<105;i++)stepAssault(s);assert.ok(s.bullets.some(b=>b.kind==='elite'));
 e.hp=1;s.energy=100;nova(s);assert.equal(s.eliteKills,1);assert.equal(s.shield,1);s.energy=100;nova(s);assert.equal(s.eliteKills,1);assert.equal(s.shield,1);
});
test('every first upgrade has an achievable synergy in its second draft',()=>{
 for(let seed=0;seed<30;seed++)for(const first of upgradeOptions(createAssault(seed))){const s=createAssault(seed);s.awaitingUpgrade=true;chooseUpgrade(s,first);assert.ok(upgradeOptions(s).some(i=>synergyPreview(s,i)),'seed '+seed+' first '+first)}
});
test('all six synergies can be drafted and their combat effects work',()=>{
 for(const combo of SYNERGIES){let state;
  outer:for(let seed=0;seed<1000;seed++)for(const first of combo.pair){const s=createAssault(seed);if(!upgradeOptions(s).includes(first))continue;s.awaitingUpgrade=true;chooseUpgrade(s,first);const second=combo.pair.find(i=>i!==first);if(!upgradeOptions(s).includes(second))continue;s.awaitingUpgrade=true;chooseUpgrade(s,second);state=s;break outer;}
  assert.ok(state,combo.id);assert.deepEqual(state.synergies,[combo.id]);const s=state;s.waveClock=999;
  if(combo.id==='crossfire'){for(let i=0;i<65;i++)stepAssault(s);assert.ok(s.shots.some(b=>b.lane!==s.lane&&b.damage===4))}
  if(combo.id==='feedback'){s.enemies=[enemy('scout',1,.5,1)];nova(s);assert.equal(s.energy,16)}
  if(combo.id==='medic'){s.hull=2;s.pickups=Array.from({length:5},()=>({kind:'shard',lane:0,z:0}));stepAssault(s);assert.equal(s.hull,3)}
  if(combo.id==='aegis'){nova(s);assert.equal(s.invincible,.8)}
  if(combo.id==='breaker'){s.boss={hp:100,dead:false};s.enemies=[enemy('elite',1,.8,18)];nova(s);assert.equal(s.boss.hp,72);assert.equal(s.enemies[0].hp,4)}
  if(combo.id==='salvage'){s.energy=0;s.pickups=[{kind:'shard',lane:0,z:0}];stepAssault(s);assert.ok(s.energy>=6)}
 }
});
test('40 varied Arsenal runs remain winnable and reproduce exactly on the server',()=>{
 let carriers=0,swervers=0,elites=0;for(let seed=0;seed<40;seed++){const r=fly(seed);assert.equal(r.s.won,true,'seed '+seed);assert.equal(r.s.synergies.length,1);assert.ok(r.eliteSeen);carriers+=r.carrierSeen;swervers+=r.swerverSeen;elites+=r.s.eliteKills;const verified=replayRun({seed,mode:'assault',assaultVersion:3,iat:0},r,100000);assert.equal(verified.score,Math.floor(r.s.score))}assert.ok(carriers>30&&swervers>30&&elites>25);
});
test('version 2 dispatch and challenge links preserve the previous combat rules',()=>{
 const a=createAssault(17,2),b=previous.createAssault(17);for(let i=0;i<1000;i++){stepAssault(a);previous.stepAssault(b)}assert.deepEqual(a.enemies,b.enemies);assert.equal(a.score,b.score);
 for(const rules of [2,3])assert.deepEqual(parseChallenge(new URL(challengeURL('https://game.test',17,500,'assault',rules)).search),{seed:17,target:500,mode:'assault',rules});
});
test('Arsenal gets a separate bounded leaderboard',async()=>{let board;const DB={prepare:()=>({bind:x=>{board=x;return{all:async()=>({results:[]})}}})};const response=await handleAPI(new Request('https://game.test/api/leaderboard?mode=assault&av=3'),{DB});assert.equal(response.status,200);assert.equal(board,'assault-v3');});
