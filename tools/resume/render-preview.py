"""Render the existing, user-supplied resume; never rewrite its PDF or layout."""
import hashlib, json, shutil, subprocess
from pathlib import Path
from PIL import Image
from pypdf import PdfReader

root=Path(__file__).resolve().parents[2]
evidence=root.parent/'.codex'/'resume-desk-20260926'
evidence.mkdir(parents=True,exist_ok=True)
source=root/'assets'/'kefan-wu-resume.pdf'
reader=PdfReader(source)
assert len(reader.pages)==1, 'Review multi-page resume presentation before regenerating'
box=reader.pages[0].mediabox
assert float(box.width)==612 and float(box.height)==792, 'Expected the current Letter-size resume'
render=evidence/'resume-print'
subprocess.run([shutil.which('pdftoppm') or 'pdftoppm','-scale-to-x','2040','-scale-to-y','-1','-png','-singlefile',str(source),str(render)],check=True)
picture=Image.open(render.with_suffix('.png')).convert('RGB')
assert picture.size==(2040,2640)
temporary=evidence/'resume-print.webp'
picture.save(temporary,'WEBP',lossless=True,method=6)
with Image.open(temporary) as decoded:
    assert decoded.convert('RGB').tobytes()==picture.tobytes(), 'Preview must preserve rendered pixels'
data=temporary.read_bytes();digest=hashlib.sha256(data).hexdigest()
output=root/'assets'/'resume';output.mkdir(exist_ok=True)
name='resume.'+digest[:16]+'.webp'
(output/name).write_bytes(data)
manifest={'source':'assets/kefan-wu-resume.pdf','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'preview':'assets/resume/'+name,'sha256':digest,'width':2040,'height':2640,'bytes':len(data),'pagePoints':[612,792],'encoding':'lossless WebP','sourceUnchanged':True}
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(root/'experience-resume-assets.js').write_text('// Generated from the unchanged public PDF by tools/resume/render-preview.py.\nexport const RESUME_ASSET = '+json.dumps(manifest,indent=2)+';\n',encoding='utf-8')
(evidence/'preview-validation.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
