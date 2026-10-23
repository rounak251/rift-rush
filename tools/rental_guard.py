"""Local backup teardown: only the specifically recorded Rift Rush rental."""
import json, subprocess, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
instance=json.loads((root/'artifacts/rental-create.json').read_text())['new_contract']
cli=str(root/'.gpu-env/bin/vastai')
deadline=time.monotonic()+45*60
log=root/'artifacts/rental-guard.json'
while time.monotonic()<deadline:
    if (root/'artifacts/rental-destroyed.json').exists():
        log.write_text(json.dumps({'status':'manual-teardown-observed','instance':instance}));break
    time.sleep(15)
else:
    result=subprocess.run([cli,'show','instances','--raw'],text=True,capture_output=True,timeout=60)
    inventory=json.loads(result.stdout)
    target=next((i for i in inventory if i['id']==instance),None)
    if target and target.get('label')=='rift-rush-art-20261023':
        result=subprocess.run([cli,'destroy','instance',str(instance),'--yes','--raw'],text=True,capture_output=True,timeout=60)
        log.write_text(json.dumps({'status':'deadline-teardown-requested','instance':instance,'result':result.stdout}))
    else:log.write_text(json.dumps({'status':'instance-absent-or-label-mismatch','instance':instance}))
