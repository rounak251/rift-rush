"""Real browser checks; drives actual keyboard/touch inputs, no game-state mutation."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, time

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:4188'
EXE=Path.home()/'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
results=[]
def check(name,ok,details=None):
    results.append({'test':name,'passed':bool(ok),'details':details})
    print(name, 'PASS' if ok else 'FAIL',flush=True)
    if not ok: raise AssertionError((name,details))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=str(EXE))
    context=browser.new_context(viewport={'width':1440,'height':1100},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE);page.wait_for_load_state('networkidle')
    check('desktop fits viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.screenshot(path=str(ROOT/'artifacts/desktop-home.png'),full_page=True)
    page.locator('#how-btn').click();check('instructions dialog opens',page.locator('#info-dialog').is_visible());page.locator('.dialog-close').click()
    page.locator('#hangar-btn').click();check('three skins start locked',page.locator('.skin-option:disabled').count()==3);page.locator('.dialog-close').click()
    page.locator('#play-btn').click();page.wait_for_function('window.riftQA()?.time>0.1');page.wait_for_timeout(1300);page.keyboard.press('ArrowLeft');check('keyboard steering',page.evaluate('riftQA().lane')==0)
    page.keyboard.press('ArrowRight');page.keyboard.press('Space');check('pulse consumes charge',page.evaluate('riftQA().energy')<10)
    page.keyboard.press('p');before=page.evaluate('riftQA().time');page.wait_for_timeout(450);check('pause freezes simulation',page.evaluate('riftQA().time')==before)
    page.locator('#resume-btn').click();page.wait_for_timeout(200);check('resume continues simulation',page.evaluate('riftQA().time')>before)
    # Pilot the complete run using public keyboard events and read-only observation.
    deadline=time.monotonic()+85;screenshot=False
    while time.monotonic()<deadline:
        s=page.evaluate('riftQA()')
        if s['finished']:break
        if s['paused']:page.locator('#resume-btn').click()
        upcoming=[r for r in s['rows'] if -.01<r['z']<.23]
        if upcoming:
            target=min(upcoming,key=lambda r:r['z'])['safe']
            for _ in range(abs(target-s['lane'])):page.keyboard.press('ArrowRight' if target>s['lane'] else 'ArrowLeft')
        if s['time']>27 and not screenshot:page.screenshot(path=str(ROOT/'artifacts/desktop-gameplay.png'));screenshot=True
        page.wait_for_timeout(70)
    s=page.evaluate('riftQA()');check('complete 60 second run through real controls',s['finished'] and s['time']==60,s)
    page.wait_for_function("document.getElementById('sync-status').textContent.includes('Verified & synced')",timeout=10000)
    check('backend accepts real browser replay', 'Verified & synced' in page.locator('#sync-status').inner_text())
    check('results display and progress persists',page.locator('#result-overlay').is_visible() and page.evaluate("JSON.parse(localStorage.getItem('rift-rush-v1')).runs.length")>=1)
    page.screenshot(path=str(ROOT/'artifacts/desktop-results.png'))
    with page.expect_download() as dl:page.locator('#card-btn').click()
    dl.value.save_as(str(ROOT/'artifacts/score-card.png'));check('share card downloads',(ROOT/'artifacts/score-card.png').stat().st_size>1000)
    page.locator('#home-btn').click();page.locator('[data-mode="daily"]').click();page.locator('#play-btn').click();page.wait_for_function('window.riftQA()?.time>0.1');seed1=page.evaluate('riftQA().seed');page.keyboard.press('p');page.locator('#quit-btn').click();page.locator('#play-btn').click();page.wait_for_function('window.riftQA()?.time>0.1');check('daily seed is stable across runs',page.evaluate('riftQA().seed')==seed1)
    page.keyboard.press('p');page.locator('#quit-btn').click();page.reload();check('records survive reload',page.locator('.run-row').count()>=1)
    check('no desktop runtime errors',not errors,errors)
    context.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,accept_downloads=True)
    m=mobile.new_page();mobile_errors=[];m.on('pageerror',lambda e:mobile_errors.append(str(e)))
    m.goto(BASE+'/?seed=42&target=6000&v=1');m.wait_for_load_state('networkidle');check('challenge parses target', '6,000' in m.locator('#challenge-banner').inner_text())
    check('mobile fits viewport',m.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    m.screenshot(path=str(ROOT/'artifacts/mobile-home.png'),full_page=True)
    m.locator('[data-mode="daily"]').tap();check('daily selection hides other challenge',not m.locator('#challenge-banner').is_visible());m.locator('[data-mode="rush"]').tap();m.locator('#play-btn').tap();m.wait_for_function('window.riftQA()?.time>0.1');check('challenge uses supplied seed',m.evaluate('riftQA().seed')==42)
    m.locator('#left-btn').tap();check('touch left',m.evaluate('riftQA().lane')==0);m.locator('#right-btn').tap();check('touch right',m.evaluate('riftQA().lane')==1)
    m.locator('#blast-btn').tap();check('touch blast',m.evaluate('riftQA().energy')<10)
    m.wait_for_timeout(1200);m.screenshot(path=str(ROOT/'artifacts/mobile-gameplay.png'),full_page=True)
    # Timing sample on a real rendering loop (not a hosting capacity claim).
    timing=m.evaluate('''() => new Promise(resolve=>{const times=[];let last;function f(t){if(last)times.push(t-last);last=t;if(times.length<90)requestAnimationFrame(f);else resolve(times)}requestAnimationFrame(f)})''')
    ordered=sorted(timing);check('mobile render loop responsive',ordered[len(ordered)//2]<40,{'median_frame_ms':ordered[len(ordered)//2],'p95_frame_ms':ordered[int(len(ordered)*.95)]})
    m.locator('#pause-btn').tap();check('touch pause',m.evaluate('riftQA().paused'));m.locator('#quit-btn').tap()
    # Cached assets are playable after an offline reload.
    m.wait_for_function('navigator.serviceWorker.controller!==null')
    mobile.set_offline(True);m.reload();check('offline shell available',m.locator('#play-btn').is_visible());m.locator('#play-btn').tap();m.wait_for_function('window.riftQA()?.time>0.1');m.wait_for_timeout(500);check('offline gameplay runs',m.evaluate('riftQA().time')>0)
    check('no mobile runtime errors',not mobile_errors,mobile_errors)
    mobile.close();browser.close()
(ROOT/'artifacts/browser-qa.json').write_text(json.dumps({'checks':results,'passed':all(r['passed'] for r in results)},indent=2))
