import { parentPort, workerData, threadId, isMainThread } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

if (workerData.mode === 'script-error') throw new Error('Injected worker script error');
if (workerData.mode !== 'silent-start') {
  globalThis.self = {
    onmessage: null,
    postMessage(message, list = []) {
      const bytes = list[0]?.byteLength ?? 0;
      if (workerData.mode === 'wrong-protocol' && message.kind === 'ready') message.protocol = 'wrong';
      parentPort.postMessage(message, list);
      if (bytes) parentPort.postMessage({ testTransfer: { id: message.id, bytes, detachedBytes: list[0].byteLength, threadId, isMainThread } });
    },
  };
  parentPort.on('message', message => {
    if (workerData.mode === 'silent-decode') return;
    if (workerData.mode === 'delay-decode') setTimeout(() => self.onmessage({ data: message }), 180);
    else self.onmessage({ data: message });
  });
  const workerURL = new URL(workerData.url);
  workerURL.search = '';
  vm.runInThisContext(await readFile(workerURL, 'utf8'), { filename: workerURL.pathname });
} else parentPort.on('message', () => {});
