import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssault,stepAssault,moveAssault,nova,chooseUpgrade,upgradeOptions} from '../public/assault-overdrive-v2.js';
import * as legacy from '../public/assault-legacy.js';
import {careerState,settleCareer,rankFor} from '../public/career.js';
import {challengeURL,parseChallenge} from '../public/core.js';
import {replayRun,handleAPI,verifyTicket} from '../backend/service.mjs';

function pilot(seed){
 const s=createAssault(seed),events=[];let ticks=0,enraged=false;
 while(!s.ended&&ticks<10000){
  if(s.awaitingUpgrade){const choices=upgradeOptions(s),choice=[0,1,4,3,5,2].find(i=>choices.includes(i));events.push([ticks,'U'+choice]);chooseUpgrade(s,choice)}
  const threats=s.bullets.filter(b=>b.z<.24).map(b=>b.lane).concat(s.enemies.filter(e=>e.z<.18).map(e=>e.lane));
  let target=s.boss?.lane??[...s.enemies].sort((a,b)=>a.z-b.z)[0]?.lane??s.lane;
  if(threats.includes(target))target=[0,1,2].find(l=>!threats.includes(l))??target;
  while(s.lane!==target){const d=target>s.lane?1:-1;events.push([ticks,d>0?'R':'L']);moveAssault(s,d)}
  if(s.energy>=99.99&&(s.enemies.length>=3||s.boss)){events.push([ticks,'B']);nova(s)}
  stepAssault(s);enraged ||= s.boss?.phase===2;s.events=[];ticks++;
 }
 return{s,ticks,events,enraged};
}
test('eight chained kills trigger a bounded surge and double subsequent kill points',()=>{
 const s=createAssault(1);for(let i=0;i<9;i++){s.enemies=[{lane:1,z:.6,hp:1,kind:'scout'}];s.energy=100;nova(s)}
 assert.equal(s.overdrives,1);assert.equal(s.fever,6);assert.equal(s.heat,0);
 assert.equal(s.score,Array.from({length:8},(_,i)=>120+(i+1)*18).reduce((a,b)=>a+b,0)+(120+9*18)*2);
 s.enemies=[];s.bullets=[];s.waveClock=999;for(let i=0;i<721;i++)stepAssault(s);assert.equal(s.fever,0);
});
test('taking hull damage or letting a chain expire resets its charge',()=>{
 const s=createAssault(3);s.heat=7;s.combo=7;s.bullets=[{lane:1,z:0,speed:1}];stepAssault(s);assert.equal(s.heat,0);assert.equal(s.damageTaken,1);
 s.heat=6;s.combo=6;s.killClock=-10;stepAssault(s);assert.equal(s.heat,0);
});
test('drafts vary by seed, always include a repair choice, and reject unavailable upgrades',()=>{
 const drafts=new Set();for(let seed=0;seed<30;seed++){const s=createAssault(seed),options=upgradeOptions(s);drafts.add(options.join());assert.equal(new Set(options).size,3);assert.ok(options.includes(2));s.awaitingUpgrade=true;assert.equal(chooseUpgrade(s,[0,1,2,3,4,5].find(i=>!options.includes(i))),false);assert.equal(chooseUpgrade(s,options[0]),true)}assert.ok(drafts.size>5);
});
test('wingmen, reactor, and salvage field change combat without permanent stats',()=>{
 for(const index of [3,4,5]){let s;for(let seed=0;seed<100;seed++){s=createAssault(seed);if(upgradeOptions(s).includes(index))break}s.awaitingUpgrade=true;assert.equal(chooseUpgrade(s,index),true);
  if(index===3){for(let i=0;i<65;i++)stepAssault(s);assert.ok(s.shots.some(b=>b.lane!==s.lane))}
  if(index===4){assert.equal(s.recharge,22);s.boss={hp:100,dead:false};nova(s);assert.equal(s.boss.hp,82)}
  if(index===5){s.pickups=[{lane:0,z:0,kind:'shard'}];stepAssault(s);assert.equal(s.shards,1);assert.ok(s.score>=160)}
 }
 assert.equal(createAssault(1).wings,0);
});
test('non-stacking upgrades disappear once equipped',()=>{
 for(let seed=0;seed<100;seed++){const s=createAssault(seed);s.upgradeIndex=1;s.wings=1;s.magnet=true;assert.ok(!upgradeOptions(s).includes(3));assert.ok(!upgradeOptions(s).includes(5));assert.equal(new Set(upgradeOptions(s)).size,3)}
});
test('varied formations remain winnable, with a real second boss phase and exact replays',()=>{
 for(let seed=0;seed<40;seed++){const r=pilot(seed);assert.equal(r.s.won,true,'seed '+seed);assert.ok(r.enraged);assert.ok(r.s.overdrives>=1);const verified=replayRun({seed,mode:'assault',assaultVersion:2,iat:1000},r,100000);assert.equal(verified.score,Math.floor(r.s.score));}
});
test('old combat is frozen and old challenge URLs retain their original rules',()=>{
 const a=createAssault(17,1),b=legacy.createAssault(17);for(let i=0;i<1000;i++){stepAssault(a);legacy.stepAssault(b)}assert.equal(a.score,b.score);assert.deepEqual(a.enemies,b.enemies);
 assert.deepEqual(parseChallenge('?v=1&m=assault&seed=17&target=100'),{mode:'assault',seed:17,target:100});
 assert.deepEqual(parseChallenge(new URL(challengeURL('https://game.test',17,100,'assault',2)).search),{mode:'assault',rules:2,seed:17,target:100});
});
test('career rewards settle once and abandoned or legacy runs do not earn XP',()=>{
 const run={...pilot(17).s,won:true,damageTaken:0,time:55,overdrives:3};const first=settleCareer(null,run,'one');assert.ok(first.xp>300);assert.equal(first.promoted,true);assert.equal(first.rewards.length,5);
 const duplicate=settleCareer(first.state,run,'one');assert.equal(duplicate.xp,0);assert.equal(duplicate.bonus,0);
 const next=settleCareer(first.state,run,'two');assert.equal(next.bonus,0);assert.ok(next.xp>0);
 assert.equal(settleCareer(null,{...run,ended:false},'abandon').xp,0);assert.equal(settleCareer(null,{...run,rules:1},'legacy').xp,0);
});
test('career state handles invalid saves and unlocks the build medal once',()=>{
 assert.deepEqual(careerState({xp:-1,medals:['madeup'],builds:[99,-1,'0']}),careerState(null));assert.equal(rankFor(300).name,'Cadet');
 const run={...pilot(17).s,upgrades:[4,5]};const first=settleCareer({builds:[0,1,2,3]},run,'build');assert.ok(first.state.medals.includes('build'));assert.equal(settleCareer(first.state,run,'again').rewards.filter(m=>m.id==='build').length,0);
});
test('API tickets pin the requested rules and leaderboards isolate each version',async()=>{
 const secret='overdrive-unit-test-signing-only-123456789';
 const request=version=>new Request('https://game.test/api/runs/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:'01234567-1234-1234-1234-123456789012',mode:'assault',seed:17,...(version?{assaultVersion:version}:{})})});
 for(const version of [undefined,2]){const r=await handleAPI(request(version),{RUN_SIGNING_KEY:secret});assert.equal(r.status,201);const data=await r.json(),ticket=await verifyTicket(data.token,secret);assert.equal(ticket.assaultVersion,version||1)}
 const boards=[];const DB={prepare:()=>({bind:board=>{boards.push(board);return{all:async()=>({results:[]})}}})};
 for(const suffix of ['', '&av=2'])assert.equal((await handleAPI(new Request('https://game.test/api/leaderboard?mode=assault'+suffix),{DB})).status,200);
 assert.deepEqual(boards,['assault-v1','assault-v2']);assert.equal((await handleAPI(request(999),{RUN_SIGNING_KEY:secret})).status,400);
});
