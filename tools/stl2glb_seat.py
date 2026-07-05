"""Convert the single-part driver-seat STL (7-CP06-P00-SEAT.STL, a bent-sheet
aluminum FSAE driver seat with a perforated pan/back and integral side
brackets) into models/real/driverseat.glb. The lone mesh is named mat_steel so
three.js applies the steel PBR material, recolored to light brushed aluminum
via matTweak in experience.js. The STL is already low-poly (~9.5k faces) so it
is kept at full resolution. This is the DRIVER seat (`seat` key), distinct from
the carbon seat (`carbonSeat` -> seat.glb from CF_Seat.STL); do NOT overwrite
seat.glb."""
import os
import numpy as np
import trimesh

SRC = r"C:\Users\oc\Desktop\STL\7-CP06-P00-SEAT.STL"
OUT = r"C:\Users\oc\Desktop\WEBSITE\portfolio-site\models\real\driverseat.glb"

m = trimesh.load(SRC, force="mesh")
m.merge_vertices()

scene = trimesh.Scene()
scene.add_geometry(m, node_name="mat_steel", geom_name="mat_steel")
scene.export(OUT)

kb = os.path.getsize(OUT) // 1024
print(f"OK driverseat: {len(m.faces)} tris, {kb} KB, extents {np.round(scene.extents, 1)}")
print("DONE")
