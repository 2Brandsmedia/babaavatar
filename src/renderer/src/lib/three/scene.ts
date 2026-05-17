import * as THREE from 'three';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
}

export interface CreateSceneOptions {
  canvas: HTMLCanvasElement;
  background: string;
  width: number;
  height: number;
}

export function createScene({ canvas, background, width, height }: CreateSceneOptions): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(0, 1.3, 2.6);
  camera.lookAt(0, 1.0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(1.2, 2.4, 1.6);
  scene.add(directional);

  const rim = new THREE.DirectionalLight(0xa0c8ff, 0.6);
  rim.position.set(-1.5, 1.2, -1.2);
  scene.add(rim);

  return { scene, camera, renderer, clock: new THREE.Clock() };
}

export function resizeScene(context: SceneContext, width: number, height: number): void {
  context.camera.aspect = width / height;
  context.camera.updateProjectionMatrix();
  context.renderer.setSize(width, height, false);
}

export function disposeScene(context: SceneContext): void {
  context.renderer.dispose();
  context.scene.clear();
}
