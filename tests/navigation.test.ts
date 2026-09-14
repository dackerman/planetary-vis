import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BODIES, bodyPosition, bodyDimensions, KM_PER_UNIT } from '../lib/planets.ts';
import { movementDelta, safeMovement, clampSpeed, MIN_SPEED, MAX_SPEED } from '../lib/navigation.ts';

test('true-distance layout preserves each NASA mean solar radius and all body dimensions', () => {
  const sun = bodyPosition(BODIES.find(b => b.id === 'sun')!, 'distances');
  for (const body of BODIES) {
    const position = bodyPosition(body, 'distances');
    assert.ok(Math.abs(Math.hypot(position.x - sun.x, position.z - sun.z, (body.polar - 695700) / KM_PER_UNIT) * KM_PER_UNIT - body.orbitKm) < 0.001);
    assert.ok(bodyDimensions(body).height > 0);
  }
  assert.equal(BODIES.find(b => b.id === 'earth')!.orbitKm, 149_600_000);
  assert.equal(BODIES.find(b => b.id === 'neptune')!.orbitKm, 4_515_000_000);
});

test('WASD integrates real km/s without diagonal or frame-rate speed boosts', () => {
  const forward = new THREE.Vector3(0, -0.5, -1).normalize();
  for (const fps of [30, 60, 144]) {
    const sum = new THREE.Vector3();
    for (let i = 0; i < fps; i++) sum.add(movementDelta(new Set(['KeyW']), forward, 2000, 1 / fps));
    assert.ok(Math.abs(sum.length() * KM_PER_UNIT - 2000) < 1e-8);
    assert.equal(sum.y, 0);
  }
  assert.ok(Math.abs(movementDelta(new Set(['KeyW','KeyD']), forward, 2000, 1).length() * KM_PER_UNIT - 2000) < 1e-8);
  assert.equal(movementDelta(new Set(['KeyW','KeyS']), forward, 2000, 1).length(), 0);
  assert.equal(clampSpeed(0), MIN_SPEED);
  assert.equal(clampSpeed(Infinity), 2000);
  assert.equal(clampSpeed(1e12), MAX_SPEED);
});

test('high-speed motion cannot tunnel through a planet or below the floor', () => {
  const earth = { position: new THREE.Vector3(0, 1, 0), radius: 1, height: 1 };
  const start = new THREE.Vector3(0, 1, 1000);
  const step = safeMovement(start, new THREE.Vector3(0, 0, -2000), [earth]);
  const endpoint = start.clone().add(step);
  assert.ok(endpoint.z >= 1.08 && endpoint.z < 1.1);
  assert.equal(safeMovement(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -100, 0), []).y, -0.96);
  assert.equal(safeMovement(new THREE.Vector3(0, 1, 3), new THREE.Vector3(0, 0, 3), [earth]).z, 3);
});
