import * as THREE from 'three';

/** Seamless, ridged bark with fine fissures and irregular lichen flecks. */
export function createTreeBark(resources: Set<{ dispose(): void }>) {
  const width = 128,
    height = 256,
    bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = (x / width) * Math.PI * 2,
        v = (y / height) * Math.PI * 2;
      const ridge = Math.pow(
        Math.abs(Math.sin(u * 17 + Math.sin(v * 3 + u * 2) * 0.55)),
        0.35,
      );
      const fissure = Math.pow(
        Math.abs(Math.sin(u * 43 + Math.sin(v * 5) * 0.7)),
        0.2,
      );
      const grain = Math.sin(u * 51 + v * 37) * Math.cos(u * 13 - v * 23);
      const patch = Math.max(
        0,
        Math.sin(u * 5 + v * 3) * Math.cos(v * 7 - u * 3) - 0.48,
      );
      const shade = 0.33 + ridge * fissure * 0.57 + grain * 0.1;
      const i = (y * width + x) * 4;
      bytes[i] = 112 * shade + patch * 45;
      bytes[i + 1] = 101 * shade + patch * 66;
      bytes[i + 2] = 85 * shade + patch * 44;
      bytes[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    color: '#b6ada0',
    map: texture,
    bumpMap: texture,
    bumpScale: 0.1,
    roughness: 0.96,
  });
  resources.add(texture);
  resources.add(material);
  return material;
}
