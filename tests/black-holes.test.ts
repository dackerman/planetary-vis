import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK_HOLES, blackHoleRadius, blackHolePosition, SOLAR_HORIZON_RADIUS_KM, DISK_OUTER_RADIUS } from '../lib/black-holes.ts';
import { BODIES, KM_PER_UNIT, bodyDimensions } from '../lib/planets.ts';
import { safeMovement } from '../lib/navigation.ts';
import * as THREE from 'three';

test('horizons use physical Schwarzschild radii on the planetary kilometer scale', () => {
  assert.ok(Math.abs(SOLAR_HORIZON_RADIUS_KM - 2.95325)<.0001);
  for (const [i,h] of BLACK_HOLES.entries()) {
    const r=blackHoleRadius(h.mass);
    assert.ok(Math.abs(r*KM_PER_UNIT/(h.mass*SOLAR_HORIZON_RADIUS_KM)-1)<1e-14);
    assert.equal(blackHolePosition(h.mass).y,r);
    if(i) assert.ok(r>blackHoleRadius(BLACK_HOLES[i-1].mass));
  }
  assert.ok(blackHoleRadius(66e9)*2*KM_PER_UNIT>389e9);
});

test('every exhibition placement clears the Sun and planets, including disk extent', () => {
  for(const h of BLACK_HOLES){
    const p=blackHolePosition(h.mass),r=blackHoleRadius(h.mass);
    for(const b of BODIES){
      const {radius,height}=bodyDimensions(b);
      const d=Math.hypot(p.x-b.x,p.y-height,p.z-b.z);
      assert.ok(d>r+radius,`${h.id} horizon overlaps ${b.id}`);
      if(Math.abs(p.y-height)<radius){
        assert.ok(Math.hypot(p.x-b.x,p.z-b.z)>DISK_OUTER_RADIUS*r+radius,`${h.id} disk overlaps ${b.id}`);
      }
    }
  }
});

test('navigation permits city-sized horizon inspection without tunneling through it',()=>{
  const r=blackHoleRadius(3.8),center=new THREE.Vector3(0,r,0);
  const start=new THREE.Vector3(0,r,4*r),delta=new THREE.Vector3(0,0,-10*r);
  const result=safeMovement(start,delta,[{position:center,radius:r,height:r}],r*.01);
  assert.ok(start.clone().add(result).distanceTo(center)>=r*1.08);
  assert.equal(result.y,0);
});
