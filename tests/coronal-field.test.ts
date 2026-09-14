import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceCoronalField } from '../lib/coronal-field.ts';

test('all displayed magnetic strands close at the photosphere and remain above it', () => {
  for(let region=0;region<8;region++) for(let strand=0;strand<66;strand++) {
    const separation=24000+(region%4)*18000;
    const family=Math.floor(strand/3);
    const points=traceCoronalField(separation,.05+(family%11)*.054+Math.sin(strand*3.71)*.002,(Math.floor(family/11)-.5)*separation*.08+Math.sin(strand*2.3)*separation*.009);
    assert(points.length>3);
    assert.equal(points[0].y,0);
    assert(Math.abs(points.at(-1)!.y)<1e-7);
    assert(points[0].x<0 && points.at(-1)!.x>0);
    assert(points.every(p=>Number.isFinite(p.length()) && p.y>=-1e-7));
    const apex=Math.max(...points.map(p=>p.y));
    assert(apex>900 && apex<44000);
  }
});

test('potential-field geometry scales linearly with physical separation', () => {
  const a=traceCoronalField(24000,.2,1000), b=traceCoronalField(48000,.2,2000);
  assert.equal(a.length,b.length);
  a.forEach((p,i)=>assert(p.clone().multiplyScalar(2).distanceTo(b[i])<1e-6));
});
