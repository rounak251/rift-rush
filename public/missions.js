import {hashSeed,utcDay} from './core.js';

// Local cosmetic progression. These rewards never modify a ranked run's score.
const counters=['shards','destroyed','blasts','dodges','wins','bestCombo','bestTime'];
const safe=value=>Number.isFinite(value)?Math.max(0,Math.min(1000000,value)):0;
export function dailyMissions(day=utcDay()){
 const rotation=hashSeed('missions:'+day)%3;
 return [
  {id:'shards',title:'Shard hunter',description:'Collect 20 shards across your runs.',metric:'shards',target:20,reward:12,icon:'◇'},
  [
   {id:'barriers',title:'Break through',description:'Destroy 8 barriers with your pulse.',metric:'destroyed',target:8,reward:15,icon:'✦'},
   {id:'pulse',title:'Pulse pilot',description:'Release 4 pulses across your runs.',metric:'blasts',target:4,reward:15,icon:'✦'},
   {id:'dodges',title:'Find the gap',description:'Pass 25 rows without a hit.',metric:'dodges',target:25,reward:15,icon:'↗'}
  ][rotation],
  [
   {id:'flow',title:'Flow state',description:'Reach an 8× shard combo in one run.',metric:'bestCombo',target:8,reward:20,icon:'∞'},
   {id:'survive',title:'Stay sharp',description:'Survive 45 seconds in one run.',metric:'bestTime',target:45,reward:20,icon:'◷'},
   {id:'finish',title:'Through the rift',description:'Finish a 60-second Rush or Daily run.',metric:'wins',target:1,reward:20,icon:'◈'}
  ][rotation]
 ];
}
export function missionState(saved,day=utcDay()){
 const valid=saved?.day===day,stats={};
 for(const key of counters)stats[key]=valid?safe(saved.stats?.[key]):0;
 const ids=dailyMissions(day).map(m=>m.id);
 return {day,stats,claimed:valid&&Array.isArray(saved.claimed)?[...new Set(saved.claimed.filter(id=>ids.includes(id)))]:[],runs:valid&&Array.isArray(saved.runs)?saved.runs.filter(id=>typeof id==='string').slice(-32):[]};
}
export function missionRows(saved){
 const state=missionState(saved,saved.day);
 return dailyMissions(state.day).map(m=>({...m,value:Math.min(m.target,state.stats[m.metric]),complete:state.claimed.includes(m.id)}));
}
export function recordMissionRun(saved,run,id,day=utcDay()){
 const state=missionState(saved,day);
 if(!run?.ended||typeof id!=='string'||state.runs.includes(id))return{state,rewards:[],bonus:0};
 state.runs.push(id);state.runs=state.runs.slice(-32);
 for(const key of ['shards','destroyed','blasts','dodges'])state.stats[key]=safe(state.stats[key]+safe(run[key]));
 state.stats.wins+=run.won?1:0;
 state.stats.bestCombo=Math.max(state.stats.bestCombo,safe(run.bestCombo));
 state.stats.bestTime=Math.max(state.stats.bestTime,safe(run.time));
 const rewards=dailyMissions(day).filter(m=>!state.claimed.includes(m.id)&&state.stats[m.metric]>=m.target);
 state.claimed.push(...rewards.map(m=>m.id));
 return {state,rewards,bonus:rewards.reduce((sum,m)=>sum+m.reward,0)};
}
