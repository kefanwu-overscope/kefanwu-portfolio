"""Convert the carbon-fiber seat shell (CF_Seat.STL) into models/real/seat.glb.

The STL is a mirrored two-half shell whose center seam carries 19 non-manifold
edges (>2 faces per edge). EVERY position-smoothing pass blows up there —
Loop subdivision grew ~70 mm seam spikes, Taubin drifted to ~90 mm — so this
script moves NO geometry at all. The faceted look was pure flat shading:
trimesh.graph.smooth_shade() splits vertices only along edges sharper than
40 degrees, giving smooth vertex normals on the shell while keeping the rim
and flange creases crisp. Node is named mat_carbon so three.js applies the
carbon-twill PBR bucket (UVs are box-projected at load).

Run with Blender's bundled Python (needs: pip install trimesh scipy rtree):
  C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/4.5/python/bin/python.exe tools/stl2glb_carbonseat.py
"""
import os
import numpy as np
import trimesh

SRC = r"C:\Users\oc\Desktop\STL\CF_Seat.STL"
OUT = r"C:\Users\oc\Desktop\WEBSITE\portfolio-site\models\real\seat.glb"

m = trimesh.load(SRC, force="mesh")
m.merge_vertices()
sm = trimesh.graph.smooth_shade(m, angle=np.radians(40))

# guard: shading-only fix — the geometry must be byte-identical to the source
assert len(sm.faces) == len(m.faces)
assert np.allclose(sm.area, m.area)

scene = trimesh.Scene()
scene.add_geometry(sm, node_name="mat_carbon", geom_name="mat_carbon")
scene.export(OUT)

kb = os.path.getsize(OUT) // 1024
print(f"OK carbon seat: {len(sm.faces)} tris, {len(sm.vertices)} verts, {kb} KB")
print("DONE")
