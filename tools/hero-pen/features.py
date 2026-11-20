"""The hero car's traced strokes as data (PEN_SPEC 3.2, with the 2026-11-07 pilot critic's
fixes). `python features.py` writes inputs/features.json, which build_art.py reads.

Each feature is one named stroke (or a gesture that may lift into 2-3 strokes where the
photo has a real gap):
  id        neutral name (no function asserted: 12.6 deny-list)
  members   inventory guides in drawing order: {"inv": id, "rev": bool, "gi": guide index}
            or an authored guide {"pts": [[x, y], ...]} read off a zoomed crop; "straight"
            on a member fits it as one straight line; "corner": true joins it to the previous
            member with a pen stop (no lift)
  phase     0-5; tier g c y a n f d h (section 7); kind guide contour form detail glyph hatch accent
  area      the cluster the hand visits (section 4); order of areas is in AREA_ORDER
  classes   "DTP" subsets: D >= 1280, T 768-1279, P < 768
  mode      edge | valley | ridge (snap mode); r snap radius (src px); chan "a" = ridge of the
            Lab a* channel (red straps) instead of log luminance
  prov      traced | fitted | derived | convention
  pin       ccw | as-authored | None (None lets the order flip the stroke to start near the pen)
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def M(inv, rev=False, gi=0, **kw):
    d = {"inv": inv, "rev": rev, "gi": gi}
    d.update(kw)
    return d


def G(pts, **kw):
    d = {"pts": pts}
    d.update(kw)
    return d


F = []


def feat(id, members, phase, tier, kind, area, classes="DTP", mode="edge", r=5, prov="traced", pin=None, **kw):
    d = dict(id=id, members=members, phase=phase, tier=tier, kind=kind, area=area, classes=classes, mode=mode, r=r, prov=prov, pin=pin)
    d.update(kw)
    F.append(d)


# ------------------------------------------------------------------ P1 silhouette (8 gestures, all classes)
feat("nose-loop", [M("nose-top-rear-corner", rev=True),
                   G([[1294, 638], [1262, 640], [1191, 647], [1147, 660], [1097, 677], [1044, 702], [989, 739], [948, 778], [936, 792], [931.5, 800]]),
                   G([[930.5, 802], [931, 812], [934, 824], [940, 836], [949, 846], [957, 851]], corner=True)],
     1, "c", "contour", "g1-nose", r=5, pin="as-authored", gesture=1, src_inv="nose-top-edge,nose-tip-front",
     nosplit=True,   # measured: 97 % within 2 src px whole; the weak-run split only cut a 15 px stretch behind the plate
     # revision 5 (main loop): the line down the black lower body's front edge ends 10 src px below
     # nose-underside's start (near y 821) instead of at the shadow (957.4, 850.6): the tip closes and
     # the true but dangling 45 src px tail no longer reads as an overshoot (build_art.trim_end_below)
     end_below={"of": "nose-underside", "dy": 10.0})
feat("nose-underside", [M("stripe-outer-lower")], 1, "c", "contour", "g1-nose", r=5, pin="as-authored", gesture=1)
# Revision 3 (truth critic): the coaming tube is straight. Its top edge is ONE straight line fitted
# by build_art.tube_edges() to the measured top edge (columns where the area above the lit tube is
# dark; over x 1400-1452 the white suit above is brighter than the tube and the line is the fit
# across). The short vertical at the left end (the side panel's rear edge) stays.
feat("rail", [M("side-panel-rear-edge", rev=True, straight=True), {"tube_edge": "top", "corner": True, "straight": True}],
     1, "c", "contour", "g2-rail", r=4, pin="as-authored", gesture=2, src_inv="side-panel-rear-edge,cockpit-rail-upper")
feat("helmet", [M("helmet-outline")], 1, "c", "contour", "g3-helmet", r=4, pin="ccw", gesture=3, closed=True, overrun=10)
# Revision 2 drew the main hoop as ONE gesture: the dark block's outer edge bottom-up, a corner at
# (1418.5, 484), the block's top edge, a corner at (1427, 484), up the arch tube's left edge, over the
# arch. Revision 4 (critics, BLOCKING): that 9.3 src px step at y 484 read as a kinked hoop (a Z),
# most of all in P1. The P1 contour is now the arch alone, drawn from its right end over the top and
# down the leg's left edge (it continues from (1429, 476) down to (1427.8, 483.9): luminance steps
# 164 -> 52 at row 476, 142 -> 63 -> 0 at row 482) to where the leg meets the block, run on (about 2
# src px) to the block's drawn top line. The block (inventory: the wide black leg) is its own P2 FORM
# stroke, 'leg-block', below: its top line crosses the leg's foot, so the leg reads as entering it.
# Revision 6 (main loop: allow one short joining stroke at the pink sleeve so the column meets the arch):
# the hoop gesture now starts at the column's top and runs up the sleeve's RIGHT edge (bright sleeve |
# black brace body, measured per row: (1510.0, 470), (1509.8, 472), (1510.5, 476), (1511.0, 482),
# (1511.7, 488), (1512.8, 494); straight fit (1509.37, 467.53) -> (1512.64, 495.60), residual max
# 1.24 src px, 1.00 of its samples within 1 src px on the edge's own polarity) into the arch's right
# end, then over the arch as before. One stroke instead of a separate 28 src px stroke: the engine
# build rejects any line under 40 src px, and the sleeve's right edge, not its left, shares its top
# with the arch's end and the brace's start. The left edge was measured and rejected
# (revision_6.pink_sleeve): no line on it comes within 6 src px of a drawn line at either end.
feat("hoop-leg-arch", [G([[1512.64, 495.60], [1509.66, 470.0]], nosnap=True, straight=True),
                       G([[1512.6, 467.5], [1512, 463], [1510, 454], [1507, 445], [1502, 437], [1495, 431], [1486, 427], [1476, 426], [1466, 427.5],
                          [1456, 431], [1446, 437], [1438, 446], [1433, 455], [1430, 466], [1429.0, 476.0], [1428.0, 480.0], [1427.8, 483.9]], r=3)],
     1, "c", "contour", "g4-hoop", r=4, pin="as-authored", gesture=4, nosplit=True, meet={"e": {"to": "leg-block", "max": 3, "pad": 0}},
     src_inv="pink-sleeve,arch-outer",   # pink-sleeve: its right edge only. The arch is authored on the tube's outer edge: the inventory guide snapped to the stronger inner edge
     leg_edge={"from": [1512.64, 495.60], "to": [1509.66, 470.0], "polarity": -1,
               "rows": [[1510.0, 470], [1509.8, 472], [1510.5, 476], [1511.0, 482], [1511.7, 488], [1512.8, 494]]})
# Revision 7 (polish round 2026-11-10; the main loop's decision on the truth critic's optional polish, an
# agent decision, not the owner's): the column's top edge is drawn at the start of the stroke, so the post
# meets the hoop leg instead of starting 18.3 src px left of and 3.6 below the leg's end. From the leg's
# end (1512.64, 495.6) left along the measured top edge (the luminance step of bright sleeve / background
# above, black column below: y 495.6 / 494.1 / 496.2 / 497.4 at x 1512 / 1509 / 1502 / 1495; black on
# black only at x 1499-1500), then one corner at the column's top-left, where the top edge's last chord
# meets the column's left edge (corner_x: build_art.assemble puts the corner at the intersection of the
# two lines, about (1494.2, 497.5), instead of a 1.7 src px link to the straight fit's start (1494.3,
# 499.2), which would have made two pen stops 1.7 src px apart), and on down the left edge as before.
feat("hoop-column", [G([[1512.64, 495.60], [1512.0, 495.6], [1509.0, 494.1], [1502.0, 496.2], [1495.0, 497.4]], nosnap=True),
                     M("column-left", straight=True, corner=True, corner_x=True)],
     1, "c", "contour", "g4-hoop", r=4, pin="as-authored", gesture=4,
     top_edge={"pts": [[1512.64, 495.60], [1512.0, 495.6], [1509.0, 494.1], [1502.0, 496.2], [1495.0, 497.4]], "polarity": 1})
# revision 2: the brace's outer edge runs on, straight, past the guide's start (1531, 507) up to the
# pink sleeve under the arch's right end: the dark-to-grass edge measured at (1514.5, 474), (1517, 480),
# (1519.5, 486), (1521.5, 490), (1524, 494) has the brace's slope. The brace now starts there, so
# the arch and the brace meet instead of leaving a 40 src px gap above the column.
# revision 4: its lower end runs on along its own line (<= 8 src px) to the top edge of the dark bar
# below it (bar-below-brace), so the brace ends on a drawn line instead of in white
feat("brace", [M("brace-outer-edge", straight=True)], 1, "c", "contour", "g5-brace", classes="DT", r=4, pin="as-authored", gesture=5,
     extend_start_to_y=469.0, meet={"e": {"to": "bar-below-brace", "max": 8, "pad": 0}})
feat("brace-centre", [M("brace", straight=True)], 1, "c", "contour", "g5-brace", classes="P", mode="valley", r=5, lsig=2.5, pin="as-authored", gesture=5)
# revision 4 (critic A5): its first 9.5 src px passed the start of shadow-ground-rear as a tick: the
# counter-clockwise silhouette now starts at the shadow line's start
feat("rear-tyre", [M("rw-silhouette")], 1, "y", "contour", "g6-rear-tyre", r=5, pin="ccw", gesture=6, trim_start=9.5)
# revision 2: the counter-clockwise silhouette starts at the bottom right, where it curled inward
# under the rim (a hook): its first 25 src px are cut. Revision 4 (critic A4): it still started 11
# src px below the rim's lowest point heading up-right (a hook below the wheel at 1440): 12 src px
# more are cut, so it starts at about the rim's lowest point (y 892.6)
feat("front-tyre", [M("fw-silhouette")], 1, "y", "contour", "g7-front-tyre", r=5, pin="ccw", gesture=7, cut_below_y=(1400, 830), trim_start=37.0)
# revision 2: D and T only (at P, 20 CSS px wide, it read as a bump on the nose).
# revision 3: far-front-crown moved to P2 (FORM weight, nose-top area), same geometry: drawn at
# contour weight alone on the nose line it read as a blister in the bodywork.

# ------------------------------------------------------------------ P2 form
# nose top
# revision 2: D and T only (its 219 is drawn again at D and T; drawn blank at P it read as a hatch or window)
# revision 6 (main loop): D only. Drawn blank at 768 it read as a band or window across the nose; at D
# the nose-top 219 fills it
feat("top-plate", [M("top-plate", corners=True)], 2, "f", "form", "nose-top", classes="D", r=4, closed=True, tol=0.5)
# revision 4: the critics asked to drop it at D and T (it read as a blister on the nose) or draw it at
# DETAIL weight; the main loop's decision (P2, FORM weight, D and T) overrode that. Kept from the
# critics: each end stops short of the nose line, so it reads as something behind the body.
# Revision 5 (main loop): DETAIL tier (d, #505b66, factor 0.42), still P2 'nose-top', D and T. Its end
# gaps to nose-loop must stay visible: the centre-line gap is 4.7 src px, which leaves >= 1 CSS px of
# white between the two inks at 768 (T, 0.4604 CSS px per src px, contour 1.57 + detail 0.69 CSS px
# wide), 1.4 at 1280 and 1.9 at 1440, untapered (build_art: gates.crown_gap). At 2.0 src px the inks
# touched at every width (the ends were also flagged joined, so they had no taper).
# Revision 6 (main loop): D only (at 768 a pale arc of about 30 CSS px floating above the nose, read as a bump).
feat("far-front-crown", [M("far-front-crown")], 2, "d", "form", "nose-top", classes="D", r=3, pin="as-authored",
     clear_ends={"from": "nose-loop", "gap": 4.7})
feat("stripe-upper-front", [G([[1211, 700], [1160, 721], [1110, 743], [1048, 761], [1004, 776], [961, 792], [951, 790]]),
                            G([[949, 784], [976, 758], [1021, 724], [1069, 695], [1120, 675], [1146, 666]], corner=True)],
     2, "f", "form", "nose-top", r=4, src_inv="stripe-upper-edge-front")
# cockpit
# revision 5 (cross gate): one end ran 4.3 src px past nose-loop (a small X above the silhouette at
# (1345.1, 653.4)); the stripe's edge ends at the silhouette in the photo, so that end is trimmed there
feat("stripe-upper-rear", [M("stripe-upper-edge-rear")], 2, "f", "form", "cockpit", r=4, trim_at=[{"to": "nose-loop", "max": 8.0}])
# revision 3: the tube's bottom edge as one straight line (build_art.tube_edges(), the truth critic's
# bottom-edge measure), its start run on along its own line to the side panel's rear edge (rail)
feat("rail-lower", [{"tube_edge": "bottom", "straight": True}], 2, "f", "form", "cockpit", r=3, src_inv="cockpit-rail-lower",
     meet={"s": {"to": "rail", "max": 9, "pad": 0}})
# side plate
feat("side-plate", [M("side-plate", corners=True)], 2, "f", "form", "side-plate", r=3, closed=True, tol=0.5)
# front wheel (rim arcs come from the ellipse fit in build_art.py: fw-rim-seen / fw-rim-fit)
feat("fw-tread-edge", [M("fw-tread-sidewall")], 2, "f", "form", "front-wheel", r=5)
feat("fw-rib-1", [M("fw-rib-1")], 2, "f", "form", "front-wheel", classes="DT", r=4)
feat("fw-rib-2", [M("fw-rib-2")], 2, "f", "form", "front-wheel", classes="D", r=3)
feat("fw-bead-lower", [M("fw-bead-lower")], 2, "f", "form", "front-wheel", classes="D", mode="ridge", r=3)
# rear wheel
feat("rw-tread-edge", [M("rw-tread-sidewall")], 2, "f", "form", "rear-wheel", r=4)
feat("rw-sidewall-lower", [M("rw-sidewall-lower")], 2, "f", "form", "rear-wheel", classes="DT", r=4)
# hoop interior: named guides only
# revision 4: the dark block the hoop leg enters (inventory 'left-leg-shroud-*' / 'left-leg-top', a
# working label: the wide black leg), its own stroke after a pen lift. Its top edge is one straight
# line from beside the leg's right edge across the leg's foot to its top-left corner: measured on the
# lit top lip (left of the leg a light-to-dark drop of 31-62 levels at y 483.5-485.5; across the leg's
# foot the lower side of a faint light line at y 486-488, x 1430-1438), straight within 0.52 src px,
# 0.95 of its 1-px samples within 1 src px of a measured edge. Then a corner and down the block's
# outer edge to the helmet. The arch's end runs on (<= 3 src px) to this line, so the leg ends ON the
# block (a T) instead of stepping sideways into it. Not drawn: the 8 src px edge right of the leg at
# y 481.5 (the bottom of the background triangle between the leg and the lens support) and the block's
# inner edge, which registers only over y 502-530 (28 src px, under the 40 src px gate).
feat("leg-block", [G([[1437, 486.8], [1417.9, 484.1]], straight=True, r=1.5), M("left-leg-shroud-outer", corner=True, straight=True)],
     2, "f", "form", "hoop", r=3, pin="as-authored", src_inv="left-leg-top,left-leg-shroud-outer")
feat("arch-inner", [M("arch-inner")], 2, "f", "form", "hoop", classes="DT", r=3)
feat("leg-inner", [M("left-leg-top", straight=True), G([[1437, 487], [1431, 509], [1427.5, 522]], corner=True, straight=True)], 2, "f", "form", "hoop", r=3,
     src_inv="left-leg-shroud-inner")
feat("column-right", [M("column-right", straight=True)], 2, "f", "form", "hoop", r=4)
feat("brace-inner", [M("brace-inner-edge", straight=True)], 2, "f", "form", "hoop", classes="DT", r=3)
# revision 2: the housing outline's upper piece (lens-housing-a) ran 4-5 src px inside the black
# housing at its right end (x 1480-1488). Cut at x 1478 it is 35 src px, under the 40 src px gate, so
# it is re-traced instead from an authored guide on the housing's top edge (lit window above, black
# housing below: dark from row 446 at x 1452-1458, 443-444 at x 1461-1482, 447-448 at x 1485-1491).
feat("lens-housing", [M("lamp-housing")], 2, "f", "form", "hoop", classes="DT", r=3, closed=True, tol=0.5, piece_drop=["a"])
# Revision 7 (polish round; main loop's decision on the truth critic's polish, an agent decision): its first 6
# src px (x 1443.2-1449, y 446-448) ran inside the black where the housing meets the hoop's left leg, with no
# edge there (the only run of the line over 2 src px from an edge): cut (trim_start, along the authored
# direction, which is also the drawn one). About 40.7 src px remain (the 40 src px gate holds).
feat("lens-housing-top", [G([[1443, 447.2], [1452, 445.4], [1461, 443.4], [1470, 443.0], [1478, 443.2], [1484, 444.8], [1489, 447.0]])],
     2, "f", "form", "hoop", classes="DT", r=2, src_inv="lamp-housing", trim_start=6.0)
# revision 5 (main loop): an open loop with a 12.5 % gap (10-15 %) at its upper left, where the traced
# loop closed with a small curl: closed, inside arch-inner and the lens housing, it could read as the
# visor of a second helmet at DPR 2 (critic). build_art: open_gap.
# Revision 6 (critic, polish): the snapped loop's bottom span (x 1452-1476) ran at y 470.5-471.1, on the
# housing's bezel 2-4 src px below the amber. The loop is now the amber's own boundary: the R-B = 25
# iso-line (R-B smoothed by a 0.7 src px Gaussian), sampled on rays from the lens centre every 1.5 deg
# and smoothed over +-2 samples (build_art.iso_member). Same open gap as revision 5.
feat("amber-lens", [{"iso": {"level": 25.0, "centre": [1465.5, 461.0], "sigma": 0.7, "step_deg": 1.5, "smooth": 2.0, "rmax": 26.0}}], 2, "f", "form", "hoop",
     r=2, closed=True, src_inv="lamp-lens", open_gap={"frac": 0.125, "at": [1452.0, 451.0]})
# Revision 6 (truth critic, BLOCKING): the old line copied the inventory guide (15 deg off the tube) and
# for y 489-506 followed the red block's left side. Now one straight line on the tube's right edge (the
# critic's per-row fit x = 0.502 y + 1210.4; this build's own fit (1448.07, 474.12) -> (1478.02, 532.99)),
# not snapped. The red block hides the tube's right edge for y 491-503: drawn through an occluder.
feat("diag-tube", [G([[1448.3, 474.0], [1478.0, 533.0]], nosnap=True, straight=True)], 2, "f", "form", "hoop", mode="edge", r=2,
     src_inv="diag-tube", occluded=[{"y": [491.0, 503.0], "by": "the red block (not drawn)"}], member_edge={"polarity": -1})
# box behind the helmet
# revision 5 (cross gate): its start lay 5.6 src px inside the helmet outline (an X at (1455.2, 539.8)); the
# helmet hides the box there, so that end is trimmed back to the helmet's drawn outline (a T)
feat("box-top-right", [M("black-box-top", straight=True), M("black-box-right", corner=True, straight=True)], 2, "f", "form", "box", r=3,
     trim_at=[{"to": "helmet", "max": 8.0}])
# revision 5 (main loop, critic): the stroke's top-right corner (1551.6, 556.9) and 13 src px round it lay
# up to 6.1 src px inside the brace's black body, past brace-inner: a small X at brace-inner. The panel is
# clipped at brace-inner: the right edge ends where it meets brace-inner (a T). The top edge, clipped at
# brace-inner, is 22.9 src px from column-right to brace-inner: under the 40 src px gate as a stroke of
# its own, so it is not drawn (the critic's second option: one stroke ending at the brace-inner crossing).
feat("pale-panel", [M("pale-panel", gi=1, straight=True)], 2, "f", "form", "box", r=3,
     trim_at=[{"to": "brace-inner", "max": 10.0}])
feat("grey-wedge-far", [M("grey-wedge-far")], 2, "f", "form", "box", r=3)
# rear bay (revision 3, main loop's rule): real frame members drawn right after the box (area
# 'rear-bay'), each straight (snapped edge within 1 src px of the line), >= 55 src px, >= 0.90 of its
# samples within 2 src px of a measured edge, and at least one end within 6 src px of a drawn line
# or of the rear tyre. Named as tubes, no function claimed. D and T; none at P (fix r2: P draws rear-tube-level).
#   rear-tube-level: the long straight member at y 705-708 (inventory 'arm-upper'), its top edge;
#     its right end lies on the rear tyre's silhouette.
#   lower-rail-top: the lower side rail's lit top edge; its start is run on along its own line to
#     the front tyre's silhouette (8.5 src px; the edge stays measured: registration of the whole
#     line in its record), where the rail passes behind the tyre.
# Held (traced, measured and gated, not drawn; flip 'hold' off to ship): see build_art.REAR_BAY_HELD.
# Revision 4 (critic A3): the free ends lift off (taper) instead of stopping: rear-tube-level starts on
# the rear tyre and lifts off at its left end; lower-rail-top starts on the front tyre and lifts off at
# its right end (pinned; no geometry changes).
# Revision 6 (critic, polish; main loop: apply): the free ends are blunt (no taper), so they read as
# tube ends and not streak tails (build_art.apply_blunt). Joined ends unchanged.
# Fix r2 (2026-11-10; the main loop's decision, an agent decision, not the owner's): class P draws rear-tube-level
# too, the one D/T rear-bay member that touches the rear tyre (0.69 src px), so the phone's rear tyre no longer floats
# free (its nearest drawn line was brace-centre, 59 src px away). Same geometry, no new tracing; drawn at its D/T pen
# position (after shadow-ground-rear). bar-below-brace and lower-rail-top stay D and T (build_art.FIX_R2_P_BAY).
feat("rear-tube-level", [M("arm-upper", rev=True, straight=True)], 2, "f", "form", "rear-bay", classes="DTP", mode="edge", r=2, pin="as-authored",
     blunt=["e"])
feat("lower-rail-top", [M("lower-rail-top", straight=True)], 2, "f", "form", "rear-bay", classes="DT", mode="edge", r=3, pin="as-authored",
     meet={"s": {"to": "front-tyre", "max": 12, "pad": 0}}, blunt=["e"])
# revision 4 (critic A2): the thick dark bar directly under the brace's end, its top edge (asphalt
# above on its right half, y 669-670 at x 1612-1630; inventory 'beam-top' is a working label). The
# brace's end runs on to it (see brace).
# Revision 6 (truth critic, BLOCKING; main loop): the revision 4-5 line ran at 6.0 deg as a chord over a
# bent pair of members (the beam and, left of the V joint at x 1575-1581, a different bar sloping to a
# bolt). Now one straight line on the beam's top edge, y = -0.2263 x + 1036.16 (12.7 deg), from the V
# joint (1580, 678.61) to the measured corner (1630.5, 667.18), about 52 src px (the main loop accepts it
# under the 55 src px rear-bay length rule: >= 40). Not snapped. Drawn left to right (the engine draws it
# right after rear-tube-level, which ends at (1585, 705)); both ends are free and blunt. Over x 1602-1612
# the brace's end covers the bar's top edge (the brace lands on it there): recorded as a junction span.
feat("bar-below-brace", [G([[1580.0, 678.606], [1630.5, 667.178]], nosnap=True, straight=True)], 2, "f", "form", "rear-bay", classes="DT", mode="edge", r=2,
     pin="as-authored", src_inv="beam-top", blunt=["s", "e"], member_edge={"polarity": -1}, rb_min_len=40.0,
     occluded=[{"x": [1602.0, 1612.0], "by": "the brace's end (drawn; it lands on the bar here)"}],
     line={"slope": -0.2263, "icept": 1036.16, "x": [1580.0, 1630.5]})
# revision 4: the post under the bar, its top run on along its own line up to the bar's drawn top edge
# (through the bar's dark body; measured by the registration gate like the rest)
# revision 5 (main loop, BLOCKING): not drawn. It crossed rear-tube-level at about x 1621 and its top sat
# 5.7 src px left of bar-below-brace's start, so the three read as a '+' and a double cross by the rear
# tyre (1440 DPR 1 and 2, 1280); the critic's independent registration is 0.865 within 2 src px (3 of
# its 5 off samples are the 10.9 src px run-on through the bar's dark body). Held: traced and measured,
# not drawn (gates.rear_bay.held).
feat("post-below-beam", [G([[1624, 680], [1622, 710], [1620, 742]], straight=True)], 2, "f", "form", "rear-bay", classes="D", mode="valley", r=2,
     src_inv="strut-short", pin="as-authored", meet={"s": {"to": "bar-below-brace", "max": 12, "pad": 0}},
     hold="revision 5 (main loop): dropped at D. It crossed rear-tube-level (a '+' at about (1621.5, 706.6)) and its top, run on through the bar's dark body, sat under bar-below-brace's start (a double cross); independent registration 0.865 within 2 src px (critic; 0.921 by this build's measure), under the 0.90 member rule by the critic's measure")
feat("column-below-rail", [M("column-below-rail", straight=True)], 2, "f", "form", "rear-bay", classes="DT", mode="edge", r=2,
     hold="registration 0.889 < 0.90: the column's right edge disappears for about 10 src px at y 714-724, where the clutter behind it is as black as the column")
# helmet
feat("visor-brow", [M("visor-brow")], 2, "f", "form", "helmet", r=3, pin="as-authored", meet={"s": {"to": "helmet", "max": 8, "pad": 0}})
# driver: at most 10 named strokes (critic), straps as centre lines
feat("collar", [M("collar-near")], 2, "f", "form", "driver", r=3)
feat("neck", [G([[1388, 630], [1395, 637], [1405, 640], [1415, 639], [1425, 634], [1432, 628]])], 2, "f", "form", "driver", classes="DT", r=3, src_inv="neck")
# revision 5 (main loop, BLOCKING): torso-edge and sleeve-band were two strokes starting 1.63 src px
# apart at (1440, 651), both tapered there: a V-notch in the arm at 1440 DPR 2. Now one continuous
# stroke (the main loop's "arm"; neutral id 'sleeve-torso'): the sleeve band reversed, from its end
# (1474.7, 665.5) round to (1440, 651), then on down the torso edge to (1402.2, 679.8). The members
# join with ink (gap <= 6 src px), blended over +-12 src px (assemble()), so there is no notch and no
# pen stop. D and T. At P neither is drawn (the lone torso-edge read as '/'); collar stays.
# Revision 6 (critic, polish; main loop: apply if registration holds): its first 10 src px (the downturn
# at the right end, (1482.5, 653) down to (1474.4, 665.3)) are cut: the rise, crest and drop with the
# neck's U read as a slight '~' at DPR 2.
feat("sleeve-torso", [M("sleeve-band", rev=True), M("torso-edge", rev=True)], 2, "f", "form", "driver", classes="DT", r=3, pin="as-authored",
     src_inv="sleeve-band,torso-edge", trim_start=10.0)

# ------------------------------------------------------------------ P3 detail (glyphs come from glyph-order.json)
# Revision 2: stripe-far-band (98 % of it lay within 2 src px of top-plate's upper-left edge: a
# redraw), rear-box (a tilted square hung on the brace; no new tube lands on its corners) and the
# rear-frame strokes beam-strut and beam-lower-post (drawn alone they read as a bracket or pentagon
# by the rear tyre) are dropped. The nose-top 219 is drawn again (glyph-order.json, D and T).

# ------------------------------------------------------------------ P4 shadow edges (SHADE tier, open)
# Revision 2: P3 now ends on the nose top (its 219), so P4 starts under the nose and sweeps left to
# right: the nose shadow, then the rear one. D and T: only the curving right piece of the body
# shadow's outer edge (x 1094-1236, rising to y 878). The flat left piece (909 -> 916, about 2 deg,
# about 60 src px below the lowest drawn nose point) read as a ground or horizon line at 768 (critic)
# and, drawn alone at 1440, as a long swoosh under the nose; art PLAN risk 9 rules both out, so D
# drops it too. P draws no shadow (the develop shows the photo's own).
# Revision 3: the nose shadow is not drawn at D and T either (its nearest point lay 110 src px from
# any drawn line, so with no underside line it read as a horizon or speed stroke). The rear shadow
# edge stays (it ends 2.7 src px from the rear tyre and works as the tyre's lower edge) but moves
# into P2, area 'rear-wheel', straight after rw-rim-fit, at DETAIL weight; P4 is empty. It is a
# traced line on the cast shadow's outer edge, recorded in provenance as drawing convention.
# Revision 7 (polish round; the main loop's decision on the feel critic's A1, an agent decision): class P draws
# it too (D, T, P), so the phone's rear tyre is no longer an open arch with no ground line. Same geometry.
feat("shadow-ground-rear", [M("shadow-rear")], 2, "d", "form", "rear-wheel", classes="DTP", r=4, keep_tail=110, after="rw-rim-fit",
     convention="shadow edge")

# ------------------------------------------------------------------ left out on purpose (recorded in provenance)
DROPPED = {
    "thin-rod": "34 src px, under the 40 src px build gate",
    "visor-seal": "a second curve under the visor's lower edge read as a double grin on the 63 px helmet",
    "red-block": "a blurred red blob of about 20 x 14 src px with no measurable corners: the traced outline came out as a circle, which the photo does not show",
    "side-panel-lower-fold": "faint, split into pieces by the edge test; the one piece left read as a stray line under the lettering",
    "fw-rim-upper-arc": "15 src px after the edge test, under the 40 src px gate", "rw-rim-upper-arc": "15 src px after the edge test, under the gate",
    "harness-strap-1, harness-strap-4, harness-strap-5": "the shoulder strap shows as separate red patches of 16-22 src px with black webbing between: under the 40 src px gate. The lap belts join into one red V, drawn as one centre line (strap-lap)",
    "orange-tab": "a 12 x 8 src px tab, under the 40 src px build gate",
    "chin-slot-upper": "9 src px, under the 40 src px build gate", "chin-slot-lower": "9 src px, under the 40 src px build gate",
    "helmet-badge": "closed outline of about 36 src px, under the 40 src px build gate",
    "suit-pale-panel": "three pieces of about 25 src px each: under the gate, and the critic's 10-stroke driver limit",
    "pale-wedge": "25 src px, under the 40 src px build gate",
    "fw-rim-inner-arc-a": "about 25 src px, under the 40 src px build gate", "fw-rim-inner-arc-b": "about 25 src px, under the gate",
    "rw-rim-inner-arc-a": "about 25 src px, under the 40 src px build gate",
    "fw-spoke-right": "read as a question mark on the hub (pilot critic): dropped",
    "tube-a": "11 src px, under the gate", "tube-b": "11 src px, under the gate", "tube-c": "16 src px, under the gate",
    "tube-d": "20 src px, under the gate", "tube-e": "22 src px, under the gate",
    "line-c": "25 src px, under the 40 src px build gate",
    "shadow-rail": "27 src px, under the 40 src px build gate",
    "sae-mark": "the SAE letters sit on the bare nose top: no block edge exists to trace, so a 'block outline' would be invented",
    "top-names, side-names-front, side-names-rear": "people's names are never traced",
    "top-t-logo, top-tesla-word, top-stripe-logo, side-mark, sae-mark (logo form)": "third-party marks are never traced",
    "fw-hoosier-*, rw-hoosier-*": "tyre brand lettering, never traced",
    "arch-stalk, arch-top-object": "open owner question; default not drawn",
    "green-patch": "not drawn (shares its line with arch-inner; nothing proves it is a lamp)",
    # revision 1 (2026-11-07 critics)
    "visor-lower": "with the brow it closed a 'D' inside the round helmet that read as a smiley face in every class; the brow alone stays",
    "visor hatch (critic option)": "not drawn: PEN_SPEC 6.3 deny-lists visor hatch (the visor has real reflections; a clean helmet reads better)",
    "strap-lap": "a 46 src px U round the buckle read as the letters 'c/p' at page scale (1440 DPR 2, 390 DPR 3)",
    "blue-cuff": "a 40.5 src px closed loop with a start hook read as the letter 'o'",
    "blue-object": "its U enclosed the black shadow under the part; the bright-blue body (rows 636-648) lay outside it",
    "neck, sleeve-band at P": "at 390 the visor and driver were 7 strokes in about 25 CSS px; P kept collar and torso-edge (revision 1); since revision 5 P keeps collar only",
    "top-label": "a correct outline of a real decal, but drawn blank it read as a vent or hatch on the nose",
    "top-plate-numerals (nose-top 219) at P": "revision 2 draws it again at D and T (without it the plate read as a blank band); at P the plate is not drawn",
    "rod-lit, ribbed-shape-left, ribbed-shape-right, rail-behind-hoop": "near-horizontal single edges with a free end (no drawn line within 4 src px): they read as speed lines. Revision 2 tried rail-behind-hoop as a rear-bay tube (its ends near the rail and the brace): 72 % registered in ridge mode, 1.3-1.5 src px from straight, so it fails the tube rules. Revision 3: rod-lit is 39.8 src px (under the 55 src px tube rule and the 40 src px gate); rail-behind-hoop is still 1.3-1.5 src px from straight",
    "arm-upper, lower-rail-top (revisions 1 and 2)": "left out then as near-horizontal edges with a free end. Revision 3 draws them (rear-tube-level, lower-rail-top) under the main loop's rear-bay rule: straight, >= 55 src px, >= 0.90 registered, one end within 6 src px of a drawn line or the rear tyre",
    "post-below-beam, column-below-rail (revision 3)": "traced, measured and held, not drawn: the post has no end within 6 src px of a drawn line or the rear tyre (rear-tube-level crosses its middle); the column below the rail is registered 0.889 (< 0.90) because its right edge disappears for about 10 src px against black clutter. Revision 4 draws the post (D): its top runs on to the bar's drawn top edge (bar-below-brace). The column stays held",
    # revision 4 (critics of the revision 3 films)
    "leg-block right side (revision 4)": "the 8 src px edge right of the hoop leg at y 481.5 (x 1436-1444: the bottom of the background triangle between the leg and the lens support, about 6.5 src px above the block's drawn top line) and the block's inner edge, registered only over y 502-530 (28 src px): both under the 40 src px gate. The block's top line across the leg's foot is drawn instead",
    "rw-rim-fit right side and lower right (revision 4)": "about 40 src px of the rim fit in pure black (luminance 0-3), 2.7-4.7 src px inside the tyre outline: a doubled outline at 1440. The fit now ends where its edge support ends (about (1746, 707)); the seen arc carries the lower left",
    "tube from the bar's right end to the rear tyre (revision 4 candidate)": "about (1632, 686) to (1654, 697): about 25 src px, under the 55 src px member rule and the 40 src px gate",
    "rear-tube-level at P (revision 4, critic A2)": "superseded by fix r2 (2026-11-10, an agent decision): class P draws rear-tube-level. Until then: the main loop's rear-bay rule ships no rear-bay member at P; the phone's rear tyre stays detached (owner-visible trade-off, reported)",
    "shadow-ground-front-right (revision 3)": "the curving right piece of the nose shadow's outer edge (D, T): its nearest point lay 109.5 src px from any drawn line (77-105 CSS px at 1440), so with no underside line it read as a horizon or speed stroke, and at T as a stray dash. Not drawn; no other lone ground line replaces it",
    "beam-top, beam-lower, diag-to-tyre, strut-short": "revision 2: drawn alone as beam-strut and beam-lower-post they read as a bracket or pentagon by the rear tyre, and at P they were the last ink, drawn during the develop. As straight rear-bay tubes: the beam (75 src px at -6 deg) has both ends 24-32 src px from any drawn line and its right half alone runs at -15 deg; diag-to-tyre is 39 src px and the post 18 src px, under the 60 src px tube rule",
    "rear-box": "revision 2: a tilted square hung on the brace with no tube leading to it; the rule was to keep it only if two new rear-bay tubes land on its corners, and none does",
    "stripe-far-band": "revision 2: 98 % of its 42.8 src px lay within 2 src px of top-plate's upper-left edge (a redraw)",
    "pale-strip-upper, pale-strip-lower": "revision 2: 43-46 % of each closed outline retraced hoop-column and box-top-right; the rest were 5-10 src px end caps, so the column read as a ladder with double lines",
    "pink-sleeve": "revision 2: its two edges and the short bottom read as a small 'J' hook under the arch's right end",
    "far-front-crown at P": "revision 2: at 20 CSS px it read as a bump on the nose, and it cost a seen-hand stroke that jumped back to the nose after the helmet",
    "shadow-ground-front-short (T), shadow-ground-front (D)": "revision 2: the flat left part (909 -> 916, about 2 deg, about 60 src px below the nose) read as a ground or horizon line at 768 (critic) and as a long swoosh under the nose at 1440 (the D stroke had the same flat part). D and T draw the curving right piece instead (shadow-ground-front-right, x 1094-1236)",
    "shadow-nose tip and notch, shadow-wedge, shadow-front": "the outline joined the nose contour and ended in a 118 deg spike: drawn alone it read as a hull or skid plate. One open edge remains",
    "shadow-rear (closed loop)": "closed on the rear tyre it read as a puddle; an open arc of 110 src px remains",
    "hatch-panel-left, hatch-panel-right": "2-3 parallel flicks inside a drawn rectangle read as glass glare (the black side panel looked like a window); single flicks read as scratches",
    "tyre shading arcs": "concentric arcs read as '(((' motion marks; the outer ones stood in for a silhouette the photo does not show",
    "acc-helmet-lower-left": "P5 sweeps left to right in five places (nose, front tyre, column, rear tyre); the helmet accent was the zig-zag's back-step",
    # revision 5 (2026-11-09: critics of the revision 4 films and the main loop's decisions)
    "post-below-beam (revision 5)": "held, not drawn at D: with rear-tube-level and bar-below-brace it read as a '+' and a double cross beside the rear tyre; independent registration 0.865 (critic)",
    "torso-edge, sleeve-band as separate strokes (revision 5)": "merged into one stroke, sleeve-torso (D, T); at P neither is drawn (the lone torso-edge read as '/')",
    "pale-panel top edge (revision 5)": "clipped at brace-inner it is 22.9 src px from column-right to brace-inner: under the 40 src px gate. The right edge alone ends on brace-inner (a T)",
    "top-219 at T (revision 5)": "at 768 the digits are 7.4-9.0 CSS px tall and read as curls; PEN_SPEC 3 puts the nose-top numerals at D",
    # revision 6 (2026-11-09: critics of the revision 5 films and the main loop's round 6 decisions)
    "top-plate at T (revision 6)": "drawn blank at 768 (DPR 1 and 2) the parallelogram read as a band or window across the nose; it is true but says nothing without its numerals, which are drawn at D only. D keeps it (top-219 fills it)",
    "far-front-crown at T (revision 6)": "at 768 a pale arc of about 30 CSS px floating above the nose, read as a bump; D keeps it",
    "pink sleeve's left edge (revision 6)": "measured (straight fit (1504.54, 468.29) -> (1501.33, 495.92), 1.00 within 2 src px on its own polarity) but no line on it joins a drawn member: its top lies 6.3-6.8 src px from the brace and the arch, its bottom 7.8 src px from hoop-column, and it is 28 src px (the engine build rejects lines under 40). The sleeve's right edge, which shares its top with the arch's end and the brace's start, is drawn instead as the start of hoop-leg-arch",
    "red-block (revision 6 note)": "still not drawn; diag-tube is drawn through it (provenance: drawn through an occluder)",
    # revision 7 (2026-11-10 polish round: the main loop's decisions on the round 6 critics' optional polish; agent decisions, not the owner's)
    "rear-tube-level at P (revision 7 note)": "superseded by fix r2 (2026-11-10, an agent decision): class P draws rear-tube-level. Until then: still no rear-bay member at P (the main loop's rear-bay rule). Since revision 7 the phone's rear tyre is closed below by shadow-ground-rear, which P now draws",
    # fix r2 (2026-11-10: the main loop's decision, an agent decision, not the owner's)
    "bar-below-brace and lower-rail-top at P (fix r2)": "not drawn at P. Class P draws only rear-tube-level of the D/T rear bay, the smallest set that ties the rear tyre in (it touches the tyre, 0.69 src px). bar-below-brace would fail the rear-bay connection rule at P: the brace lands on it at D and T, but P's brace-centre ends 9.1 src px from it (> 6) and neither of its ends is within 6 src px of a drawn P line or the rear tyre. lower-rail-top runs from the front tyre and ends 73 src px from the rear tyre, so it ties nothing to it",
    "rw-rim-seen's lower end (revision 7)": "its first 7.2 src px (from (1730.1, 779.7) down round to the arc's lowest point (1723.4, 782.2)) are cut: a true edge (the lit rim lip over the dark groove, 1.00 of it within 2 src px on its own polarity), but it curled up toward rear-tyre's start 4.6 src px away and read as a hook into the tyre line at 1x and 2x (both critics). See provenance revision_7.rim_low_end",
    "lens-housing-top's first 6 src px (revision 7)": "x 1443.2-1449 at y 446-448 ran in the black where the housing meets the hoop's left leg: no edge (truth critic). Cut (trim_start)",
    "rear-bay fourth member (revision 7, A3)": "no candidate passes every gate, so none is added (nothing invented). Measured this round (releases/hero-pen-20261110/polish/measure/baycand.json): column-below-rail generic 0.889 and own edge 0.66 within 2 src px (< 0.90); diag-to-tyre 39.1 src px on the inventory guide (generic 0.857, own 0.73), its visible top edge 32.7 src px (< 40; run on through the bar's dark body to reach 40 it would follow no edge), its bottom edge 30.0; rod-lit 39.8 src px (< 40), near-horizontal (a 4th, over the limit of 3) and neither end within 6 src px of a drawn line (25 and 10); rail-behind-hoop straight within 1.51 src px (> 1), own edge 0.70, near-horizontal; the post below rear-tube-level 38.1 src px, generic 0.81; the post above it 35.1, generic 0.79; lower-rail-under (the same rail's underside) near-horizontal (a 4th) and within 8 deg of parallel to lower-rail-top about 5 src px away; line-b, line-c, tube-e 21-25 src px",
}


if __name__ == "__main__":
    (HERE / "inputs" / "features.json").write_text(json.dumps({"features": F, "dropped": DROPPED}, indent=1) + "\n", encoding="utf-8")
    print(len(F), "features")
