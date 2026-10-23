"""Regression checks for the missions update and real mobile pointer controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:4188'
EXE=Path.home()/'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
checks=[]
def check(name,ok):
 checks.append({'test':name,'passed':bool(ok)});print(name,'PASS' if ok else 'FAIL',flush=True)
 assert ok,name
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path=str(EXE));c=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 s=c.new_page();errors=[];s.on('pageerror',lambda e:errors.append(str(e)));s.goto(BASE)
 # An existing version-1 save has no mission fields. Upgrade must keep its progress.
 s.evaluate("localStorage.setItem('rift-rush-v1',JSON.stringify({version:1,shards:26,skin:'violet',sound:false,reduced:true,runs:[],bests:{rush:1450,daily:0,endless:0},dailyBest:{}}))");s.reload();s.wait_for_load_state('networkidle');s.locator('[data-mode="rush"]').click()
 check('existing best and shards survive profile migration','1,450' in s.locator('#personal-best').inner_text() and '26 shards' in s.locator('#total-shards').inner_text())
 check('three daily missions display',s.locator('.mission-card').count()==3)
 s.locator('#play-btn').tap();s.wait_for_selector('#countdown',state='visible');s.keyboard.press('ArrowLeft');s.keyboard.press('Space')
 check('countdown freezes scoring and ignores gameplay inputs',s.evaluate('riftQA().time===0&&riftQA().lane===1&&riftQA().energy===100'))
 s.keyboard.press('p');before=s.evaluate('riftQA().readyLeft');s.wait_for_timeout(400)
 check('pausing freezes the countdown',s.evaluate('riftQA().readyLeft')==before)
 s.locator('#game-sound-btn').tap();check('sound is accessible while paused',s.locator('#game-sound-btn').get_attribute('aria-pressed')=='true');s.locator('#game-sound-btn').tap();s.locator('#resume-btn').tap();s.wait_for_function('riftQA().time>0.1')
 check('score target uses the saved personal best','CHASE YOUR BEST' in s.locator('#target-label').inner_text())
 box=s.locator('#touch-controls').bounding_box();check('all touch controls fit in the portrait viewport',box['y']>=0 and box['y']+box['height']<=844)
 check('gameplay does not scroll the document',s.evaluate('document.documentElement.scrollHeight<=innerHeight'))
 client=c.new_cdp_session(s)
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':270,'y':360}]});client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':220,'y':360}]})
 check('swipe steers before finger lift',s.evaluate('riftQA().lane')==0)
 client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});check('finger lift does not trigger another action',s.evaluate('riftQA().lane===0&&riftQA().energy===100'))
 s.locator('#right-btn').tap();s.locator('#blast-btn').tap();check('pulse charge feedback reflects a real blast',s.evaluate('riftQA().energy<10') and 'charged' not in (s.locator('#blast-btn').get_attribute('class') or ''))
 s.locator('#pause-btn').tap();s.set_viewport_size({'width':844,'height':390});s.wait_for_timeout(200);box=s.locator('#touch-controls').bounding_box()
 check('landscape controls stay on screen',box['y']>=0 and box['y']+box['height']<=390);s.screenshot(path=str(ROOT/'artifacts/improved-landscape-pause.png'))
 s.locator('#quit-btn').click();check('quitting restores the home layout',s.locator('.missions-section').is_visible() and 'in-run' not in (s.locator('body').get_attribute('class') or ''))
 check('abandoned run gives no mission rewards',s.evaluate("JSON.parse(localStorage.getItem('rift-rush-v1')).shards===26"))
 # Complete-run rewards are exercised by the core suite; here validate the saved UI.
 s.evaluate("""async()=>{const m=await import('/missions.js');const profile=JSON.parse(localStorage.getItem('rift-rush-v1'));const done=m.recordMissionRun(null,{ended:true,won:true,shards:25,destroyed:10,blasts:5,dodges:40,bestCombo:15,time:60},'fixture');profile.missions=done.state;localStorage.setItem('rift-rush-v1',JSON.stringify(profile))}""");s.reload();s.wait_for_load_state('networkidle')
 check('completed mission state survives a reload',s.locator('.mission-card.completed').count()==3)
 s.evaluate("const p=JSON.parse(localStorage.getItem('rift-rush-v1'));p.missions.day='2000-01-01';localStorage.setItem('rift-rush-v1',JSON.stringify(p))");s.reload();s.wait_for_load_state('networkidle');check('expired missions reset without deleting earned cosmetics',s.locator('.mission-card.completed').count()==0 and '26 shards' in s.locator('#total-shards').inner_text())
 check('no runtime errors',not errors);browser.close()
(ROOT/'artifacts/improvement-qa.json').write_text(json.dumps({'passed':all(x['passed']for x in checks),'checks':checks},indent=2))
