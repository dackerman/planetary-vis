import * as THREE from 'three';

// Local potential field from a bipolar pair buried beneath the photosphere.
// This is a field-line approximation, not a time-dependent MHD calculation.
export function traceCoronalField(separationKm: number, seedFraction: number, transverseKm: number) {
  const a=separationKm/2, depth=a*.32;
  const positive=new THREE.Vector3(-a,-depth,0), negative=new THREE.Vector3(a,-depth,0);
  function field(p:THREE.Vector3) {
    const u=p.clone().sub(positive), v=p.clone().sub(negative);
    return u.multiplyScalar(1/Math.pow(u.length(),3)).addScaledVector(v,-1/Math.pow(v.length(),3)).normalize();
  }
  let p=new THREE.Vector3(-a+a*seedFraction,0,transverseKm);
  const points=[p.clone()], step=separationKm/350;
  for(let i=0;i<4000;i++) {
    const midpoint=p.clone().addScaledVector(field(p),step*.5);
    const next=p.clone().addScaledVector(field(midpoint),step);
    if(next.y<0) {
      points.push(p.clone().lerp(next,p.y/(p.y-next.y))); return points;
    }
    if(next.length()>separationKm*8) break;
    points.push(next); p=next;
  }
  return []; // Never display an open field line as a closed coronal loop.
}
