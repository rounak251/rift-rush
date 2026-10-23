"""Play the Overdrive update with real controls, progression, and verified scoring."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:4188'
EXE=Path.home()/'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
checks=[]
def check(name,ok):
 checks.append({'test':name,'passed':bool(ok)});print(name,'PASS' if ok else 'FAIL',flush=True);assert ok,name
with sync_playwright()as p:
 b=p.chromium.launch(executable_path=str(EXE));c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/?seed=17&target=10000&v=1&m=assault&av=2');page.wait_for_load_state('networkidle')
 check('assault challenge selects the new mode',page.evaluate('riftQA().mode')=='assault');check('six career medals display',page.locator('.medal').count()==6);check('four modes remain available',page.locator('.mode').count()==4);page.screenshot(path=str(ROOT/'artifacts/overdrive-home-mobile.png'),full_page=True)
 page.locator('#play-btn').tap();page.wait_for_function('riftQA().time>0.3');deadline=time.monotonic()+100;upgrades=0;boss_seen=False;combat_shot=False;surge_seen=False;enrage_seen=False
 while time.monotonic()<deadline:
  s=page.evaluate('riftQA()')
  if s['finished']:break
  if s['paused']:page.locator('#resume-btn').click()
  if s['awaitingUpgrade']:
   check('upgrade panel opens at checkpoint '+str(upgrades+1),page.locator('#upgrade-overlay').is_visible())
   before=s['time'];page.wait_for_timeout(300);check('upgrade choice freezes combat '+str(upgrades+1),page.evaluate('riftQA().time')==before)
   if upgrades==0:page.screenshot(path=str(ROOT/'artifacts/overdrive-upgrade-mobile.png'))
   choice=next(i for i in [0,1,4,3,5,2] if i in s['options']);page.locator('[data-upgrade="'+str(choice)+'"]').tap();upgrades+=1;continue
  if s['fever']>0 and not surge_seen:
   check('Overdrive charge becomes an active timer',page.locator('#overdrive-hud').evaluate('(el)=>el.classList.contains("active")'));page.screenshot(path=str(ROOT/'artifacts/overdrive-surge-mobile.png'));surge_seen=True
  if s['boss'] and s['boss']['phase']==2 and not enrage_seen:
   check('boss changes to its second attack phase','ENRAGED' in page.locator('#boss-hud small').inner_text());page.screenshot(path=str(ROOT/'artifacts/overdrive-enraged-mobile.png'));enrage_seen=True
  if s['time']>7 and not combat_shot and len(s['enemies'])>=2:page.screenshot(path=str(ROOT/'artifacts/overdrive-combat-mobile.png'));combat_shot=True
  if s['boss'] and not boss_seen:
   check('boss has a visible health bar',page.locator('#boss-hud').is_visible());boss_seen=True
  if s['boss'] and s['boss']['warning'] and not (ROOT/'artifacts/overdrive-boss-mobile.png').exists():page.screenshot(path=str(ROOT/'artifacts/overdrive-boss-mobile.png'))
  threats=[r['lane']for r in s['bullets']if r['z']<.24]+[r['lane']for r in s['enemies']if r['z']<.18]
  target=s['boss']['lane']if s['boss']else min(s['enemies'],key=lambda e:e['z'])['lane']if s['enemies']else s['lane']
  if target in threats:target=next((lane for lane in range(3)if lane not in threats),target)
  for _ in range(abs(target-s['lane'])):page.keyboard.press('ArrowRight'if target>s['lane']else'ArrowLeft')
  if s['energy']>=99.99 and (len(s['enemies'])>=3 or s['boss']):page.keyboard.press('Space')
  page.wait_for_timeout(50)
 s=page.evaluate('riftQA()');check('both build choices applied',upgrades==2 and s['upgradeIndex']==2);check('boss was defeated through real controls',s['finished']and s['boss']['hp']==0)
 page.wait_for_function("document.getElementById('sync-status').textContent.includes('Verified & synced')",timeout=12000);check('server accepts actual combat replay','Verified & synced'in page.locator('#sync-status').inner_text());check('victory result describes the build','Warden destroyed' in page.locator('#result-heading').inner_text());page.screenshot(path=str(ROOT/'artifacts/overdrive-victory-mobile.png'))
 check('surge and enraged phase occurred',surge_seen and enrage_seen);check('career XP and medals awarded',page.locator('#career-result').is_visible() and ' XP · ' in page.locator('#earned-xp').inner_text() and page.evaluate("JSON.parse(localStorage.getItem('rift-rush-v1')).career.xp>300"));check('career promotes the pilot',page.locator('#pilot-rank').inner_text()=='Cadet');saved=page.evaluate("JSON.parse(localStorage.getItem('rift-rush-v1')).career");check('earned medals show on home',page.locator('.medal.earned').count()==len(saved['medals']));
 seed=s['seed'];page.locator('#new-sortie-btn').tap();page.wait_for_function('riftQA().time>0.1');check('new formation uses a different seed',page.evaluate('riftQA().seed')!=seed)
 page.locator('#pause-btn').tap();page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(100);box=page.locator('#touch-controls').bounding_box();check('landscape controls fit the viewport',box['y']+box['height']<=390);page.locator('#quit-btn').click()
 page.reload();page.wait_for_load_state('networkidle');check('career survives reload without duplicate rewards',page.evaluate("JSON.parse(localStorage.getItem('rift-rush-v1')).career")==saved);page.wait_for_function('navigator.serviceWorker.controller!==null');c.set_offline(True);page.reload();page.locator('#play-btn').click();page.wait_for_function('riftQA().time>1');check('assault plays offline',page.evaluate('riftQA().mode')=='assault');check('no browser runtime errors',not errors);b.close()
(ROOT/'artifacts/overdrive-browser-qa.json').write_text(json.dumps({'passed':all(x['passed']for x in checks),'checks':checks},indent=2))
