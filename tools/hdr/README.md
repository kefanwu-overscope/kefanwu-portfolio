# Standalone HDR worker service

Two runtime additions only: `experience-hdr.js` (ES module, no dependencies) and
`experience-hdr-worker.js` (21.4 KiB classic Worker, no imports). The page can keep
its CDN three.js r185 import map. Nothing under `tools/hdr` is fetched at runtime.
No npm installation, bundler, build step, browser, or server is needed to use the
checked-in artifacts. Worker execution still requires the normal static HTTP(S)
site context and a same-origin worker script allowed by CSP.

## API contract

```js
import * as THREE from 'three';
import { createHDRService, createHDRTexture } from './experience-hdr.js';

const hdr = createHDRService({ workers: 2 });
const pixels = await hdr.load(url, { flipRows: !isProbe, signal });
const texture = createHDRTexture(THREE, pixels); // MAIN THREAD; no pixel copy

if (isProbe) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  // Existing PMREMGenerator, renderer calls and target ownership stay here.
} else {
  texture.channel = 1; // Preserve the remaining prepLM behavior.
  // colorSpace is already THREE.LinearSRGBColorSpace.
  // Do not run the old prepLM/flipRows again: the worker already flipped rows.
  // Existing renderer.initTexture(texture) stays on main and may still stall.
}
```

The snippet belongs inside the caller's existing AssetQueue/HDR task. The
service does not touch LoadingManager, manager item counts, queue priorities,
asset caches, retries, renderer scheduling, light transitions or scene state.
Keep the existing `yieldToBrowser()` and error/texture-disposal paths as needed.
Call `hdr.dispose()` when the experience is torn down. The main agent owns this
integration; this change does not modify `experience.js` or any page/style file.

| API | Contract |
| --- | --- |
| `createHDRService({workers: 2, ...limits})` | Lazy pool of 1–2 workers. Positive worker counts above two are capped at two. Invalid configuration throws. |
| `load(url, {flipRows: false, signal} = {})` | Fetch and resolve to HDR pixel data, not a `DataTexture`. URLs follow the page's normal `fetch` resolution; same-origin credentials, bounded streaming body. HTTP and other failures reject. |
| `parse(arrayBuffer, {flipRows: false, signal} = {})` | Resolve to the same data. Accept a fixed, nonempty `ArrayBuffer`, not a typed-array view or SharedArrayBuffer. On acceptance it immediately transfers ownership with `structuredClone(..., {transfer})`: caller buffer detaches without copying. The service transfers it again to the worker when scheduled. |
| `createHDRTexture(THREE, result)` | Main-thread helper constructs a `THREE.DataTexture` around the exact returned array, using official r185 defaults and `needsUpdate=true`. It does not upload to GPU. |
| `getStats()` | Detached snapshot of counts, queue/worker state, active and peak byte reservations, transfer totals, aggregate worker timings and last asynchronous job failure. Does not retain past results. Immediate input/backpressure rejection happens before `submitted` and is not counted as an admitted job failure. |
| `dispose()` | Idempotently terminate workers, abort downloads and reject every unfinished request with `HDR_DISPOSED`. Completed arrays/textures remain caller-owned. Future calls reject. |

Each result contains:

```js
{
  data: Uint16Array, // RGBA half-float bit patterns for THREE.HalfFloatType
  width, height,
  type: 1016, format: 1023,
  colorSpace: 'srgb-linear', minFilter: 1006, magFilter: 1006,
  generateMipmaps: false, flipY: true,
  rowsFlipped: false, // true only when a physical row swap was requested
  header, gamma, exposure, source, // source is URL for load, null for parse
  timings: {
    thread: 'worker', workerIndex,
    validationMs, parseMs, flipMs, workerMs,
    inputTransferBytes, outputTransferBytes,
    queueMs, fetchMs, headerMs, decodeWaitMs, roundTripMs, totalMs,
    estimatedWorkingBytes
  }
}
```

JavaScript has no standard `HalfFloatArray` type expected by three r185 here;
`Uint16Array` preserves the exact official half-float bits. Result storage moves
back via `postMessage(..., [result.data.buffer])`, with no decoded-pixel clone.
Caller-held results consume memory until released; dispose unneeded textures
and release array references using the existing resource cache lifecycle.

`flipY` is also accepted as an **input-option alias for `flipRows`** to support
callers requesting a physical Y flip. Prefer the unambiguous `flipRows` spelling.
Passing conflicting values rejects. This input alias is distinct from the
**returned texture `flipY=true`**, which always matches official HDRLoader load
and the current `prepLM`: CPU row flipping does not change that upload flag.
Use `flipRows:true` for lightmaps and the default `false` for probes/environment
maps. `channel=1` remains the caller's lightmap-specific setting.

## Scheduling and memory

At most `workers` admitted tasks prepare/download at once. Decode admission is
based on parsed dimensions, never filename guesses. Any image with a side at
least 4096, or more than 2048² pixels, decodes exclusively, including against
small images. Two 2K maps may decode concurrently. Ready tasks are FIFO: small
jobs cannot bypass a ready 4K job. There are no hidden retries or result cache.

| Option | Default | Meaning |
| --- | ---: | --- |
| `maxQueued` | 16 | Total admission cap is this number plus worker count, including preparing and decoding tasks. |
| `maxInputBytes` | 32 MiB | Per compressed HDR input/download cap, checked on headers and every body chunk. |
| `maxRetainedInputBytes` | 64 MiB | Aggregate queued/prepared compressed buffers and fetch chunks held by the service before transfer. |
| `maxPixels` | 4096² | May be lowered; always capped at 4096². Maximum side is 16384. Header inspection is capped at 16 KiB. |
| `maxWorkingBytes` | 256 MiB | Aggregate estimated active decode buffers. Reserve `2*compressedBytes + 12*pixels + 16*width + 65536` per task. |
| `timeoutMs` | 120000 | Entire job, starting at admission and including queue wait. |
| `fetchTimeoutMs` | 60000 | Fetch and body read deadline. |
| `workerTimeoutMs` | 30000 | Worker startup plus decode and response deadline; failure terminates the worker. |
| `workerURL` | Versioned sibling JS URL | Optional deployment override. Default resolves relative to the module, independent of the page import map. |

These are admission/live-buffer estimates, **not a process RSS or GPU memory
guarantee**. GC, JS runtimes, caller-held outputs and textures add memory. The
streaming download path concatenates compressed chunks once on main; this can
temporarily add up to one `maxInputBytes` allocation, beyond retained-input
accounting. Decoded arrays are never concatenated or cloned on main. A 2K square
output is 32 MiB, a 4K square output 128 MiB. Configure one worker for tighter
CPU use; smaller budgets can explicitly reject 4K rather than hang.

## Failure boundary

There is deliberately **no automatic main-thread decode fallback**. Every
failure rejects with `error.name='HDRServiceError'` and a stable `error.code`:

- `HDR_WORKER_UNAVAILABLE`, `HDR_WORKER_ERROR`, `HDR_PROTOCOL_ERROR`,
  `HDR_TRANSFER_ERROR`, `HDR_DECODE_ERROR`.
- `HDR_TIMEOUT`, `HDR_ABORTED`, `HDR_DISPOSED`.
- `HDR_HTTP_ERROR`, `HDR_FETCH_ERROR`, `HDR_FETCH_UNAVAILABLE`.
- `HDR_INVALID_INPUT`, `HDR_INVALID_OPTIONS`, `HDR_INPUT_LIMIT`,
  `HDR_MEMORY_LIMIT`, `HDR_QUEUE_FULL`.

The caller's existing catch/retry/procedural-room fallback remains authoritative.
A failed/aborted worker is terminated; a subsequent request may create a new
one, still within the fixed pool. No request can wait forever while the main
event loop is running. Like browser timers generally, deadlines can be delayed
by tab suspension or an unrelated main-thread stall.

The worker validates RLE framing before official parsing so truncated payloads
reject. Supported input is Radiance `FORMAT=32-bit_rle_rgbe` with `-Y/+X`
orientation, matching the actual site files. Unsupported orientations, XYZE,
oversized/long-header files and invalid flat data explicitly reject.

## Provenance and offline verification

The exact r185 implementation is in official
[HDRLoader.parse](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/HDRLoader.js),
with [DataUtils](https://github.com/mrdoob/three.js/blob/r185/src/extras/DataUtils.js)
and MathUtils clamp. It is not imported from a nonexistent r185 `HDRParser`
module. `vendor/provenance.json` records upstream URLs, sizes and SHA-256;
`vendor/LICENSE` and the generated bundle retain the complete MIT license.

`build.mjs` verifies vendor hashes, extracts the complete unchanged `parse`
method, full DataUtils implementation, exact clamp and warning helper functions,
and selected official constants. It appends the app's framing/flip/transport
code. This intentionally small extraction has no npm/bundler dependencies and
fails if expected pinned boundaries change. The worker contains no imports.

From `portfolio-site`, with Node 24 (tested on 24.19.0):

```powershell
node tools/hdr/build.mjs         # Optional offline regeneration after edits
node tools/hdr/build.mjs --check # Verify pinned sources + exact bundle output
node tools/hdr/validate.mjs      # Actual CPU worker threads; writes validation.json
```

The test adapter executes the **actual shipped worker script** on Node
`worker_threads`, maps only Web Worker messaging and records real sender
detachment on both sides. Its oracle is the full official HDRLoader plus full
official `three.core.js`, with only the bare import path rewritten locally.
All seven real HDR files are compared byte-for-byte in both row orientations,
including exact metadata; the flip oracle copies rows independently of the
worker swap implementation. Tests cover pool overlap, exclusive 4K scheduling,
limits, actual transfer lists, ownership, failure propagation and disposal.
The vendored full three core is test-only; it is never shipped into the worker.

See `REPORT.md` and machine-readable `validation.json` for measurements and
limitations. **Visual acceptance, browser Worker/CSP/MIME compatibility, GPU
upload/PMREM stalls and FPS remain for the integrating main agent to measure.**
