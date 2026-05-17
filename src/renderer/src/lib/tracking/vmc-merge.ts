import * as THREE from 'three';
import type { PoseFrame, VmcSnapshot } from '@shared/types';

const REUSE_QUAT = new THREE.Quaternion();
const REUSE_EULER = new THREE.Euler();

function lowerFirst(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function normalizeBlendShapes(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    out[lowerFirst(key)] = value;
  }
  return out;
}

export interface VmcMergeOptions {
  applyFace: boolean;
  applyHead: boolean;
}

export function mergeVmcIntoPose(
  pose: PoseFrame,
  vmc: VmcSnapshot,
  options: VmcMergeOptions,
): PoseFrame {
  let next = pose;

  if (options.applyFace && Object.keys(vmc.blendShapes).length > 0) {
    const vmcBlend = normalizeBlendShapes(vmc.blendShapes);
    next = {
      ...next,
      blendShapes: { ...(pose.blendShapes ?? {}), ...vmcBlend },
    };
  }

  if (options.applyHead && vmc.headQuat && next.face) {
    REUSE_QUAT.set(vmc.headQuat.x, vmc.headQuat.y, vmc.headQuat.z, vmc.headQuat.w);
    REUSE_EULER.setFromQuaternion(REUSE_QUAT, 'YXZ');
    next = {
      ...next,
      face: {
        ...next.face,
        head: { x: REUSE_EULER.x, y: REUSE_EULER.y, z: REUSE_EULER.z },
      },
    };
  }

  return next;
}
