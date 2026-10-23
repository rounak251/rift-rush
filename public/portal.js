// Optional portal adapter. Standalone builds never fetch an advertising SDK.
export class Portal {
 constructor(){this.sdk=null;this.enabled=false;this.lastAd=0;this.runs=0;this.active=false;this.muted=false}
 async init(config){
  if(config.portal!=='crazygames')return false;
  try{
   await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://sdk.crazygames.com/crazygames-sdk-v3.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
   const sdk=window.CrazyGames?.SDK;if(!sdk)return false;await sdk.init();if(!['local','crazygames'].includes(sdk.environment))return false;
   this.sdk=sdk;this.enabled=config.adsEnabled===true;this.lastAd=Date.now();this.muted=!!sdk.game.settings?.muteAudio;
   sdk.game.addSettingsChangeListener?.(settings=>{this.muted=!!settings.muteAudio});return true;
  }catch{return false}
 }
 start(){if(this.active)return;this.active=true;try{this.sdk?.game.gameplayStart()}catch{}}
 stop(){if(!this.active)return;this.active=false;try{this.sdk?.game.gameplayStop()}catch{}}
 complete(){this.runs++;this.stop()}
 async betweenRuns({mute=()=>{},unmute=()=>{}}={}){
  // Never interrupt play. First opportunity after 3 runs AND 3 minutes.
  if(!this.sdk||!this.enabled||this.runs<3||Date.now()-this.lastAd<180000)return 'skipped';
  this.lastAd=Date.now();
  return new Promise(resolve=>{let done=false,timer;
   const end=status=>{if(done)return;done=true;clearTimeout(timer);unmute();resolve(status)};
   timer=setTimeout(()=>end('timeout'),12000);
   try{this.sdk.ad.requestAd('midgame',{adStarted:()=>{clearTimeout(timer);mute();timer=setTimeout(()=>end('timeout'),120000)},adFinished:()=>end('finished'),adError:()=>end('unavailable')})}catch{end('unavailable')}
  });
 }
}
export const portal=new Portal();
