// App-owned transport and validation. Appended to the pinned official parser.
// No imports, DOM, DataTexture, GPU work, or LoadingManager in this worker.
const PROTOCOL = 'portfolio-hdr-r185-v1';

// Official r185 accepts some truncated RLE payloads with unfilled pixels.
// Validate framing first so network corruption is reported instead of rendered.
function validatePayload(buffer, info) {
  const bytes = new Uint8Array(buffer);
  let pos = info.headerBytes;
  const { width, height } = info;
  const fail = () => { throw new Error('Truncated or invalid RGBE pixel payload'); };
  if (width < 8 || width > 0x7fff || bytes[pos] !== 2 || bytes[pos + 1] !== 2 || (bytes[pos + 2] & 128)) {
    if (bytes.length - pos !== width * height * 4) fail();
    return;
  }
  for (let y = 0; y < height; y++) {
    if (pos + 4 > bytes.length || bytes[pos] !== 2 || bytes[pos + 1] !== 2 || ((bytes[pos + 2] << 8) | bytes[pos + 3]) !== width) fail();
    pos += 4;
    let written = 0;
    while (written < width * 4) {
      if (pos >= bytes.length) fail();
      const tag = bytes[pos++];
      const count = tag > 128 ? tag - 128 : tag;
      const consumed = tag > 128 ? 1 : count;
      if (!count || written + count > width * 4 || pos + consumed > bytes.length) fail();
      pos += consumed;
      written += count;
    }
  }
}

function flipPixelRows(data, width, height) {
  // Same in-place row swap as experience.js prepLM/flipRows; one row scratch.
  const stride = width * 4;
  const tmp = new data.constructor(stride);
  for (let y = 0; y < height >> 1; y++) {
    const a = y * stride, b = (height - 1 - y) * stride;
    tmp.set(data.subarray(a, a + stride));
    data.copyWithin(a, b, b + stride);
    data.set(tmp, b);
  }
}

self.onmessage = ({ data: message }) => {
  const { id, buffer, flipRows, limits } = message || {};
  try {
    if (message.protocol !== PROTOCOL || message.kind !== 'decode' || !(buffer instanceof ArrayBuffer)) throw new Error('Invalid HDR worker request');
    const start = performance.now();
    const info = inspectHeader(buffer, limits.maxPixels, limits.maxInputBytes);
    validatePayload(buffer, info);
    const validated = performance.now();
    const result = parser.parse(buffer);
    const parsed = performance.now();
    if (!(result.data instanceof Uint16Array) || result.data.length !== info.width * info.height * 4) throw new Error('HDR parser returned an invalid half-float image');
    if (flipRows) flipPixelRows(result.data, result.width, result.height);
    const end = performance.now();
    result.format = RGBAFormat;
    result.rowsFlipped = !!flipRows;
    result.timings = {
      thread: 'worker', validationMs: validated - start, parseMs: parsed - validated,
      flipMs: end - parsed, workerMs: end - start,
      inputTransferBytes: buffer.byteLength, outputTransferBytes: result.data.byteLength,
    };
    self.postMessage({ protocol: PROTOCOL, kind: 'result', id, result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ protocol: PROTOCOL, kind: 'error', id, error: { code: 'HDR_DECODE_ERROR', message: error?.message || String(error) } });
  }
};
self.postMessage({ protocol: PROTOCOL, kind: 'ready' });
