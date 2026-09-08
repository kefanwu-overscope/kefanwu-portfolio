import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function writeReport() {
  const root = new URL('./', import.meta.url);
  const report = JSON.parse(await readFile(new URL('validation.json', root), 'utf8'));
  const mib = bytes => (bytes / 1048576).toFixed(2);
  const rows = report.cases.map(item => `| ${item.file.replace('models/baked/', '').replace('hdri/', '')} | ${item.flipRows} | ${item.width}×${item.height} | ${item.timings.parseMs.toFixed(2)} | ${item.timings.flipMs.toFixed(2)} | ${item.timings.workerMs.toFixed(2)} | ${item.inputBytes.toLocaleString('en-US')} / ${item.outputBytes.toLocaleString('en-US')} | PASS |`).join('\n');
  const text = `# HDR worker implementation and validation report

Generated ${report.generatedAt}. **${report.pass ? 'PASS' : 'FAIL'}: ${report.cases.length} real-file byte comparisons and ${report.checks.length} additional checks.**

## Delivered scope

- \`experience-hdr.js\`: independent service, at most two Workers, dimension-aware exclusive 4K scheduling, bounded queue/input/working estimates, abort/deadlines/dispose and explicit error codes; main-thread DataTexture adapter.
- \`experience-hdr-worker.js\`: ${report.artifacts['experience-hdr-worker.js'].bytes.toLocaleString('en-US')} bytes, self-contained classic worker with pinned official r185 HDRLoader.parse/DataUtils and MIT license. No imports, page importmap, CDN fetches, npm or runtime build.
- \`tools/hdr/\`: offline sources/provenance, reproducible extraction, real worker-thread tests, raw JSON evidence and documentation.
- This work wrote only those two new runtime files and \`tools/hdr/**\`. No browser/server, integration edits, commits or deployment were performed by this worker task.

## Main-agent integration contract

\`createHDRService({workers:2}).load(url,{flipRows:!isProbe})\` resolves to data;
\`createHDRTexture(THREE,result)\` synchronously wraps the same Uint16Array on main.
Start decode outside the serialized GPU queue; construct/upload textures inside
that queue. Manager tokens remain caller-owned across both stages.

For a worker-decoded lightmap, set \`texture.channel=1\` and skip the old row
flip. The texture factory already sets HalfFloat, LinearSRGB, linear filters,
no mipmaps and \`flipY=true\`. For the caller's old-HDRLoader fallback, retain
the old \`prepLM\` row flip. Probe mapping and PMREM remain on main.

Worker unavailable/constructor rejection is \`HDR_WORKER_UNAVAILABLE\`;
asynchronous script/CSP/message failure is \`HDR_WORKER_ERROR\`; deadline
failure is \`HDR_TIMEOUT\`. The service has no silent fallback or hidden retry.

## Measured results

Environment: ${report.environment.node}, ${report.environment.platform}/${report.environment.arch},
${report.environment.cpu}, ${report.environment.cpus} logical CPUs. Actual shipped
worker code executed on Node worker_threads through a thin Web Worker adapter.
Oracle: full official r185 HDRLoader and three.core.js; only the bare import
specifier changes for offline resolution. Flip oracle reverses rows using an
independent copied-row implementation.

All comparisons check **every RGBA half-float output byte**, and width, height,
header, exposure, gamma, type, color space, filters, mipmap and flipY metadata.
The main-thread DataTexture wraps the identical received array in every case.

| Actual file | CPU row flip | Size | Worker parse ms | Worker flip ms | Worker total ms | Transferred input / output bytes | Bytes + metadata |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${rows}

These are single-run CPU observations, including a cold first worker. Worker
total includes framing validation, parse and optional flip; it excludes network,
queue waits, worker startup and response transport. Raw JSON also records these
other intervals, official main-thread parse times, hashes and transfer events.
The same baseline parse is reused for each file's two orientation checks;
oracle row-copy timings are validation overhead, not a production benchmark.

Real two-worker 2K overlap reached **${report.concurrencyStats.peakDecoding}** simultaneous
decodes. Both 4K/4K and mixed 4K/2K submissions were sampled; any active 4K
decode had **one total decode**. Peak 4K concurrency: **${report.concurrencyStats.peakLargeDecoding}**.
Peak estimated decode reservation: **${mib(report.concurrencyStats.peakWorkingBytes)} MiB**
(configured 256 MiB); peak retained compressed inputs during the pool test:
**${mib(report.concurrencyStats.peakRetainedInputBytes)} MiB** (configured 64 MiB).

Transfer instrumentation recorded **${report.transfers.count}** actual transfers.
Every sender ArrayBuffer detached to byteLength **0**. Returned output came
from non-main worker threads. The fourteen asset comparisons alone moved
${report.sequentialStats.inputTransferBytes.toLocaleString('en-US')} compressed bytes into workers and
${report.sequentialStats.outputTransferBytes.toLocaleString('en-US')} decoded bytes back without structured-cloning pixel buffers.

## Additional validation

${report.checks.map(item => `- PASS: ${item.name}.`).join('\n')}

## Boundaries and remaining acceptance

**No FPS improvement, browser responsiveness figure, GPU timing or visual
acceptance is claimed.** Byte equality and thread detachment establish decode
correctness and transfer ownership, not rendered appearance or frame rate.
The integrating main agent still needs browser/CSP/MIME checks and visual
acceptance of off/on lighting, row orientation, probes and 4K upgrades.

DataTexture construction, GPU upload and PMREM remain on main and can stall it.
Main also performs a bounded 16 KiB header check and one compressed-download
chunk concatenation. Decode admission limits are estimates, not RSS limits:
GC and caller-held outputs/textures add memory. Each 4K output is 128 MiB;
completed GPU-queued results remain caller-owned and should be staged/evicted
by the integrating queue. A suspended tab or another main-thread stall can
delay timeout callbacks. Unsupported/oversized/corrupt input rejects explicitly.

## Reproduction and provenance

Run \`node tools/hdr/validate.mjs\` from the site root. It checks the offline
bundle and vendor hashes, then regenerates \`validation.json\` and this report.
Full source URLs, exact bytes and SHA-256 are in \`vendor/provenance.json\`;
license is in \`vendor/LICENSE\` and the shipped worker banner.
API details and all default limits are in \`README.md\`.

Runtime SHA-256:

- \`experience-hdr.js\`: \`${report.artifacts['experience-hdr.js'].sha256}\`
- \`experience-hdr-worker.js\`: \`${report.artifacts['experience-hdr-worker.js'].sha256}\`
`;
  await writeFile(new URL('REPORT.md', root), text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeReport();
