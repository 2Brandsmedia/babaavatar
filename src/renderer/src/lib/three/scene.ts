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
  // Filmisches Tone-Mapping statt rohem Clipping — hellere Hauttöne laufen weich
  // aus statt auszubrennen; der größte Einzelgewinn für „sieht echt aus".
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Drei-Punkt-Licht mit Himmel/Boden-Verlauf statt flachem Ambient:
  // Hemisphere gibt weiche Verläufe auf Haut/Stoff, Key/Rim modellieren die Form.
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x8a8a95, 0.75);
  scene.add(hemisphere);

  const directional = new THREE.DirectionalLight(0xfff4e6, 1.35);
  directional.position.set(1.2, 2.4, 1.6);
  scene.add(directional);

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
  fill.position.set(-1.8, 1.0, 2.0);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xa0c8ff, 0.7);
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
