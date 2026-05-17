import * as THREE from 'three';
import { loadVrmFromArrayBuffer, disposeVrm } from './vrm-loader';

export async function renderVrmThumbnail(buffer: ArrayBuffer, size = 256): Promise<string> {
  const loaded = await loadVrmFromArrayBuffer(buffer);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c1c22');
  scene.add(loaded.scene);
  loaded.scene.rotation.set(0, Math.PI, 0);

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
  camera.position.set(0, 1.45, 1.2);
  camera.lookAt(0, 1.4, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 1.3);
  directional.position.set(1, 2, 1);
  scene.add(directional);

  loaded.vrm.update(0);
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL('image/png');

  scene.remove(loaded.scene);
  disposeVrm(loaded);
  renderer.dispose();

  return dataUrl;
}
