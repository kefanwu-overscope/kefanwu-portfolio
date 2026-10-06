# FSAE Racecar Brake — DR update, 2026-10-05

The authoritative achievement source is Mechanical Design Review1, brake slides
23–35, presentation1orhUsJPe5ssAuhbjYn1FMEqdGCs8-4Xmxa8L9I7TWK0.
The final read used revision-088OhLGU32BAA (modified2026-10-05T23:32:30.594Z).
Brake text and30 embedded figure hashes were unchanged from the first read.
The complete deck and authenticated image URLs stay outside the public repo.

## Source and result boundaries

- DR32 reports1.39→1.07lb (-23%) and11.55→9.35lb in² (-19%).
- DR32 reports90.75%front-rotor time in350–450°C after lap3, against80%.
- DR33 reports FOS2.455 and0.52mm deformation at14.93kN pad force,
  1517.96N m and450°C. Do not infer the factor from the displayed vonMises
  peak without its failure criterion; the page labels it as reported.
- DR34 gives53.95%reference damage and5.561 equivalent22km blocks. Do not
  call this demonstrated physical life or a verified pass of the separate
  >3endurance/66lap goal.
- Fabrication, caliper rebuilding and rear thermal integration are next steps.
- OEM source is used for technical formulation/provenance only. Its26segment
  implementation and4.7498mm thermal-study geometry differ from DR method
  prose and the current5.08mm display CAD. The page records those boundaries.

## Geometry

Source STEP: LT1_R5p08_72H_D0p400_T0p200_NATIVE.step,
SHA256358fcb7bae7686556526e9ffc241932f02924fac6bca8c15c7f3db527f1034a3.
Read-only tessellation in source/rotor-geometry.npz preserves56,404 triangles,
72 through holes of10.16mm, six mounting seats and24 shallow outer waves.
NativeX is thickness; Y/Z are the plate plane. The display is normalized and
rotated30degrees to match the review orientation. No OEM source file is modified.
The original neutral GLB/STEP audit and reproducible CAD tessellation script are
in ../.codex/brake-dr-20261005/ (relative to repository parent context).

Run Blender in background with build_studio_motion.py, then node package.cjs.
The existing optimizer is reused with a local source reader and a new output
folder; original legacy package URLs and the other15 project entries remain.
Run node tools/room-exhibits/export.mjs --only=brakeSim and merge its one catalog
entry. Keep model-index SHA metadata current.

Run node tools/brake-dr/serve.mjs and open
http://127.0.0.1:4195/__qa/export.html. Its explicit button exports onlybrakeSim:
121 SD frames,121 HD frames,3covers and4 phase occupancy masks. Run
python tools/brake-dr/pack_previews.py after completion. Other15 frame/cover
entries must remain byte-identical. The warming color remains a qualitative
illustration; it does not encode the DR temperature history or a spatial field.

The seven published evidence images are original source bytes, with unique
roles and preserved legends. Main and studio pages share the updated records.
Evidence, source audits, browser proofs and release backups are stored in
../.codex/brake-dr-20261005/.
