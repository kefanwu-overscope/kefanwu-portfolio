"""Geometry-based material classification for a SINGLE fused STL that has no
per-part filenames to bucket by (unlike every group in stl2glb.py, which is a
folder of one-STL-per-SolidWorks-part). This is the tensile-testing-machine
exhibit ("materialTest"): one 22k-tri STL, 19 separate shells once split by
connectivity, no names anywhere in the file.

Approach: split the mesh into its connected components (each disjoint shell
== one real-world part, since SolidWorks parts in a snug assembly essentially
never share exactly-coincident vertices), then classify each shell by its
bounding-box geometry -- position, size, shape, and how many *identical*
copies of it exist -- cross-referenced against the reference photo
(instron-machine-1.snapshot.3/Renderings/IMG_0378.JPG, a real photo despite
the folder name). Every threshold below was measured directly off this one
mesh (see the component table in the module docstring of stl2glb.py's
GEOM_GROUPS section) -- this is deliberately a bespoke, heavily-commented
one-off classifier, not a general-purpose shape recognizer.

Why connected components instead of networkx: trimesh.split() wants
networkx, which is not installed in the Blender python interpreter this
pipeline runs under. scipy IS installed, so we build the face-adjacency graph
ourselves and run scipy.sparse.csgraph.connected_components over it -- same
result, one fewer dependency to add.
"""
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components


def split_connected_components(mesh):
    """Return a list of trimesh submeshes, one per connected component of the
    face-adjacency graph. Equivalent to mesh.split(), without networkx."""
    fa = mesh.face_adjacency
    n_faces = len(mesh.faces)
    data = np.ones(len(fa), dtype=np.int8)
    graph = coo_matrix((data, (fa[:, 0], fa[:, 1])), shape=(n_faces, n_faces))
    n_comp, labels = connected_components(csgraph=graph, directed=False)
    return [mesh.submesh([np.where(labels == i)[0]], append=True) for i in range(n_comp)]


def _stats(sub):
    return dict(
        faces=len(sub.faces),
        extents=sub.extents,          # [x, y, z] size
        centroid=sub.centroid,
        bounds=sub.bounds,
    )


# ---------------------------------------------------------------------------
# Reference-photo color read (IMG_0378.JPG), sampled directly off the image
# with a small script -- not eyeballed -- so the "why" for each bucket is a
# measured pixel, not a guess:
#   side columns + base housing   -> warm off-white/cream   (~#bdc3b4 raw,
#                                     color-corrected for the fluorescent
#                                     green-white cast -> see suggestedMatTweak)
#   top fixed beam + moving        -> dark charcoal, near-black (~#3e3a37 /
#     crosshead ("MTS Insight")       #454343). The red/white MTS decal and the
#                                     black control strip are surface graphics,
#                                     not separate geometry in this STL.
#   grip yokes (2x, identical)     -> near-black housing (~#100e11 to #313035)
#   load cell + base coupling      -> silver-grey metal, stepped cylinder,
#     (2x, IDENTICAL shape)           visible cal-sticker (crop_crosshead2)
#   load-cell-to-crosshead collar  -> same silver-grey metal family as above
#   flange/spacer rings (2x)       -> distinct copper/bronze band right at the
#                                     cylinder-to-yoke junction (crop_crosshead2)
#   grip pins (4x, identical)      -> lighter metal than the black jaws --
#                                     task notes call these "chrome/silver pins"
#   pendant controller cluster     -> NOT in the task's own photo read; found
#     (bracket + body + detail)       only via geometry (see PENDANT rule
#                                     below) then confirmed against a tighter
#                                     crop: a dark-grey handheld unit (cyan
#                                     screen, red badge) on a lighter grey-
#                                     olive metal mounting bracket, clipped to
#                                     the right column on its coiled cable.
# ---------------------------------------------------------------------------

def classify_tensile_components(components):
    """components: list of trimesh submeshes (from split_connected_components).
    Returns a list of (bucket, role_label) aligned 1:1 with `components`.

    First-match-wins over a small set of geometric rules, same spirit as
    stl2glb.py's filename CLASS list, just keyed on shape/position instead of
    a regex on a name (there is no name). A few rules are RELATIVE (they
    compare candidates against each other -- e.g. "the bigger of this pair is
    the load cell, the smaller is the base coupling") rather than a pure
    per-component predicate, so this runs as one pass over the whole list
    instead of a bucket_of(name)-style pure function.
    """
    stats = [_stats(s) for s in components]
    n = len(components)
    result = [None] * n
    claimed = [False] * n

    def unclaimed():
        return [i for i in range(n) if not claimed[i]]

    # 1) COLUMNS -- tall (>150mm) and narrow in X (<40mm). Cream/off-white
    # side posts running nearly the full frame height in every photo angle.
    for i in unclaimed():
        ext = stats[i]["extents"]
        if ext[1] > 150 and ext[0] < 40:
            result[i] = ("aero", "side column")
            claimed[i] = True

    # 2) BASE HOUSING -- by far the largest footprint (>100mm in BOTH X and
    # Z), short in Y. The floor-standing plinth the columns bolt into; same
    # cream/off-white finish as the columns in the photo. (Any black control
    # bezel / e-stop the photo shows on its top face is NOT separable
    # geometry here -- see stl2glb.py's GEOM_GROUPS comment.)
    for i in unclaimed():
        ext = stats[i]["extents"]
        if ext[0] > 100 and ext[2] > 100:
            result[i] = ("aero", "base housing")
            claimed[i] = True

    # 3) BEAMS -- wide in X (>60mm) and thin in Y (<30mm): the two horizontal
    # members spanning between the columns. Both read dark charcoal/near-
    # black in the photo (crop_topbeam.png, crop_crosshead2.png). Whichever
    # sits HIGHER (larger centroid Y) is the fixed top beam; the other is the
    # moving "MTS Insight" crosshead -- same bucket either way, label only.
    beams = [i for i in unclaimed() if stats[i]["extents"][0] > 60 and stats[i]["extents"][1] < 30]
    beams.sort(key=lambda i: -stats[i]["centroid"][1])
    for rank, i in enumerate(beams):
        result[i] = ("dark", "fixed top beam" if rank == 0 else "moving crosshead (MTS Insight beam)")
        claimed[i] = True

    # 4) GRIP YOKES -- by far the most-detailed shells after the pendant body
    # (>4000 faces); the machine has exactly two, geometrically IDENTICAL
    # (same part reused top and bottom, as real pneumatic/mechanical grips
    # usually are). Black housing in every photo. Higher centroid Y = upper
    # grip, lower = lower grip.
    grips = [i for i in unclaimed() if stats[i]["faces"] > 4000]
    grips.sort(key=lambda i: -stats[i]["centroid"][1])
    for rank, i in enumerate(grips):
        result[i] = ("dark", "upper grip assembly" if rank == 0 else "lower grip assembly")
        claimed[i] = True

    # 5) PENDANT CLUSTER -- everything sitting well outside the machine's own
    # structural footprint: centroid X beyond the columns' inner faces AND
    # centroid Z well forward of the column/base body. This is NOT mentioned
    # in the task's own photo read -- it was found by this geometric outlier
    # test, then confirmed by cropping tighter on the right column: it is the
    # hand-held pendant controller hanging off its coiled cable, clipped to
    # the column partway up. Largest shell in the cluster = the pendant BODY
    # (dark-grey housing, cyan screen, red badge -- "dark" bucket is the
    # closest single match); the rest = its mounting bracket/hardware, which
    # reads as a lighter grey-olive metal, distinctly darker/cooler than the
    # cream column it's bolted to -> "steel".
    cluster = [i for i in unclaimed() if stats[i]["centroid"][0] > 45 and stats[i]["centroid"][2] > 20]
    if cluster:
        cluster.sort(key=lambda i: -stats[i]["faces"])
        body, rest = cluster[0], cluster[1:]
        result[body] = ("dark", "pendant controller body")
        for i in rest:
            result[i] = ("steel", "pendant mount bracket/hardware")
        for i in cluster:
            claimed[i] = True

    # 6) CYLINDERS -- moderate cylindrical proportions (~25x35x25mm), on the
    # central test axis (|centroid.x| small). Exactly two, IDENTICAL shape:
    # the load cell body (under the crosshead) and the plain coupling that
    # carries the same load path down to the lower grip. Silver-grey metal in
    # every photo (crop_crosshead2.png cal-sticker visible on the load cell).
    cyl = [i for i in unclaimed()
           if 15 < stats[i]["extents"][0] < 35 and 25 < stats[i]["extents"][1] < 45
           and 15 < stats[i]["extents"][2] < 35 and abs(stats[i]["centroid"][0]) < 20]
    cyl.sort(key=lambda i: -stats[i]["centroid"][1])
    for rank, i in enumerate(cyl):
        result[i] = ("steel", "load cell cylinder" if rank == 0 else "base coupling cylinder")
        claimed[i] = True

    # 7) FLANGES/SPACERS -- thin (Y extent <10mm), moderately wide (30-55mm
    # in X), on the central axis: the copper/bronze rings sitting right at
    # each cylinder-to-yoke junction (crop_crosshead2.png shows this clearly
    # for the upper one). "brass" is the nearest bucket to that coppery tone.
    flg = [i for i in unclaimed()
           if stats[i]["extents"][1] < 10 and 30 < stats[i]["extents"][0] < 55
           and abs(stats[i]["centroid"][0]) < 20]
    flg.sort(key=lambda i: -stats[i]["centroid"][1])
    for rank, i in enumerate(flg):
        result[i] = ("brass", "load-cell flange/spacer" if rank == 0 else "base-coupling flange/spacer")
        claimed[i] = True

    # 8) LOAD-CELL-TO-CROSSHEAD COUPLING -- the one remaining mid-size shell
    # (~35x17.5x35mm) directly under the crosshead, on-axis. Continuous
    # silver-grey metal finish with the load cell it bolts to.
    coup = [i for i in unclaimed()
            if 25 < stats[i]["extents"][0] < 45 and 10 < stats[i]["extents"][1] < 25
            and abs(stats[i]["centroid"][0]) < 20]
    for i in coup:
        result[i] = ("steel", "load-cell-to-crosshead coupling")
        claimed[i] = True

    # 9) GRIP PINS -- whatever's left should be the four tiny (<200-face),
    # identical pins/pivots at the jaw faces of the two grips -- the "chrome/
    # silver pins" the task's photo read calls out. Lighter metal than the
    # black jaw housing -> "steel".
    for i in unclaimed():
        if stats[i]["faces"] < 200:
            result[i] = ("steel", "grip pin")
            claimed[i] = True

    # 10) FALLBACK -- anything the rules above didn't claim. Mirrors
    # stl2glb.py's own filename-based default (bucket_of() falls through to
    # "printed" too) so an unexpected shell fails safe/visible instead of
    # silently vanishing into an existing bucket.
    for i in unclaimed():
        result[i] = ("printed", "UNCLASSIFIED (fallback -- inspect this mesh)")
        claimed[i] = True

    return result
