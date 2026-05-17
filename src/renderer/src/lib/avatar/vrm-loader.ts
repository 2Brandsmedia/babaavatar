import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';

export interface LoadedVrm {
  vrm: VRM;
  scene: THREE.Group;
}

export async function loadVrmFromArrayBuffer(buffer: ArrayBuffer): Promise<LoadedVrm> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => {
        const vrm = gltf.userData['vrm'] as VRM | undefined;
        if (!vrm) {
          reject(new Error('Datei enthält kein VRM-Modell'));
          return;
        }
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });
        resolve({ vrm, scene: vrm.scene });
      },
      (err) => reject(err),
    );
  });
}

export async function loadVrmFromUrl(url: string): Promise<LoadedVrm> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`VRM-Download fehlgeschlagen: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return loadVrmFromArrayBuffer(buffer);
}

export function disposeVrm(loaded: LoadedVrm | null): void {
  if (!loaded) return;
  loaded.vrm.scene.traverse((obj) => {
    if ('geometry' in obj && obj.geometry instanceof THREE.BufferGeometry) {
      obj.geometry.dispose();
    }
    if ('material' in obj) {
      const material = (obj as THREE.Mesh).material;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        if (mat instanceof THREE.Material) mat.dispose();
      }
    }
  });
}
