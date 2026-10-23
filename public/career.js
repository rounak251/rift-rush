// Local, cosmetic progression. This never affects the ranked simulation.
export const RANKS=[
 {name:'Rookie',xp:0},{name:'Cadet',xp:300},{name:'Pilot',xp:900},
 {name:'Ace',xp:1800},{name:'Vanguard',xp:3200},{name:'Rift Master',xp:5200},{name:'Legend',xp:8000}
];
export const MEDALS=[
 {id:'clear',icon:'✧',name:'Warden breaker',goal:'Defeat the Warden',reward:10},
 {id:'chain',icon:'⋈',name:'Chain reaction',goal:'Reach a 20 kill chain',reward:15},
 {id:'surge',icon:'ϟ',name:'Live wire',goal:'Trigger 3 Overdrives in one run',reward:20},
 {id:'clean',icon:'⬡',name:'Untouchable',goal:'Win without taking hull damage',reward:25},
 {id:'speed',icon:'»',name:'Speed demon',goal:'Win in under 60 seconds',reward:20},
 {id:'build',icon:'⚒',name:'Tinkerer',goal:'Try all 6 upgrades across runs',reward:30}
];
const integer=(n,max=1000000)=>Math.min(max,Math.max(0,Math.floor(Number(n)||0)));
export function careerState(value){
 const v=value&&typeof value==='object'?value:{};
 return{xp:integer(v.xp),runs:integer(v.runs),wins:integer(v.wins),medals:MEDALS.filter(m=>Array.isArray(v.medals)&&v.medals.includes(m.id)).map(m=>m.id),builds:[...new Set((Array.isArray(v.builds)?v.builds:[]).filter(x=>Number.isInteger(x)&&x>=0&&x<6))],recent:(Array.isArray(v.recent)?v.recent:[]).filter(x=>typeof x==='string').slice(-20)};
}
export function rankFor(xp){
 let level=0;while(level+1<RANKS.length&&xp>=RANKS[level+1].xp)level++;
 const rank=RANKS[level],next=RANKS[level+1];
 return{...rank,level:level+1,next,progress:next?Math.min(1,Math.max(0,(xp-rank.xp)/(next.xp-rank.xp))):1};
}
export function settleCareer(value,run,id){
 const state=careerState(value),before=rankFor(state.xp);
 if(!run?.ended||run.mode!=='assault'||![2,3].includes(run.rules)||!id||state.recent.includes(id))return{state,xp:0,rewards:[],bonus:0,promoted:false};
 const xp=Math.min(1000,integer(run.time,75)*2+integer(run.kills,200)*3+(run.won?200:0));
 state.xp=integer(state.xp+xp);state.runs++;if(run.won)state.wins++;
 state.builds=[...new Set([...state.builds,...run.upgrades.filter(i=>Number.isInteger(i)&&i>=0&&i<6)])];
 const achieved={clear:run.won,chain:run.bestCombo>=20,surge:run.overdrives>=3,clean:run.won&&run.damageTaken===0,speed:run.won&&run.time<60,build:state.builds.length===6};
 const rewards=MEDALS.filter(m=>achieved[m.id]&&!state.medals.includes(m.id));
 state.medals.push(...rewards.map(m=>m.id));state.recent.push(id);state.recent=state.recent.slice(-20);
 return{state,xp,rewards,bonus:rewards.reduce((n,m)=>n+m.reward,0),promoted:rankFor(state.xp).level>before.level};
}
