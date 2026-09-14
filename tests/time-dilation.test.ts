import test from 'node:test';
import assert from 'node:assert/strict';
import { gravitationalClockRate, clockDuration } from '../lib/time-dilation.ts';
test('stationary clock rates match Schwarzschild limits and known radii',()=>{
 assert.equal(gravitationalClockRate(1),null);
 assert.equal(gravitationalClockRate(.5),null);
 assert.equal(gravitationalClockRate(Infinity),1);
 assert.ok(Math.abs(gravitationalClockRate(4/3)!-.5)<1e-14);
 assert.ok(Math.abs(gravitationalClockRate(2)!-Math.SQRT1_2)<1e-14);
 assert.equal(clockDuration(3600/gravitationalClockRate(4/3)!),'2 h');
 assert.equal(clockDuration(3661),'1 h 1 min 1 s');
});
