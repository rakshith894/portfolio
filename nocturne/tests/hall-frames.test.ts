import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHallFrames } from '../lib/hall-frames.ts';
import { emptyHallProjects } from '../lib/hall-projects.ts';

void test('closed covers refresh for description and URL edits, preserve proportions, and clear cleanly', () => {
  const canvases: {
    width: number;
    height: number;
    text: string[];
    clears: number;
  }[] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement() {
        const canvas = {
          width: 0,
          height: 0,
          text: [] as string[],
          clears: 0,
          getContext: () => context,
        };
        const context = new Proxy(
          {
            clearRect() {
              canvas.text = [];
              canvas.clears++;
            },
            measureText(text: string) {
              return { width: Array.from(text).length * 32 };
            },
            fillText(text: string) {
              canvas.text.push(text);
            },
            createLinearGradient() {
              return { addColorStop() {} };
            },
          },
          {
            get(target, key) {
              return Reflect.get(target, key) ?? (() => {});
            },
          },
        );
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  const scene = new THREE.Scene();
  try {
    const frames = createHallFrames(scene);
    assert.equal(frames.roots.filter((root) => root.visible).length, 0);
    const projects = emptyHallProjects();
    projects[0] = {
      id: 'frame-3',
      title: 'Atlas',
      description: 'First edition',
      url: 'https://first.example/demo',
    };
    frames.setProjects(projects);
    assert.equal(frames.roots.filter((root) => root.visible).length, 1);
    assert.equal(frames.roots[0].userData.projectFrame, 'frame-3');
    assert.ok(canvases[0].text.includes('Atlas'));
    assert.ok(canvases[0].text.includes('First edition'));
    assert.ok(canvases[0].text.includes('first.example'));
    const clears = canvases[0].clears;
    frames.setProjects(projects);
    assert.equal(
      canvases[0].clears,
      clears,
      'unchanged projects do not redraw',
    );
    projects[0] = { ...projects[0], description: 'Second edition' };
    frames.setProjects(projects);
    assert.ok(canvases[0].text.includes('Second edition'));
    projects[0] = { ...projects[0], url: 'https://second.example/demo' };
    frames.setProjects(projects);
    assert.ok(canvases[0].text.includes('second.example'));
    frames.roots.forEach((root, index) => {
      const cover = root.getObjectByName(
        'Project exhibition cover',
      ) as THREE.Mesh<THREE.PlaneGeometry>;
      const { width, height } = cover.geometry.parameters;
      assert.ok(
        Math.abs(
          canvases[index].width / canvases[index].height - width / height,
        ) < 0.001,
      );
    });
    frames.setProjects(emptyHallProjects());
    assert.ok(!canvases[0].text.includes('Atlas'));
    assert.equal(frames.roots.filter((root) => root.visible).length, 0);
    assert.equal(
      frames.hit(new THREE.Raycaster()),
      null,
      'Hidden frames are not clickable',
    );
    frames.setProjects([
      {
        id: 'frame-11',
        title: 'Another collection',
        description: '',
        url: 'https://example.test/',
      },
    ]);
    assert.equal(
      frames.roots[0].userData.projectFrame,
      'frame-11',
      'Clicks follow the displayed collection',
    );
    assert.equal(
      frames.roots[1].userData.projectFrame,
      null,
      'Unused cases cannot open the previous collection',
    );
    frames.select('frame-11');
    frames.update(1, { mode: 'day', lights: true }, true);
    assert.ok(
      frames.roots[0].getObjectByName('Project glass hinge')!.rotation.y < -1,
    );
    frames.update(1, { mode: 'dark', lights: true }, true);
    frames.roots.forEach((root) => {
      assert.ok(
        !root.children.some((child) => child instanceof THREE.Light),
        'No protruding lamp or extra real-time light',
      );
      const halo = root.getObjectByName('Concealed frame glow') as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >;
      assert.ok(halo.material.opacity > 0.5);
    });
    frames.update(1, { mode: 'dark', lights: false }, true);
    frames.roots.forEach((root) => {
      const halo = root.getObjectByName('Concealed frame glow') as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >;
      assert.ok(
        halo.material.opacity < 0.001,
        'Frame lighting respects Lights off',
      );
    });
    frames.dispose();
    assert.equal(scene.children.length, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
