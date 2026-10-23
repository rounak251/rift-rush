import test from 'node:test';
import assert from 'node:assert/strict';
import {Portal} from '../public/portal.js';
test('standalone and Basic Launch never request ads',async()=>{const p=new Portal();assert.equal(await p.init({portal:'standalone'}),false);p.sdk={ad:{requestAd:()=>{throw new Error('must not run')}}};p.runs=8;p.lastAd=0;assert.equal(await p.betweenRuns(),'skipped')});
test('an unfilled ad immediately releases the next run',async()=>{const p=new Portal();p.sdk={ad:{requestAd:(type,c)=>c.adError({code:'unfilled'})}};p.enabled=true;p.runs=3;p.lastAd=0;let resumed=0;assert.equal(await p.betweenRuns({unmute:()=>resumed++}),'unavailable');assert.equal(resumed,1)});
test('finished ad mutes and restores audio exactly once',async()=>{const p=new Portal();p.sdk={ad:{requestAd:(type,c)=>{c.adStarted();c.adFinished();c.adError({})}}};p.enabled=true;p.runs=4;p.lastAd=0;let muted=0,resumed=0;assert.equal(await p.betweenRuns({mute:()=>muted++,unmute:()=>resumed++}),'finished');assert.equal(muted,1);assert.equal(resumed,1);assert.equal(await p.betweenRuns(),'skipped')});
test('lifecycle starts and stops once per transition',()=>{const p=new Portal();let starts=0,stops=0;p.sdk={game:{gameplayStart:()=>starts++,gameplayStop:()=>stops++}};p.start();p.start();p.complete();p.stop();assert.equal(starts,1);assert.equal(stops,1);assert.equal(p.runs,1)});
