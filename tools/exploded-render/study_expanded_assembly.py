"""Scoped geometry experiments for the functional-motion revision."""
import argparse
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from inspect_motion import renderer_helpers
from assembly_motion import Geometry
from expanded_collision import check_expanded_translation as check_path

OUT = HERE.parents[2] / '.codex/functional-motion-20260913'
OUT.mkdir(parents=True, exist_ok=True)

def configure_line(parts):
    for p in parts:
        n, c = p['name'], p['center']
        if n.startswith('mat_battery'): g = 'battery'
        elif n in ('mat_plastic_black_part_0', 'mat_plastic_black_part_1'): g = 'sensor_array'
        elif n.startswith('mat_solder') or n.startswith('mat_pcb_teal'): g = 'controller'
        elif n.startswith('mat_plastic_black'):
            i = int(n.rsplit('_',1)[1])
            if i in (10,18): g='usb_connector'
            elif i==9: g='power_jack'
            elif 11<=i<=17: g='io_headers'
            else: g = 'controller' if i < 58 else ('driver_left' if c.x < 0 else 'driver_right')
        elif n.startswith('mat_pcb_green'): g = 'driver_left' if c.x < 0 else 'driver_right'
        elif n == 'mat_printed_black_part_4': g = 'controller_carrier'
        elif n == 'mat_printed_black_part_1': g = 'driver_left'
        elif n == 'mat_printed_black_part_2': g = 'driver_right'
        elif n == 'mat_printed_black_part_0' or n == 'mat_steel_part_5': g = 'caster'
        elif n == 'mat_printed_black_part_3': g = 'chassis'
        elif n.startswith('mat_rubber_orange'): g = 'tire_left' if c.x < 0 else 'tire_right'
        elif n.startswith('mat_steel'):
            i = int(n.rsplit('_',1)[1])
            if i < 3: g = 'post_'+str(i)
            elif i == 3: g = 'usb_connector'
            elif i == 4: g = 'controller'
            elif i in (6,7): g = 'wheel_left' if c.x < 0 else 'wheel_right'
            elif i in (8,9): g = 'motor_left' if c.x < 0 else 'motor_right'
            else: raise ValueError(n)
        else: raise ValueError(n)
        p['group'] = g

def configure_pool(parts):
    for p in parts:
        n = p['name']
        p['group'] = n

def setup(key):
    ns = renderer_helpers()
    objects, _ = ns['stage'](key)
    parts = ns['make_parts'](objects,key)
    ns['movement'](key,parts)
    ns['reunite_finish_surfaces'](key,parts)
    if key == 'lineFollower': configure_line(parts)
    elif key == 'pool': configure_pool(parts)
    bpy.context.view_layer.update()
    return ns, parts

def geometries(parts):
    buckets = {}
    for p in parts: buckets.setdefault(p['group'], []).append(p)
    deps = bpy.context.evaluated_depsgraph_get()
    return [Geometry(name, ps, deps) for name, ps in buckets.items()]

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('project')
    parser.add_argument('--groups', nargs='*')
    parser.add_argument('--length', type=float, default=.7)
    parser.add_argument('--withdrawal', type=float, default=.25)
    parser.add_argument('--merge', nargs='*', default=[])
    parser.add_argument('--move', nargs='*', default=[])
    parser.add_argument('--inventory', action='store_true')
    parser.add_argument('--strict', action='store_true')
    parser.add_argument('--directions', nargs='*', default=['1,0,0','-1,0,0','0,1,0','0,-1,0','0,0,1'])
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    ns, parts = setup(args.project)
    if args.inventory:
        details=[]
        for p in parts:
            details.append({'name':p['name'],'group':p['group'],'center':list(p['center']),'size':list(p['size'])})
        (OUT/('assembly-'+args.project+'-inventory.json')).write_text(json.dumps(details,indent=2))
        print(json.dumps(details),flush=True)
        sys.exit(0)
    for rule in args.merge:
        name, members = rule.split('=')
        for p in parts:
            if p['group'] in members.split(','): p['group'] = name
    for rule in args.move:
        name, xyz = rule.split('=')
        for p in parts:
            if p['group'] == name: p['object'].location += Vector([float(x) for x in xyz.split(',')])
    bpy.context.view_layer.update()
    gs = geometries(parts)
    result = {}
    for g in gs:
        if args.groups and g.name not in args.groups: continue
        rows=[]
        for d in args.directions:
            delta=np.array([float(x) for x in d.split(',')])*args.length
            if args.strict:
                from assembly_motion import check_path as strict_check
                passed, detail=strict_check(g,delta,gs)
            else:
                passed, detail=check_path(g,delta,gs,withdrawal_fraction=args.withdrawal)
            if detail.get('contact'):
                hit=detail['contact']
                other=next(o for o in gs if o.name==detail['obstacle'])
                for label,geom,index in [('movingPart',g,hit['movingTriangle']),('otherPart',other,hit['otherTriangle'])]:
                    start=0
                    for part in geom.parts:
                        obj=part['object'].evaluated_get(bpy.context.evaluated_depsgraph_get())
                        mesh=obj.to_mesh();mesh.calc_loop_triangles(); count=len(mesh.loop_triangles);obj.to_mesh_clear()
                        if start<=index<start+count:
                            detail[label]=part['name']; break
                        start+=count
            row={'translation':delta.tolist(),'passed':passed,**detail}
            rows.append(row)
            print('EXPERIMENT',g.name,passed,json.dumps(row),flush=True)
        result[g.name]=rows
    (OUT/('assembly-study-'+args.project+'.json')).write_text(json.dumps(result,indent=2))
