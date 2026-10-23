"""Create a portable Basic Launch ZIP. Monetization remains off pending publisher approval."""
from pathlib import Path
import json,re,zipfile
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/rift-rush-portal-basic.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'public').rglob('*'):
        if not p.is_file() or p.name in {'_headers','sw.js','manifest.webmanifest'}:continue
        name=p.relative_to(root/'public').as_posix()
        if p.suffix not in {'.html','.css','.js','.json'}:z.writestr(name,p.read_bytes());continue
        text=p.read_text()
        if name=='config.json':text=json.dumps({'portal':'crazygames','adsEnabled':False,'supportUrl':'','supportLabel':''})
        if name=='index.html':
            text=text.replace('href="/"','href="./"').replace('href="/','href="./').replace('src="/','src="./')
            text=re.sub(r'<link rel="manifest"[^>]+>','',text)
            text=text.replace('<button id="share-btn"','<button hidden id="share-btn"').replace('<button id="card-btn"','<button hidden id="card-btn"')
        if name=='style.css':text=text.replace("url('/assets/","url('./assets/")
        if name=='online.js':text="""export async function prepareRun(){return null}
export async function submitRun(){return {localOnly:true}}
export async function flushPending(){}
export async function loadBoard(){const s=document.getElementById('board-status');if(s)s.textContent='Personal records are saved on this device.';document.getElementById('board-refresh')?.setAttribute('hidden','');}
"""
        if name=='app.js':
            text=text.replace("fetch('/config.json')","fetch('./config.json')")
            text=text.replace("if('serviceWorker'in navigator)","if(false)")
            text=text.replace('Online runs send a random device identifier, a signed run ticket, and steering inputs to verify your score. The public board shows a generated pilot alias and your best score. The browser edition does not load advertising trackers. Phone test builds include Google Mobile Ads and its consent controls.','This portal edition uses the CrazyGames SDK for platform gameplay events. It has no online leaderboard. Advertising is disabled in the Basic Launch package; the portal’s privacy policy also applies.')
        z.writestr(name,text)
print(out)
