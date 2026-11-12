/** Small Cache API writes avoid reserving space for an entire streamed ONNX response. */
export const WHISPER_BLOCK_CACHE = 'wm-whisper-blocks-v1';
const BLOCK_BYTES = 4 * 1024 * 1024;
type Manifest = { version: 1; blocks: string[]; bytes: number; headers: [string, string][] };
const keyOf = (key: string) => new URL(key, globalThis.location?.href ?? 'https://huggingface.co/').href;
const storageSnapshot = async () => {
  try {
    return { estimate: await navigator.storage?.estimate(), persisted: await navigator.storage?.persisted() };
  } catch (error) { return { diagnosticError: String(error) }; }
};

export const whisperResourceCache = {
  async match(key: string): Promise<Response | undefined> {
    const url = keyOf(key);
    const legacy = await caches.open('transformers-cache');
    const existing = await legacy.match(url);
    if (existing) return existing;
    const cache = await caches.open(WHISPER_BLOCK_CACHE);
    const entry = await cache.match(url);
    if (!entry) return undefined;
    const manifest = await entry.json() as Manifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.blocks)) return undefined;
    // A manifest is committed only after all blocks; check for browser eviction too.
    for (const block of manifest.blocks) if (!await cache.match(block)) return undefined;
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (index === manifest.blocks.length) { controller.close(); return; }
        try {
          const block = await cache.match(manifest.blocks[index++]!);
          if (!block) throw new Error('Um bloco do modelo foi removido pelo navegador.');
          controller.enqueue(new Uint8Array(await block.arrayBuffer()));
        } catch (error) { controller.error(error); }
      },
    });
    const headers = new Headers(manifest.headers);
    headers.set('content-length', String(manifest.bytes));
    return new Response(body, { headers });
  },
  async put(key: string, response: Response): Promise<void> {
    const url = keyOf(key);
    const cache = await caches.open(WHISPER_BLOCK_CACHE);
    const blocks: string[] = [];
    const reader = response.body?.getReader();
    if (!reader) throw new Error('O arquivo do modelo não contém dados.');
    const generation = crypto.randomUUID();
    const storageBefore = await storageSnapshot();
    let stage = 'read';
    let buffer = new Uint8Array(BLOCK_BYTES); let used = 0; let bytes = 0;
    const flush = async () => {
      if (!used) return;
      const block = new URL(url); block.searchParams.set('__wm_block', `${generation}-${blocks.length}`);
      const blockKey = block.href;
      stage = 'cache.put block';
      await cache.put(blockKey, new Response(buffer.slice(0, used)));
      stage = 'read';
      blocks.push(blockKey); bytes += used; used = 0;
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        let offset = 0;
        while (offset < value.length) {
          const count = Math.min(BLOCK_BYTES - used, value.length - offset);
          buffer.set(value.subarray(offset, offset + count), used); used += count; offset += count;
          if (used === BLOCK_BYTES) await flush();
        }
      }
      await flush();
      const expected = Number(response.headers.get('content-length'));
      if (expected && !response.headers.has('content-encoding') && expected !== bytes) throw new Error('Download incompleto do modelo.');
      const manifest: Manifest = { version: 1, blocks, bytes, headers: [...response.headers.entries()] };
      stage = 'cache.put manifest';
      await cache.put(url, new Response(JSON.stringify(manifest)));
    } catch (error) {
      const storageAtFailure = await storageSnapshot();
      await Promise.all(blocks.map(block => cache.delete(block).catch(() => false)));
      const failure = error as { name?: string; message?: string; stack?: string } | null;
      const diagnostic = {
        url, stage, completedBlocks: blocks.length, committedBytes: bytes, pendingBytes: used,
        receivedBytes: bytes + used, storageBefore, storageAtFailure,
        error: { name: failure?.name ?? 'Error', message: failure?.message ?? String(error), stack: failure?.stack },
      };
      // Console text copies omit collapsed properties; emit a complete, copyable report.
      console.error('Falha ao guardar modelo em blocos\n' + JSON.stringify(diagnostic, null, 2));
      throw error;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  },
};
