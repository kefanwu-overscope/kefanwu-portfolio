# Workbench prop source

`experience-workbench-details.js` contains original, generic procedural models.
No external model or product-photo licence is needed. The printer is not a
dimensionally verified replica of a branded product.

Integration in `experience.js`:

```js
import {
  buildDetailedPrinter,
  buildDetailedPegboardTools,
  refineWorkbenchInstruments,
} from './experience-workbench-details.js?v=workbench-details-20260926';

// Replace the old pegboard tool block; the new assembly includes hangers.
g.add(buildDetailedPegboardTools({ topY: TOP_Y, boardZ: bz }));

// Same placement, scale and yaw as the old buildBambuPrinter() result.
const printer = buildDetailedPrinter({ models: MODELS });
printer.scale.setScalar(0.8);
printer.position.set(-0.62, TOP_Y, 0.02);
printer.rotation.y = 0.1;
g.add(printer);
MODELS.printer = printer;

// Once the original six instrument groups exist, refine their actual geometry.
refineWorkbenchInstruments({ psu, solder, drivers, meter, scope, benchLamp });
```

Remove the old `mkHook` block, because the replacement tools provide attached
hangers. Existing instrument transforms and the live oscilloscope screen mesh,
texture and draw callback remain intact. Call the refiner once during startup.
Transparent printer glass/canopy should have `castShadow = false`.

The printer supplies the unchanged animation handles `MODELS.printerHead`,
`MODELS.chamberFan`, `MODELS.activeSpool` and `MODELS.printerStatusLed`. The
toolhead should sweep ±0.025–0.044 m along its X rail, keeping the nozzle over
the 0.10 m printed web. Its tip is at local Y=0.1745, Z=0.064. Only the fan
rotor moves, and the active spool rotates around X. Exclude those three moving
assemblies from static room batching. The environment bake uses one representative
printing pose for indirect occlusion and reflection; these props themselves
remain live meshes with live lighting.

Opaque source pieces are merged per material and moving assembly. A single
512² canvas atlas provides small instrument readouts, labels and etched scales.
The existing scope retains its separate live texture. The shared material
palette is deliberately satin and avoids a new transmission render pass.

Run `node tools/room-props/verify-workbench.mjs` to check finite geometry, bounds,
tabletop contact, instrument transform preservation, scope texture identity,
animation handles/travel, and draw/triangle/memory budgets. The standalone
headless build is 91 meshes, 78,238 triangles and 7,505,056 bytes of geometry
before room batching; its lamp fixture only includes refinement geometry, so
the live room also contains the existing lamp body. The printer is 30 meshes,
37,724 triangles; the complete pegboard tool set is 12 meshes, 21,970 triangles.

The headless check uses the same Three.js and source geometry as the website.
It does not measure GPU speed or replace browser inspection of the rendered
room. Browser QA and Cycles rebaking belong to the integration workflow.
