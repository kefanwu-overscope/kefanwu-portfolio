"""Withdraw the source control hardware without tearing the strung guitar.

The supplied strings include tuning-post windings. Neck, strings, frets, bridge,
pickguard and pickups stay together. The selector, screws and small white finish
masks stay attached to their control plate; its two knobs withdraw independently.
"""
from mathutils import Vector

PREFERRED={'volume_knob':(0,-1,0),'tone_knob':(0,-1,0),'control_plate':(0,-1,0)}
PLATE={
    'mat_chrome_part_3','mat_chrome_part_4',
    'mat_chrome_part_36','mat_chrome_part_37','mat_chrome_part_38','mat_chrome_part_39',
    'mat_paint_white_part_10','mat_paint_white_part_11','mat_paint_white_part_12',
    'mat_paint_white_part_13','mat_paint_white_part_14','mat_plastic_black_part_0',
}

def configure(parts):
    bodies=[p for p in parts if p['name']=='mat_paint_white_part_0']
    assert len(bodies)==1 and bodies[0]['size'].x>.8 and bodies[0]['size'].z>1, 'Source body changed; re-audit Telecaster component boundaries'
    assert PLATE.issubset({p['name'] for p in parts}), 'Source control hardware changed'
    for part in parts:
        name=part['name']
        if name=='mat_chrome_part_0':group='volume_knob'
        elif name=='mat_chrome_part_1':group='tone_knob'
        elif name in PLATE:group='control_plate'
        else:group='body'
        part['group']=group
        part['offset']=Vector((0,0,0))
    return PREFERRED
