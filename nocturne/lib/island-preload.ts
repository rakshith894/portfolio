import { Cache, FileLoader, ImageLoader } from 'three';

let pending: Promise<void> | undefined;

/** Warm the same loader cache used by the island, without creating a WebGL scene. */
export function preloadIslandAssets() {
  if (pending) return pending;
  Cache.enabled = true;
  const images = new ImageLoader();
  const files = new FileLoader().setResponseType('arraybuffer');
  const urls = ['stone', 'rock', 'ground', 'path'].flatMap((surface) =>
    ['color', 'normal', 'roughness'].map(
      (map) => `/materials/${surface}-${map}.webp`,
    ),
  );
  pending = Promise.allSettled([
    files.loadAsync('/models/human-traveller.glb'),
    ...urls.map((url) => images.loadAsync(url)),
    images.loadAsync('/environment/reference-sky.webp'),
  ]).then((results) => {
    // A failed speculative request must neither block entry nor prevent retry.
    if (results.some((result) => result.status === 'rejected'))
      pending = undefined;
  });
  return pending;
}
