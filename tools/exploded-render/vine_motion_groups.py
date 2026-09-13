"""Withdraw the three genuine printed supports from the intact pressure chamber.

Each support wraps under the lower endplate. A small downward component clears
that underside contact while the support withdraws along its outward normal.
The pressure vessel, endplates, gaskets, reinforcement, shafts and drive remain
one supported assembly; no material masks or closed chamber skins are separated.
"""
from mathutils import Vector

FEET = {
    'mat_printed_part_33': 'far_support',
    'mat_printed_part_34': 'near_support',
    'mat_printed_part_37': 'right_support',
}

PREFERRED = {
    'far_support': (0, .7, -.005),
    'near_support': (0, -.7, -.005),
    'right_support': (.7, 0, -.005),
}


def configure(parts):
    by_name = {p['name']: p for p in parts}
    assert len(parts) == 60 and FEET.keys() <= by_name.keys(), 'Vine robot component layout changed; re-audit the printed supports'
    for name in FEET:
        part = by_name[name]
        assert .5 < part['size'].z < .6 and part['center'].z < .4, 'Expected the original lower printed support'
    for part in parts:
        part['group'] = FEET.get(part['name'], 'pressure_vessel_and_drive')
        part['offset'] = Vector((0, 0, 0))
    return PREFERRED
