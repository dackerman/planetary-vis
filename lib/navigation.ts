import * as THREE from 'three';
import { KM_PER_UNIT } from './planets.ts';

export const MIN_SPEED = 0.001; // km/s (1 m/s)
export const MAX_SPEED = 100_000_000_000;
export const DEFAULT_SPEED = 2_000;
export type NavigationMode = 'look' | 'orbit';
export interface Telemetry { gridKm: number; movingKms: number; traveledKm: number; referenceKm: number; blackHoleKm?: number; shader?: { width: number; height: number; fps: number }; }
export function clampSpeed(kms: number) {
  return Number.isFinite(kms) ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, kms)) : DEFAULT_SPEED;
}
export function formatDistance(km: number) {
  if (km < 1) return `${(km * 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} m`;
  if (km >= 1e9) return `${(km / 1e9).toFixed(3)} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(3)} million km`;
  return `${km.toLocaleString('en-US', { maximumFractionDigits: km < 10 ? 2 : 0 })} km`;
}
export function formatSpeed(kms: number) {
  return `${formatDistance(kms)}/s`;
}

// W/S follow the viewing direction projected onto the floor; diagonal input
// is normalized so W+D is not faster than W. Q/E change altitude.
export function movementDelta(keys: ReadonlySet<string>, forward: THREE.Vector3, speed: number, dt: number) {
  const horizontal = forward.clone().setY(0);
  if (horizontal.lengthSq() < 1e-8) horizontal.set(0, 0, -1);
  horizontal.normalize();
  const right = new THREE.Vector3().crossVectors(horizontal, new THREE.Vector3(0, 1, 0));
  const delta = horizontal.multiplyScalar(Number(keys.has('KeyW')) - Number(keys.has('KeyS')))
    .addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA')));
  delta.y += Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
  return delta.normalize().multiplyScalar(clampSpeed(speed) * dt / KM_PER_UNIT);
}

export interface CollisionBody { position: THREE.Vector3; radius: number; height: number; }
// Swept ellipsoid collision prevents high interplanetary speeds from tunneling
// through a planet between frames. Navigation jumps are handled separately.
export function safeMovement(start: THREE.Vector3, delta: THREE.Vector3, bodies: CollisionBody[], minimumHeight = 0.04) {
  let fraction = 1;
  for (const body of bodies) {
    const scale = new THREE.Vector3(body.radius, body.height, body.radius).multiplyScalar(1.08);
    const localStart = start.clone().sub(body.position).divide(scale);
    const localDelta = delta.clone().divide(scale);
    const a = localDelta.lengthSq(), b = 2 * localStart.dot(localDelta), c = localStart.lengthSq() - 1;
    if (a < 1e-20 || b >= 0) continue;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t >= 0 && t <= fraction) fraction = Math.max(0, t - 1e-6);
  }
  const result = delta.clone().multiplyScalar(fraction);
  result.y = Math.max(result.y, minimumHeight - start.y);
  return result;
}

// Closest Euclidean distance to an axis-aligned oblate planet surface.
export function surfaceDistanceKm(camera: THREE.Vector3, center: THREE.Vector3, radius: number, height: number) {
  const x = camera.x - center.x, y = camera.y - center.y, z = camera.z - center.z;
  const rr = radius * radius, hh = height * height;
  if ((x*x + z*z) / rr + y*y / hh <= 1) return 0;
  let low = 0, high = Math.max(radius, height) * Math.hypot(x, y, z);
  for (let i = 0; i < 40; i++) {
    const t = (low + high) / 2;
    const equation = rr * (x*x + z*z) / ((t+rr)*(t+rr)) + hh*y*y / ((t+hh)*(t+hh));
    if (equation > 1) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return Math.hypot(x*t/(t+rr), y*t/(t+hh), z*t/(t+rr)) * KM_PER_UNIT;
}
