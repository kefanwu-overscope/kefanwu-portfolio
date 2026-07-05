"""Merge per-part SolidWorks STL exports into per-project GLBs with
material buckets encoded as mesh names (three.js assigns real PBR mats)."""
import os, glob, re, sys
import numpy as np
import trimesh

SRC = r"C:\Users\oc\Desktop\STL"
OUT = r"C:\Users\oc\Desktop\WEBSITE\portfolio-site\models\real"
os.makedirs(OUT, exist_ok=True)

GROUPS = {
    "steering": "8-CP01-Steering - *.STL",
    "javelin":  "Javelin_V1 - *.STL",
    # NOTE: aura is intentionally commented out. The full Drive_System STL set
    # contains BOTH swerve modules, so re-exporting it makes the exhibit show a
    # pair. The committed aura.glb is a hand-trimmed SINGLE module — do NOT
    # regenerate it here (restore from git if it gets clobbered).
    # "aura":   "Drive_System - *.STL",
    "scanner":  "SD_Scanner_Assem - *.STL",
    "seat":     "CF_Seat.STL",
}

SKIP = [
    "ball bearing",          # 3x3.9MB fully-modeled balls, invisible in cage
    "vtx - rush",            # internal electronics
    "автопилот",             # autopilot board, internal
    "ebom-freeparts",        # loose vendor sub-parts
    "space_claim",           # void solids
    "psu_lrs",               # empty file
    "lpd3806",               # encoder body, buried
    "91390a097",             # coupling screws, buried
]

# (pattern, bucket) — first match wins; more specific first
CLASS = [
    (r"base-\d", "wood"),  # scanner plywood base plate (only "Base-2" matches)
    (r"wheel_6in", "rubber"),
    (r"brass", "brass"),
    (r"nosecone|tailcone|wing|naca", "aero"),
    # scanner: the truss beam + EMG cover are light grey/white in the CAD,
    # not printed-blue — route them to the aero (light grey) bucket
    (r"horizonal_stablizer|emg_cover", "aero"),
    (r"cf_seat", "carbon"),
    (r"motor|servo|mg996|stepper|23hs32|encoder|camera|caddx|foxeer|gnss|matek|airspeed|tfmini|switch|estop|battery|sensor_mount_step", "dark"),
    (r"screw|nut|shaft|sprocket|bearing|coupling|pulley|tube|insert|joint|rack|narrco|nar0|tt11|qd_|lead|magnet-", "steel"),
    (r"pitot", "steel"),
    (r".", "printed"),
]

def bucket_of(name):
    n = name.lower()
    for pat, b in CLASS:
        if re.search(pat, n):
            return b
    return "printed"

# optional CLI filter: `python stl2glb.py scanner` regenerates only that project
if len(sys.argv) > 1:
    GROUPS = {k: v for k, v in GROUPS.items() if k in sys.argv[1:]}

for proj, pat in GROUPS.items():
    files = sorted(glob.glob(os.path.join(SRC, pat)))
    files = [f for f in files if not any(s in os.path.basename(f).lower() for s in SKIP)]
    if not files:
        print(f"!! {proj}: no files"); continue
    buckets = {}
    skipped = 0
    for f in files:
        try:
            m = trimesh.load(f, force="mesh")
            if m.is_empty or len(m.faces) == 0:
                skipped += 1; continue
            b = bucket_of(os.path.basename(f))
            buckets.setdefault(b, []).append(m)
        except Exception as e:
            print(f"   warn {os.path.basename(f)}: {e}"); skipped += 1
    scene = trimesh.Scene()
    tris = 0
    for b, meshes in buckets.items():
        merged = trimesh.util.concatenate(meshes)
        merged.merge_vertices()
        tris += len(merged.faces)
        scene.add_geometry(merged, node_name=f"mat_{b}", geom_name=f"mat_{b}")
    out = os.path.join(OUT, f"{proj}.glb")
    scene.export(out)
    kb = os.path.getsize(out) // 1024
    ext = scene.extents
    print(f"OK {proj}: {len(files)} parts -> {len(buckets)} buckets ({', '.join(sorted(buckets))}), "
          f"{tris} tris, {kb} KB, extents {np.round(ext,1)}")
print("DONE")
