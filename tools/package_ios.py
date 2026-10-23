"""Bundle offline web assets for the iPhone target. Requires Xcode for the native build."""
from pathlib import Path
import shutil, subprocess, os
root=Path(__file__).resolve().parents[1]
dest=root/'native/ios/RiftRush/Resources/www'
shutil.copytree(root/'public',dest,dirs_exist_ok=True)
for p in dest.rglob('*'):
    if not p.is_file() or p.suffix not in {'.html','.css','.js'}:continue
    text=p.read_text()
    if p.suffix=='.html':
        text=text.replace('href="/"','href="./index.html"').replace('href="/','href="./').replace('src="/','src="./')
        text=text.replace('<script type="module" src="./app.js"></script>','<script src="./app-bundled.js"></script>')
    if p.suffix=='.css':text=text.replace("url('/assets/","url('./assets/")
    if p.name=='app.js':text=text.replace("fetch('/config.json')","fetch('./config.json')")
    p.write_text(text)
node=os.environ.get('RIFT_NODE','node')
subprocess.run([node,'--input-type=module','-e',"import {buildSync} from 'esbuild'; buildSync({entryPoints:['public/app.js'],bundle:true,format:'iife',target:'es2020',outfile:process.argv[1]});",str(dest/'app-bundled.js')],cwd=root,check=True)
print(dest)
