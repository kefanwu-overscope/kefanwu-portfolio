"""Convert the newly-supplied per-part SolidWorks STL exports (in subfolders
of C:\\Users\\oc\\Desktop\\STL) into per-project GLBs with material buckets
encoded as mesh names (mat_<bucket>), matching tools/stl2glb.py's scheme so
three.js assigns the same ASSEMBLY_MATS. Aggressive skip lists keep fastener
spam and modeled motor internals out of the shelf exhibits."""
import os, glob, re
import numpy as np
import trimesh

SRC = r"C:\Users\oc\Desktop\STL"
OUT = r"C:\Users\oc\Desktop\WEBSITE\portfolio-site\models\real"
os.makedirs(OUT, exist_ok=True)

# fasteners / modeled-internal junk common to several assemblies
COMMON_SKIP = [
    "socket head cap screw", "socket button head cap screw",
    "hex nut style", "saddle height screws",
]

SMELLY_SKIP = COMMON_SKIP + [
    "m3x25-screw", "m3x40-screw", "copper-", "cable-", "connenctor",
    "bearing dummy", "reference cylinder", "flexible_shaft_coupling",
    "8mm_flange_coupler", "lead screw nut", "micro_switch",
    " core.step", "core_1.step", "gt2 20t",
]

def smelly_extra(name):
    n = name.lower()
    # keep only the outer shell of each NEMA17 stepper, drop the windings/core
    if "nema17" in n and "housing" not in n:
        return True
    return False

# per-project: (proj, subdir, glob, skip, extra_fn, class_rules, target_tris)
# class_rules: (regex, bucket), first match wins. target_tris caps the whole
# exhibit after merge (shelf props don't need SolidWorks tessellation).
PROJECTS = [
    ("brakeSim", "Brake", "*.STL", [], None, [
        (r".", "steel"),                       # a lone brake rotor -> machined steel
    ], 90000),
    ("education", "Guitar Education", "exploded - *.STL", COMMON_SKIP, None, [
        (r"neck|finger_board", "wood"),        # maple neck + fretboard (tan)
        (r"body", "printed"),                  # body kept separate -> blue via tweak
        (r"control_panel", "steel"),
        (r"pick_up|pickup", "dark"),
        (r"bridge|saddle|screw", "steel"),
        (r".", "printed"),
    ], 150000),
    ("lineFollower", "Line_Follower", "*.STL", COMMON_SKIP, None, [
        (r"wheel", "rubber"),
        (r"dc_motor", "dark"),
        (r"arduino|mega|motor_driver|pitch_sensor", "pcb"),
        (r"battery", "dark"),
        (r"standoff|coupler", "steel"),
        (r".", "printed"),                     # chassis, mounts, caster
    ], 120000),
    ("pool", "Pool Sniper", "*.STL", COMMON_SKIP, None, [
        (r"housingside", "glass"),             # clear acrylic side windows
        (r"\bcue", "wood"),
        (r"motor\b|d_shaft_motor", "dark"),
        (r"rack|pinion|pulley|sprocket|shaft|stand_off|standoff|latchpin|"
         r"sheet_metal|front plate|offset front|90128a|3310-|1309-", "steel"),
        (r".", "printed"),                     # housings, triggers, mounts, floor
    ], 110000),
    ("telecaster", "Telecaster", "telecaster - *.STL", COMMON_SKIP, None, [
        (r"_neck", "wood"),                    # maple neck (kept wood)
        (r"body", "printed"),                  # body kept separate -> white via tweak
        (r"string|spring|saddle|screw|bridge|tuner|avvolgitore|cassa|lever|nut", "steel"),
        (r".", "printed"),
    ], 160000),
    ("smelly", "Smelly", "*.STL", SMELLY_SKIP, smelly_extra, [
        (r"nema17|stepper|servo|motor|pinion", "dark"),
        (r"lead screw|guiding_rod|rod_|coupler|coupling|bearing|idler|"
         r"pulley|shaft|screw", "steel"),
        (r".", "printed"),                     # frames, reservoir, blocks, holders
    ], 140000),
]

def bucket_of(name, rules):
    n = name.lower()
    for pat, b in rules:
        if re.search(pat, n):
            return b
    return "printed"

def decimate(mesh, target_faces):
    if len(mesh.faces) <= target_faces:
        return mesh
    try:
        s = mesh.simplify_quadric_decimation(face_count=int(target_faces))
        if not s.is_empty and len(s.faces) > 0:
            return s
    except Exception as e:
        print(f"   warn decimate: {e}")
    return mesh

for proj, sub, pat, skip, extra, rules, target in PROJECTS:
    files = sorted(glob.glob(os.path.join(SRC, sub, pat)))
    files = [f for f in files
             if not any(s in os.path.basename(f).lower() for s in skip)
             and not (extra and extra(os.path.basename(f)))]
    if not files:
        print(f"!! {proj}: no files under {sub}/{pat}"); continue
    buckets, skipped = {}, 0
    for f in files:
        try:
            m = trimesh.load(f, force="mesh")
            if m.is_empty or len(m.faces) == 0:
                skipped += 1; continue
            b = bucket_of(os.path.basename(f), rules)
            buckets.setdefault(b, []).append(m)
        except Exception as e:
            print(f"   warn {os.path.basename(f)}: {e}"); skipped += 1
    # merge each bucket, then decimate the whole exhibit down to `target`,
    # distributing the budget across buckets by their face share
    merged = {}
    raw_total = 0
    for b, meshes in buckets.items():
        mm = trimesh.util.concatenate(meshes)
        mm.merge_vertices()
        merged[b] = mm
        raw_total += len(mm.faces)
    ratio = min(1.0, target / raw_total) if raw_total else 1.0
    scene = trimesh.Scene()
    tris = 0
    for b, mm in merged.items():
        tgt = max(300, int(len(mm.faces) * ratio))
        mm = decimate(mm, tgt)
        tris += len(mm.faces)
        scene.add_geometry(mm, node_name=f"mat_{b}", geom_name=f"mat_{b}")
    out = os.path.join(OUT, f"{proj}.glb")
    scene.export(out)
    kb = os.path.getsize(out) // 1024
    ext = np.round(scene.extents, 1)
    print(f"OK {proj:12s} {len(files):3d} parts (skip {skipped}) -> "
          f"{{{', '.join(sorted(buckets))}}}  {raw_total:6d}->{tris:6d} tris  "
          f"{kb:5d} KB  extents {ext}")
print("DONE")
