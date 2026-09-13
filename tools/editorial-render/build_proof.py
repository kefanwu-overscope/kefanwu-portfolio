"""Local visual review sheet; does not change project evidence or website copy."""
from pathlib import Path
import html
import json

HERE=Path(__file__).resolve().parent
ORDER=['steering','vineRobot','javelin','scanner','brakeSim','aura','carbonSeat','seat',
       'materialTest','ansysCfd','pool','lineFollower','formlabs','telecaster','education','ftc']
cards=[]
for i,key in enumerate(ORDER,1):
    path=HERE/'renders'/f'{key}-wide.png'
    if not path.exists(): path=HERE/'catalog-drafts'/f'{key}-wide-angle0.png'
    record=json.loads(path.with_suffix('.json').read_text(encoding='utf-8')) if path.exists() else {}
    source=record.get('source') or record.get('geometryPolicy','Photo-based reconstruction')
    cards.append(f'<figure><a href="{path.relative_to(HERE).as_posix()}"><img src="{path.relative_to(HERE).as_posix()}" width="1800" height="1200" alt="{html.escape(key)} studio render"></a><figcaption><b>{i:02d} / {html.escape(key)}</b><span>{html.escape(source)}</span></figcaption></figure>')
document='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project cover review</title><style>
*{box-sizing:border-box}body{margin:0;padding:30px;background:#08090b;color:#e7edf6;font:12px system-ui}header{display:flex;justify-content:space-between;gap:20px;margin-bottom:22px;align-items:center}h1{font-size:25px;margin:0}a{color:inherit}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;aspect-ratio:3/2;background:#101217}figcaption{display:flex;flex-direction:column;gap:4px;padding:8px 0;color:#b0bccd}figcaption span{font-size:9px;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#8492a7}b{font:11px monospace;letter-spacing:.05em}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:20px}}
</style><header><h1>Project covers / local visual review</h1><a href="../../index.html#work">Open portfolio ↗</a></header><div class="grid">'''+''.join(cards)+'</div></html>'
(HERE/'catalog-proof.html').write_text(document,encoding='utf-8')
print('catalog-proof.html written')
