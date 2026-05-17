import * as THREE from 'three';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const REST_ARM_ANGLE = (75 * Math.PI) / 180;

export const REST_LEFT_UPPER_ARM = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, REST_ARM_ANGLE);
export const REST_RIGHT_UPPER_ARM = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -REST_ARM_ANGLE);
export const REST_LOWER_ARM = new THREE.Quaternion();
