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

test('compact 3D placement clears every surface while allowing the Sun to overhang', () => {
  for (let i = 0; i < BODIES.length; i++) {
    for (let j = i + 1; j < BODIES.length; j++) {
      const a = BODIES[i], b = BODIES[j];
      const da = bodyDimensions(a), db = bodyDimensions(b);
      const separation = Math.hypot(a.x - b.x, a.z - b.z, da.height - db.height);
      // Bounding spheres are conservative for the oblate planet bodies.
      assert.ok(separation > da.radius + db.radius + 0.2, `${a.name} overlaps ${b.name}`);
    }
  }
  const saturn = BODIES.find(b => b.id === 'saturn')!;
  const ringHeight = bodyDimensions(saturn).height;
  for (const body of BODIES) {
    if (body.id === 'saturn') continue;
    const d = bodyDimensions(body);
    const verticalGap = Math.abs(d.height - ringHeight);
    if (verticalGap >= d.radius) continue;
    const crossSection = Math.sqrt(d.radius ** 2 - verticalGap ** 2);
    assert.ok(Math.hypot(body.x - saturn.x, body.z - saturn.z) > 136775 / KM_PER_UNIT + crossSection + 0.2,
      `${body.name} intersects Saturn's rings`);
  }
  const sun = BODIES.find(b => b.id === 'sun')!;
  const jupiter = BODIES.find(b => b.id === 'jupiter')!;
  assert.ok(Math.hypot(jupiter.x - sun.x, jupiter.z - sun.z) < bodyDimensions(sun).radius);
});
