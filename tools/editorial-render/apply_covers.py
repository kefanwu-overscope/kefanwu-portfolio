"""Connect the reviewed rendered catalogue to existing project cards only."""
import json
import re
from pathlib import Path
from html import escape

ROOT=Path(__file__).resolve().parents[2]
DESCRIPTIONS={
 'steering':'CAD render of the Mk.8 steering wheel, column, U-joints, bearing mounts, and rack.',
 'vineRobot':'Vine robot pressure vessel and retracted translucent tube in the exact starting pose of its extension animation.',
 'javelin':'Javelin CAD airframe with photo-reconstructed propellers and corrected dark polymer and motor materials.',
 'scanner':'CAD render of the LiDAR scanner with blue printed mounts, metal guide rods, and a pale plywood base.',
 'brakeSim':'CAD render of the perforated cast iron brake rotor, with a neutral machined finish.',
 'aura':'CAD render of the AURA swerve assembly, metal structure, rubber wheel, and drive motors.',
 'carbonSeat':'CAD render of the carbon fiber and epoxy seat shell with a fine woven finish.',
 'seat':'CAD render of the folded, perforated aluminum driver seat.',
 'materialTest':'Tensile tester with silver grips holding a clearly visible orange fabric specimen.',
 'ansysCfd':'Rebuilt Fluent pressure field and numerical flow paths, with blue low-pressure and orange-red high-pressure regions.',
 'pool':'CAD render of the Pool Sniper launcher with blue printed parts, clear acrylic sides, and metal hardware.',
 'lineFollower':'CAD render of the line-following robot with orange wheels, a teal circuit board, and separately shaded electronics.',
 'formlabs':'CAD render of the Smelly perfume mixer with white printed structure and steel guide rods.',
 'telecaster':'CAD render of the finished Telecaster-style guitar with photo-matched body, neck, pickguard, and hardware materials.',
 'education':'Separated guitar education kit in the exact starting layout of its assembly animation.',
 'ftc':'Studio render of the FTC robot, with an aluminum lift, red panels, dark supports, and mecanum wheels.',
}
SIZES='(max-width: 370px) calc(100vw - 40px), (max-width: 720px) calc((100vw - 56px) / 2), (max-width: 1199px) calc((100vw - 120px) / 3), (max-width: 1552px) calc((100vw - 184px) / 4), 342px'
html=(ROOT/'index.html').read_text(encoding='utf-8')
catalog=json.loads((ROOT/'tools/editorial-render/catalog-manifest.json').read_text(encoding='utf-8'))
records={record['project']:record for record in catalog}
assert len(catalog)==len(records)==16 and set(records)==set(DESCRIPTIONS)
seen=[]

def asset_url(variant):
    return f'{variant["src"]}?v={variant["sha256"][:12]}'
def replace_card(match):
    card=match.group()
    key=re.search(r'data-project="([^"]+)"',card).group(1)
    assert key in DESCRIPTIONS
    seen.append(key)
    variants=sorted(records[key]['variants'],key=lambda variant:variant['width'])
    assert [(v['width'],v['height']) for v in variants]==[(480,320),(960,640),(1800,1200)],key
    for variant in variants:
        assert (ROOT/variant['src']).is_file(),key
    primary=next(variant for variant in variants if variant['width']==960)
    largest=variants[-1]
    srcset=', '.join(f'{asset_url(variant)} {variant["width"]}w' for variant in variants)
    card=re.sub(r'<div class="card-media[^"\n]*">','<div class="card-media card-media--contain card-media--render">',card,count=1)
    img=f'<img src="{escape(asset_url(primary),quote=True)}" srcset="{escape(srcset,quote=True)}" sizes="{SIZES}" width="{largest["width"]}" height="{largest["height"]}" alt="{escape(DESCRIPTIONS[key],quote=True)}" loading="lazy" decoding="async" />'
    card=re.sub(r'<img\b[^>]*>',img,card,count=1)
    card=re.sub(r'<span class="cover-kind">.*?</span>','',card)
    return card
html=re.sub(r'<article class="project-card".*?</article>',replace_card,html,flags=re.S)
assert len(seen)==16 and set(seen)==set(DESCRIPTIONS)
if 'class="cover-note"' not in html:
    html=html.replace('<p class="search-empty"', '<p class="cover-note">Studio renders for a closer look. Open a project for original build photos and technical results.</p>\n        <p class="search-empty"',1)
html=html.replace('editorial.css?v=cinematic-preview-20260913','editorial.css?v=rendered-covers-20260913')
(ROOT/'index.html').write_text(html,encoding='utf-8',newline='\n')
print('Connected all 16 responsive project covers. Original detail galleries unchanged.')
