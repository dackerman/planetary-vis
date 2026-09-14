import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, bodyDimensions, KM_PER_UNIT } from '../lib/planets.ts';

test('one linear kilometer scale preserves Earth, Jupiter, and Sun dimensions', () => {
  assert.equal(BODIES.length, 9);
  assert.equal(new Set(BODIES.map(b => b.id)).size, 9);
  const earth = bodyDimensions(BODIES.find(b => b.id === 'earth')!);
  const jupiter = bodyDimensions(BODIES.find(b => b.id === 'jupiter')!);
  const sun = bodyDimensions(BODIES.find(b => b.id === 'sun')!);
  assert.equal(earth.radius, 1);
  assert.ok(Math.abs(jupiter.radius - 11.209) < 0.001);
  assert.ok(Math.abs(sun.radius - 109.076) < 0.001);
  for (const body of BODIES) {
    const size = bodyDimensions(body);
    assert.ok(Math.abs(size.radius * KM_PER_UNIT - body.equatorial) < 0.000001);
    assert.ok(Math.abs(size.height * KM_PER_UNIT - body.polar) < 0.000001);
    assert.ok(size.height <= size.radius);
  }
});

test('exhibition placement keeps all bodies and the main Saturn rings separate', () => {
  for (let i = 0; i < BODIES.length; i++) {
    for (let j = i + 1; j < BODIES.length; j++) {
      const a = BODIES[i], b = BODIES[j];
      const ra = a.id === 'saturn' ? 136775 / KM_PER_UNIT : bodyDimensions(a).radius;
      const rb = b.id === 'saturn' ? 136775 / KM_PER_UNIT : bodyDimensions(b).radius;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > ra + rb, `${a.name} overlaps ${b.name}`);
    }
  }
});
