import {isGuarded} from './assault.js';
// Display-only renderer. Simulation and replay verification live in assault.js.
export function drawAssault(ctx,s,w,h,{color='#c4fa6d',accent='#5cffe0',reduced=false,lane=s.lane}={}){
 const palette=s.fever>0?['#23180e','#ffc66b','#ffedb3']:s.boss?['#190d25','#ff588f','#b88dff']:s.zone===1?['#171029','#bc8aff','#5cffe0']:['#071923','#4de5ff','#b6ff63'];
 const X=l=>w*(.20+l*.30),Y=z=>h*(.88-z*.70),unit=Math.min(w*.075,h*.055),t=s.time;
 const path=(points,fill,stroke,width=1)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}};
 ctx.save();const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#030810');bg.addColorStop(.55,palette[0]);bg.addColorStop(1,'#071014');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.5,h*.3,0,w*.5,h*.3,w*.65);glow.addColorStop(0,palette[1]+'16');glow.addColorStop(1,palette[1]+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 // A scrolling star field and circuit grid give the arena depth without hiding hazards.
 for(let i=0;i<72;i++){const x=((i*1597)%997)/997*w,y=(((i*311)%991)/991*h+t*(15+i%4*12))%h;ctx.fillStyle=i%3===0?palette[1]+'66':'#bcdce944';ctx.fillRect(x,y,1.2,reduced?1:2+i%3)}
 ctx.strokeStyle=palette[1]+'11';ctx.lineWidth=1;for(let i=0;i<15;i++){const y=(i*h/14+t*48)%h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}for(const f of [.05,.35,.65,.95]){ctx.beginPath();ctx.moveTo(w*f,0);ctx.lineTo(w*f,h);ctx.stroke()}
 const lg=ctx.createLinearGradient(0,h*.3,0,h*.95);lg.addColorStop(0,color+'00');lg.addColorStop(1,color+'17');ctx.fillStyle=lg;ctx.fillRect(X(lane)-w*.12,h*.25,w*.24,h*.7);
 // Boss attacks announce dangerous lanes before the projectiles launch.
 if(s.boss?.warning){for(const l of s.boss.warning.lanes){ctx.fillStyle='#ff5278'+(Math.floor(t*7)%2===0?'21':'12');ctx.fillRect(X(l)-w*.12,h*.2,w*.24,h*.75);ctx.strokeStyle='#ff698988';ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(X(l),h*.25);ctx.lineTo(X(l),h*.91);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff8da7';ctx.font=`bold ${Math.max(10,unit*.48)}px Arial`;ctx.textAlign='center';ctx.fillText('!',X(l),h*.78)}}
 // Tactical tells stay visible until the maneuver or aimed shot resolves.
 for(const e of s.enemies){
  if(e.shift){ctx.strokeStyle='#ffd37b';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(X(e.lane),Y(e.z));ctx.lineTo(X(e.shift.lane),Y(e.z));ctx.stroke();ctx.setLineDash([]);ctx.strokeRect(X(e.shift.lane)-unit*.55,Y(e.z)-unit*.55,unit*1.1,unit*1.1);ctx.fillStyle='#ffd37b';ctx.font=`bold ${unit*.7}px Arial`;ctx.textAlign='center';ctx.fillText(e.shift.lane>e.lane?'›':'‹',(X(e.lane)+X(e.shift.lane))/2,Y(e.z)-6);}
  if(e.kind==='elite'&&e.warning){ctx.fillStyle='#ffbc6522';ctx.fillRect(X(e.warning.lane)-w*.11,Y(e.z),w*.22,h*.86-Y(e.z));ctx.strokeStyle='#ffbc65';ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(X(e.warning.lane),Y(e.z));ctx.lineTo(X(e.warning.lane),h*.88);ctx.stroke();ctx.setLineDash([]);}
 }
 // Floating shard, repair, and charge pickups have distinct shapes and colors.
 for(const p of s.pickups){const x=X(p.lane),y=Y(p.z),r=unit*.33;ctx.save();ctx.translate(x,y);ctx.shadowColor=p.kind==='repair'?'#65ffb0':p.kind==='charge'?'#c89bff':color;ctx.shadowBlur=reduced?0:12;
  if(p.kind==='shard')path([[0,-r],[r*.7,0],[0,r],[-r*.7,0]],color,'#f0ffe0');
  else{ctx.fillStyle='#09211c';ctx.strokeStyle=ctx.shadowColor;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=ctx.shadowColor;ctx.font=`bold ${r*2}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.kind==='repair'?'+':'ϟ',0,0)}ctx.restore();}
 for(const b of s.shots){const x=X(b.lane),y=Y(b.z);ctx.shadowColor=s.fever>0?'#ffd875':accent;ctx.shadowBlur=reduced?0:10;ctx.fillStyle=s.fever>0?'#fff0ae':accent;if(s.damage>1){ctx.fillRect(x-5,y,3,unit*.7);ctx.fillRect(x+3,y,3,unit*.7)}else ctx.fillRect(x-2,y,4,unit*.75)}ctx.shadowBlur=0;
 for(const e of s.enemies){const x=X(e.lane),y=Y(e.z),r=unit*(e.kind==='elite'?1.55:e.kind==='carrier'?1.15:e.kind==='armor'?1.1:.8);ctx.save();ctx.translate(x,y);ctx.shadowColor=e.kind==='carrier'?'#69deff':['elite','swerver'].includes(e.kind)?'#ffd37b':e.kind==='armor'?'#ffb85c':e.kind==='gunner'?'#e47cff':'#ff668b';ctx.shadowBlur=reduced?0:9;
  if(e.kind==='elite'){path([[-r,-r*.4],[-r*.6,-r],[r*.6,-r],[r,-r*.4],[r*.6,r],[0,r*.55],[-r*.6,r]],'#302114','#ffcd77',3);path([[-r*.4,-r*.2],[0,-r*.6],[r*.4,-r*.2],[0,r*.35]],'#ffcf85');}
  else if(e.kind==='carrier'){path([[0,-r],[r*.85,-r*.5],[r*.85,r*.5],[0,r],[-r*.85,r*.5],[-r*.85,-r*.5]],'#102e3c','#69deff',2);ctx.fillStyle='#a0f1ff';ctx.beginPath();ctx.arc(0,0,r*.34,0,Math.PI*2);ctx.fill();}
  else if(e.kind==='swerver'){path([[0,r],[r,-r],[0,-r*.4],[-r,-r]],'#302515','#ffd37b',2);}
  else if(e.kind==='dart')path([[0,r],[r,-r*.6],[r*.35,-r*.4],[0,-r],[-r*.35,-r*.4],[-r,-r*.6]],'#2c142e',ctx.shadowColor,2);
  else{path([[-r,-r*.5],[-r*.6,-r],[r*.6,-r],[r,-r*.5],[r*.65,r*.6],[0,r],[-r*.65,r*.6]],e.kind==='armor'?'#302315':'#24142f',ctx.shadowColor,2);path([[-r*.45,-r*.3],[0,-r*.65],[r*.45,-r*.3],[0,r*.3]],ctx.shadowColor);}
  if(isGuarded(s,e)){ctx.strokeStyle='#69deffb0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.stroke()}
  ctx.shadowBlur=0;if(e.maxHP>1){ctx.fillStyle='#ffffff25';ctx.fillRect(-r,r+6,r*2,3);ctx.fillStyle='#ffbb67';ctx.fillRect(-r,r+6,r*2*e.hp/e.maxHP,3)}ctx.restore();}
 for(const b of s.bullets){const x=X(b.lane),y=Y(b.z),r=b.kind==='boss'?unit*.28:unit*.18;ctx.shadowColor='#ff426e';ctx.shadowBlur=reduced?0:12;ctx.fillStyle=b.kind==='boss'?'#ff80a1':'#ffb48c';ctx.beginPath();ctx.ellipse(x,y,r,r*1.6,0,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
 if(s.boss&&!s.boss.dead){const b=s.boss,x=X(b.lane),y=Y(.87),r=unit*1.8;ctx.save();ctx.translate(x,y);ctx.shadowColor='#ff6fba';ctx.shadowBlur=reduced?0:22;path([[-r*1.9,-r*.2],[-r*1.5,-r],[-r*.65,-r*.6],[0,-r],[r*.65,-r*.6],[r*1.5,-r],[r*1.9,-r*.2],[r*.85,r*.5],[r*.45,r],[0,r*.6],[-r*.45,r],[-r*.85,r*.5]],b.flash>0?'#ffe5f4':'#28132d','#ff73b4',2);if(b.phase===2){ctx.strokeStyle='#ffb56f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.8,reduced?0:t*2,(reduced?0:t*2)+Math.PI*1.6);ctx.stroke()}ctx.fillStyle=b.phase===2?'#ffb56f':'#fa90ff';ctx.beginPath();ctx.arc(0,0,r*.35,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffb1df';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.6,0,Math.PI*2);ctx.stroke();ctx.restore();}
 // Player ship: engine exhaust, visible shield, and a bank toward the next lane.
 const x=X(lane),y=Y(0),r=unit*.85;
 if(s.fever>0){ctx.strokeStyle='#ffc66b88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,unit*(reduced?1.7:1.7+Math.sin(t*6)*.1),0,Math.PI*2);ctx.stroke()}
 if(s.wings>0){for(const side of [-1,1]){const xx=x+side*unit*1.7,yy=y+unit*.3;path([[xx,yy-unit*.6],[xx+unit*.35,yy+unit*.3],[xx-unit*.35,yy+unit*.3]],'#17353c','#69deff',2)}}ctx.save();ctx.translate(x,y);ctx.rotate((s.lane-lane)*-.12);
 const exhaust=ctx.createLinearGradient(0,r*.4,0,r*2.2);exhaust.addColorStop(0,accent+'c0');exhaust.addColorStop(1,accent+'00');path([[-r*.3,r*.35],[r*.3,r*.35],[0,r*(reduced?1.6:2+Math.sin(t*40)*.15)]],exhaust);
 if(s.invincible<=0||Math.floor(t*14)%2===0){ctx.shadowColor=color;ctx.shadowBlur=reduced?0:12;path([[0,-r*1.3],[r,r*.6],[r*.35,r*.35],[0,r*.08],[-r*.35,r*.35],[-r,r*.6]],'#163b41',color,2);path([[0,-r],[r*.21,0],[0,r*.18],[-r*.21,0]],color)}
 if(s.shield>0){ctx.strokeStyle='#7bffdb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.6,0,Math.PI*2);ctx.stroke()}ctx.restore();
 if(s.pulse>0){const life=s.pulse/.65;ctx.strokeStyle=`rgba(159,255,221,${life})`;ctx.lineWidth=4;ctx.shadowColor=accent;ctx.shadowBlur=reduced?0:20;ctx.beginPath();ctx.ellipse(x,y,(1-life)*w*1.6+20,(1-life)*h*1.6+20,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
 // Event particles are a visual projection of deterministic recent combat events.
 ctx.strokeStyle=palette[1]+'44';ctx.lineWidth=2;ctx.strokeRect(1,1,w-2,h-2);ctx.restore();
}
