import test from 'node:test';
import assert from 'node:assert/strict';
import { Cache, FileLoader, ImageLoader } from 'three';
import { preloadIslandAssets } from '../lib/island-preload.ts';

void test('entry preloading shares in-flight work, tolerates failure and retries', async (context) => {
  const enabled = Cache.enabled,
    requests: string[] = [];
  let fail = true;
  context.mock.method(
    FileLoader.prototype,
    'loadAsync',
    async (url: string) => {
      requests.push(url);
      if (fail) throw new Error('Transient offline request');
      return new ArrayBuffer(0);
    },
  );
  context.mock.method(
    ImageLoader.prototype,
    'loadAsync',
    async (url: string) => {
      requests.push(url);
      return {};
    },
  );
  try {
    const first = preloadIslandAssets();
    assert.equal(
      preloadIslandAssets(),
      first,
      'Repeated hover/focus must share work',
    );
    await first;
    assert.equal(requests.filter((url) => url.endsWith('.glb')).length, 1);
    assert.ok(Cache.enabled, 'The scene loaders must reuse prepared assets');
    fail = false;
    const retry = preloadIslandAssets();
    assert.notEqual(retry, first);
    await retry;
    const count = requests.length;
    await preloadIslandAssets();
    assert.equal(
      requests.length,
      count,
      'Successful preparation must not download again',
    );
    assert.ok(requests.includes('/environment/reference-sky.webp'));
  } finally {
    Cache.enabled = enabled;
  }
});
