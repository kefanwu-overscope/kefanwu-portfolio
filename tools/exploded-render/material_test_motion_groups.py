"""Keep the authored tensile-machine fixtures together during extraction.

Names refer to editorial-render/material-test/build_material_test.py. The two
clamps have mirrored jaw/cheek/spring assemblies. Use their actual bridge centers
to distinguish upper and lower fixtures, instead of a hard-coded global height.
"""
from mathutils import Vector

JAW_PARTS=('curved_spring_grip_cheek','sliding_jaw_wedge',
           'diagonal_jaw_return_spring','jaw_spring_anchor','grip_bridge_fastener')
PANEL_PARTS=('sloped_operator_bezel','yellow_emergency_stop_field',
             'emergency_stop_shank','red_emergency_stop_mushroom','black_jog_rocker')

PREFERRED={
    'upper_left_jaw':(-1,0,0),'lower_left_jaw':(-1,0,0),
    'upper_right_jaw':(1,0,0),'lower_right_jaw':(1,0,0),
    'test_specimen':(0,-1,0),'operator_panel':(0,-.530,.848),
}

def configure(parts):
    bridges=[p for p in parts if 'grip_top_bridge' in p['name']]
    assert len(bridges)==2,'Expected the two authored grip bridges'
    divide_z=sum(p['center'].z for p in bridges)/2
    clamp_x=sum(p['center'].x for p in bridges)/2
    for part in parts:
        name=part['name']
        if any(token in name for token in JAW_PARTS):
            vertical='upper' if part['center'].z>divide_z else 'lower'
            side='right' if part['center'].x>clamp_x else 'left'
            group=f'{vertical}_{side}_jaw'
        elif 'black_fabric_tensile_specimen' in name:
            group='test_specimen'
        elif any(token in name for token in PANEL_PARTS):
            group='operator_panel'
        else:
            # Bridges, couplers, load cell and signal cable remain supported by
            # the original column/base. Do not tear the cable into two groups.
            group='base_and_controls'
        part['group']=group
        part['offset']=Vector((0,0,0))
    return PREFERRED
