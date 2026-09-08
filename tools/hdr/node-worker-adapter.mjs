// Test-only Worker surface backed by actual Node worker_threads (no browser/server).
import { Worker as NodeWorker } from 'node:worker_threads';

export const transfers = [];
export const threads = new Set();
export class NodeBrowserWorker {
  static mode = 'normal';
  constructor(url, options) {
    if (NodeBrowserWorker.mode === 'constructor-error') throw new Error('Injected Worker constructor failure');
    this.onmessage = this.onerror = this.onmessageerror = null;
    this.mode = NodeBrowserWorker.mode;
    this.node = new NodeWorker(new URL('./node-worker-host.mjs', import.meta.url), {
      workerData: { url: String(url), mode: this.mode }, name: options.name,
    });
    threads.add(this.node.threadId);
    this.threadId = this.node.threadId;
    this.node.on('message', data => {
      if (data.testTransfer) {
        transfers.push({ direction: 'worker-to-main', ...data.testTransfer });
        return;
      }
      if (this.mode === 'message-error' && data.kind === 'ready') {
        this.onmessageerror?.({ message: 'Injected message deserialization failure' });
        return;
      }
      this.onmessage?.({ data });
    });
    this.node.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
  }
  postMessage(message, list) {
    const before = list[0]?.byteLength ?? 0;
    this.node.postMessage(message, list);
    transfers.push({ direction: 'main-to-worker', id: message.id, bytes: before, detachedBytes: list[0]?.byteLength, threadId: this.threadId });
  }
  terminate() { void this.node.terminate(); }
}
