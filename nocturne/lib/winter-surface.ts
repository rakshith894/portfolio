import * as THREE from 'three';

/** Shared uniform changes coverage without recompiling the island materials. */
export function addWinterSurface(
  material: THREE.MeshStandardMaterial,
  winter: { value: number },
) {
  const previous = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.winterCover = winter;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 frostPosition;varying vec3 frostNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nfrostPosition=(modelMatrix*vec4(position,1.)).xyz;frostNormal=normalize(mat3(modelMatrix)*normal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float winterCover;varying vec3 frostPosition;varying vec3 frostNormal;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float snowGrain=sin(frostPosition.x*3.7+sin(frostPosition.z*2.1))*sin(frostPosition.z*4.3)*.07;
float snowCover=winterCover*smoothstep(.38,.83,normalize(frostNormal).y+snowGrain);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.89,.94)+snowGrain*.12,snowCover*.94);`,
      );
  };
  material.customProgramCacheKey = () => `${key}-winter-cover-1`;
}
