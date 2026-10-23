import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMissions,missionState,missionRows,recordMissionRun} from '../public/missions.js';
const day='2026-10-23';
const completed={ended:true,won:true,shards:25,destroyed:10,blasts:5,dodges:40,bestCombo:15,time:60};
test('daily goals are stable, bounded, and rotate across dates',()=>{
 assert.deepEqual(dailyMissions(day),dailyMissions(day));
 const sets=new Set();for(let d=1;d<=28;d++){const goals=dailyMissions(`2026-10-${String(d).padStart(2,'0')}`);assert.equal(goals.length,3);sets.add(goals.map(g=>g.id).join(','));assert.ok(goals.every(g=>g.target>0&&g.reward>0))}assert.equal(sets.size,3);
});
test('rewards add cosmetics once and never mutate ranked run statistics',()=>{
 const run={...completed,score:7000},before=JSON.stringify(run),first=recordMissionRun(null,run,'run-one',day);
 assert.equal(first.bonus,47);assert.equal(first.rewards.length,3);assert.equal(JSON.stringify(run),before);
 const duplicate=recordMissionRun(first.state,run,'run-one',day);assert.equal(duplicate.bonus,0);assert.deepEqual(duplicate.state,first.state);
 assert.equal(recordMissionRun(first.state,run,'run-two',day).bonus,0);
});
test('progress accumulates while combo and survival goals use the best single run',()=>{
 let state=missionState(null,day);for(let i=0;i<3;i++)state=recordMissionRun(state,{...completed,shards:4,bestCombo:3,time:20,won:false},String(i),day).state;
 assert.equal(state.stats.shards,12);assert.equal(state.stats.bestCombo,3);assert.equal(state.stats.bestTime,20);assert.equal(missionRows(state)[0].value,12);
});
test('abandoned runs earn nothing and a UTC rollover resets goals',()=>{
 assert.equal(recordMissionRun(null,{...completed,ended:false},'quit',day).bonus,0);
 const first=recordMissionRun(null,completed,'run',day);const next=missionState(first.state,'2026-10-24');assert.equal(next.claimed.length,0);assert.equal(next.stats.shards,0);
 assert.equal(recordMissionRun(next,completed,'run-next','2026-10-24').bonus,47);
});
test('old or malformed profiles migrate and stored run history remains bounded',()=>{
 const state=missionState({day,stats:{shards:Infinity,blasts:-1,bestCombo:'oops'},claimed:['bad'],runs:[]},day);assert.equal(state.stats.shards,0);assert.equal(state.stats.blasts,0);assert.deepEqual(state.claimed,[]);
 let current=state;for(let i=0;i<100;i++)current=recordMissionRun(current,completed,String(i),day).state;assert.equal(current.runs.length,32);assert.equal(current.claimed.length,3);
});
