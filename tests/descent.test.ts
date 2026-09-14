import test from 'node:test';
import assert from 'node:assert/strict';
import { descentFrame, DESCENT_SECONDS } from '../lib/descent.ts';
test('cinematic descent approaches but never crosses the static shader horizon',()=>{
 let previous=Infinity;
 for(let t=0;t<=DESCENT_SECONDS;t+=.1){const f=descentFrame(t);assert.ok(f.radiusRatio>1);assert.ok(f.radiusRatio<=previous);previous=f.radiusRatio;}
 assert.equal(descentFrame(0).fade,0);
 assert.equal(descentFrame(DESCENT_SECONDS).fade,1);
 assert.equal(descentFrame(100).progress,1);
});
