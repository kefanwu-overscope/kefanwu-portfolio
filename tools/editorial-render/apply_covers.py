"""Connect the reviewed rendered catalogue to existing project cards only."""
import re
from pathlib import Path
from html import escape

ROOT=Path(__file__).resolve().parents[2]
DESCRIPTIONS={
 'steering':'CAD render of the Mk.8 steering wheel, column, U-joints, bearing mounts, and rack.',
 'vineRobot':'CAD render of the blue and white vine robot research vessel with orange seals.',
 'javelin':'Javelin CAD airframe with photo-reconstructed propellers and corrected dark polymer and motor materials.',
 'scanner':'CAD render of the LiDAR scanner with blue printed mounts, metal guide rods, and a pale plywood base.',
 'brakeSim':'CAD render of the perforated cast iron brake rotor, with a neutral machined finish.',
 'aura':'CAD render of the AURA swerve assembly, metal structure, rubber wheel, and drive motors.',
 'carbonSeat':'CAD render of the carbon fiber and epoxy seat shell with a fine woven finish.',
 'seat':'CAD render of the folded, perforated aluminum driver seat.',
 'materialTest':'Studio render of the single-column tensile tester, silver grips, and dark fabric specimen used in the experiment.',
 'ansysCfd':'Rendered display showing the original Ansys Fluent pressure coefficient result for the Javelin CFD case.',
 'pool':'CAD render of the Pool Sniper launcher with blue printed parts, clear acrylic sides, and metal hardware.',
 'lineFollower':'CAD render of the line-following robot with orange wheels, a teal circuit board, and separately shaded electronics.',
 'formlabs':'CAD render of the Smelly perfume mixer with white printed structure and steel guide rods.',
 'telecaster':'CAD render of the finished Telecaster-style guitar with photo-matched body, neck, pickguard, and hardware materials.',
 'education':'CAD render of the disassembled guitar education kit with separately shaded body, neck, pickguard, pickups, and hardware.',
 'ftc':'Studio render of the FTC robot, with an aluminum lift, red panels, dark supports, and mecanum wheels.',
}
SIZES='(max-width: 370px) calc(100vw - 40px), (max-width: 720px) calc((100vw - 56px) / 2), (max-width: 1199px) calc((100vw - 120px) / 3), (max-width: 1552px) calc((100vw - 184px) / 4), 342px'
html=(ROOT/'index.html').read_text(encoding='utf-8')
seen=[]
def replace_card(match):
    card=match.group()
    key=re.search(r'data-project="([^"]+)"',card).group(1)
    assert key in DESCRIPTIONS
    seen.append(key)
    for suffix in ('-480','-960',''):
        assert (ROOT/f'assets/editorial/{key}-wide{suffix}.webp').exists(),key
    card=re.sub(r'<div class="card-media[^"\n]*">','<div class="card-media card-media--contain card-media--render">',card,count=1)
    img=f'<img src="assets/editorial/{key}-wide-960.webp" srcset="assets/editorial/{key}-wide-480.webp 480w, assets/editorial/{key}-wide-960.webp 960w, assets/editorial/{key}-wide.webp 1800w" sizes="{SIZES}" width="1800" height="1200" alt="{escape(DESCRIPTIONS[key],quote=True)}" loading="lazy" decoding="async" />'
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
