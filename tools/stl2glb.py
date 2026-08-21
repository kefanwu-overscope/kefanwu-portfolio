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
    # the only group that lives in a subfolder — the STL root has no Bucketbot
    # files, so the glob must carry the folder or it silently matches nothing
    "vineRobot": "Bucketbot/Bucketbot - *.STL",
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
    # 84 fully-threaded 7mm cap screws = 133k tris, 52% of the whole Bucketbot
    # set; the shanks sit inside tapped holes and only the heads break the
    # surface. Prefix-scoped on purpose: steering/aura ship the same vendor
    # "socket head cap screw_am" name and must keep their fasteners.
    "bucketbot - socket head cap screw",
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
    # --- Bucketbot/vineRobot; re-audited against BOTH evidence sets: the real
    # build photos (assets/vine-body-3partition, vine-body-stick, vine-test-rig,
    # vine-test-closeup) and the CAD renders (vine-reinforced-cad,
    # vine-lid-exploded, vine-outlet-exploded, vine-assembly-cutaway). Photos win
    # for any part visible in them; the CAD only fills in for internals. Most of
    # the SolidWorks parts carry no appearance, so "grey in the CAD" is NOT
    # evidence of metal — the built robot is blue + white printed plastic.
    # These sit above the dark/steel rules because several Bucketbot names hit
    # those rules by accident (see each note).
    (r"tpu_", "rubber"),                      # the gaskets. Orange TPU in the
                                              # photos (the line under the lid and
                                              # the squeeze-out around the outlet
                                              # flange), red in the CAD — rubber is
                                              # the nearest bucket either way. Must
                                              # beat the "motor" rule: TPU_Motor Seal.
    (r"ebk bucket", "glass"),                 # the pail. Every photo shows a
                                              # translucent HDPE tub with the spool
                                              # visible through the wall, so it takes
                                              # the renderer's native glass mat.
                                              # NEVER shorten this to "bucket":
                                              # bucket_of() gets the whole basename
                                              # and every part here is prefixed
                                              # "Bucketbot - ", so a bare "bucket"
                                              # would turn the entire robot to glass.
    (r"bracket|side_joint|back joint", "printed"),
                                              # all the royal-blue printed frame
                                              # parts: the 3 C-bands (Bracket1/2/3),
                                              # their 27 connector caps and the 3
                                              # feet. The photos show each C-band
                                              # rail is the SAME blue as the caps
                                              # bolted onto it (vine-body-3partition
                                              # left face, vine-test-rig top rails) —
                                              # the CAD's default grey for the bands
                                              # was what put them in steel before.
                                              # Must beat the steel rule: "bracket"
                                              # contains "rack", "*joint" hits "joint".
                                              # Keep side_joint|back joint spelled
                                              # out — a bare "joint" would steal
                                              # steering's U-Joints out of steel.
    (r"top_plate|converter_circular", "printed"),
                                              # the two remaining blue parts: the
                                              # lid's top plate (blue top face with
                                              # print layer lines above the orange
                                              # lid gasket, vine-body-stick) and the
                                              # outlet funnel, whose 279x152 flange
                                              # is the big blue face the vine everts
                                              # through. CAD draws both grey.
                                              # MUST precede the "plate" rule below.
    (r"plate|spool_holder|spool_mount|dividing_shaft|r52mm_coupler|lid_mount", "aero"),
                                              # the white / light-grey parts. Vessel
                                              # plates: cream-white in vine-test-rig
                                              # (bottom + side), not bare aluminium.
                                              # Spool spider/base + Dividing_Shaft:
                                              # internals, light grey in the cutaway —
                                              # and that "shaft" is really a
                                              # 254x15x8 flat divider blade, so it
                                              # has to beat the steel rule's "shaft".
                                              # r52mm_coupler: the outlet ring is
                                              # buried under the everted sleeve in
                                              # every photo, and vine-outlet-exploded
                                              # renders it light grey, so nothing
                                              # supports the old "polished nozzle".
                                              # Lid_Mount: the band under the orange
                                              # lid gasket is WHITE in all three body
                                              # photos though the CAD paints it yellow.
                                              # NB "Spool-1" is deliberately absent —
                                              # it is the blue mandrel in the cutaway
                                              # and falls through to printed.
    (r"outlet_bolt", "brass"),                # the yellow frame clamping the outlet
                                              # gasket. Unlike Lid_Mount it sits
                                              # INSIDE the pail wall and never shows
                                              # in a photo, so the CAD's yellow stands.
    # DC_Motor: the CAD draws it default light grey, but vine-test-closeup shows the
    # real motor sitting on the lid as a black can with a black coupling boss (driver
    # PCB + 4-wire encoder ribbon beside it) — the photo wins, so the near-black
    # "dark" bucket is now backed by evidence, not just by site convention.
    (r"motor|servo|mg996|stepper|23hs32|encoder|camera|caddx|foxeer|gnss|matek|airspeed|tfmini|switch|estop|battery|sensor_mount_step", "dark"),
    # from Bucketbot only the vendor hardware still lands here — the 4 flanged
    # bearings and the McMaster set-screw coupling, all plain metal in the lid
    # explode. (Holder_Fixer stays on the printed default below: it is an 11x20mm
    # internal clip, invisible in the photos and too small to read in the renders.)
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

# ---------------------------------------------------------------------------
# Geometry-based groups: buckets derived from mesh SHAPE, not filename.
#
# Every group above is a folder of one-STL-per-SolidWorks-part, so bucket_of()
# just regexes the filename. The tensile-testing-machine exhibit is the
# opposite: ONE STL ("Tensile Machine.STL", a single fused export with no
# per-part breakdown -- it came with a matching "Tensile Machine.IGS" and
# nothing else) with zero names anywhere to key off. So instead we split the
# mesh into its connected components -- each disjoint shell == one real part,
# since assembled SolidWorks parts essentially never share exactly-coincident
# vertices even when touching -- and classify each shell by its bounding-box
# geometry (position/size/shape/how many identical copies exist) against the
# reference photo. Full rules + per-bucket photo justification live in
# tools/tensile_geometry.py; the splitter uses scipy.sparse.csgraph over the
# face-adjacency graph rather than trimesh's mesh.split(), because that wants
# networkx and this interpreter (the Blender-bundled one) doesn't have it and
# scipy already does the same job.
#
# This stays a separate dict + loop instead of folding into GROUPS/CLASS
# above: every existing group's classification key is a filename regex, and
# this group's key is mesh geometry, so forcing it through bucket_of(name)
# would mean inventing a fake filename to regex against -- more confusing
# than a parallel, clearly-labeled code path. Nothing above this comment
# block was touched to make room for it -- verified by snapshotting
# bucket_of(name) for every file in every GROUPS entry before and after this
# edit and diffing the two (identical: steering/javelin/scanner/vineRobot/
# seat all classify exactly as before).
# ---------------------------------------------------------------------------
from tensile_geometry import split_connected_components, classify_tensile_components

GEOM_GROUPS = {
    "materialTest": "Tensile Machine.STL",
}

# same optional CLI filter as GROUPS above, applied separately since this is
# a separate dict (`python stl2glb.py materialTest` regenerates only this one
# without re-exporting any of the filename-based groups)
if len(sys.argv) > 1:
    GEOM_GROUPS = {k: v for k, v in GEOM_GROUPS.items() if k in sys.argv[1:]}

for proj, fname in GEOM_GROUPS.items():
    path = os.path.join(SRC, fname)
    if not os.path.exists(path):
        print(f"!! {proj}: {fname} not found"); continue
    mesh = trimesh.load(path, force="mesh")
    if mesh.is_empty or len(mesh.faces) == 0:
        print(f"!! {proj}: empty mesh"); continue
    comps = split_connected_components(mesh)
    labels = classify_tensile_components(comps)
    buckets = {}
    roles = {}
    for sub, (b, role) in zip(comps, labels):
        buckets.setdefault(b, []).append(sub)
        roles.setdefault(b, []).append(f"{role} ({len(sub.faces)}f)")
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
    print(f"OK {proj}: {len(comps)} shells (connected components) -> {len(buckets)} buckets "
          f"({', '.join(sorted(buckets))}), {tris} tris, {kb} KB, extents {np.round(ext,1)}")
    for b in sorted(buckets):
        print(f"     mat_{b}: {', '.join(roles[b])}")

print("DONE")
