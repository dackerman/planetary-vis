import * as THREE from 'three';

// All dimensions are fractions of the Sun's 695,700 km radius.
export function createSolarEffects(globe: THREE.Mesh, material: THREE.MeshBasicMaterial) {
  const clock = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.solarTime = clock;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 solarPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nsolarPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float solarTime; varying vec3 solarPosition;
      float solarHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float solarNoise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(solarHash(i),solarHash(i+vec3(1,0,0)),f.x),mix(solarHash(i+vec3(0,1,0)),solarHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(solarHash(i+vec3(0,0,1)),solarHash(i+vec3(1,0,1)),f.x),mix(solarHash(i+vec3(0,1,1)),solarHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `).replace('#include <map_fragment>', `#include <map_fragment>
      vec3 sp=normalize(solarPosition);
      float resolved=1.-smoothstep(.0004,.0025,length(fwidth(sp)));
      float convection=solarNoise(sp*420.+vec3(0.,solarTime*.035,0.));
      float cells=solarNoise(sp*1400.+vec3(solarTime*.045,0.,0.));
      float fine=solarNoise(sp*2800.+vec3(0.,0.,solarTime*.06));
      float detail=mix(1., .62+.55*cells+.22*fine, resolved);
      diffuseColor.rgb *= detail * (.92+.16*convection);
      diffuseColor.rgb += vec3(.13,.035,.003)*pow(cells,4.)*resolved;
    `);
  };
  material.customProgramCacheKey = () => 'solar-granulation-v1';
  const loops: { material: THREE.ShaderMaterial; phase: number; duration: number }[] = [];
  for (let i=0; i<20; i++) {
    const azimuth=i*2.39996323;
    // Keep active regions above the nearby display planets and shared floor.
    const normal=new THREE.Vector3(Math.cos(azimuth), -.05+(i%5)*.19, Math.sin(azimuth)).normalize();
    const tangent=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,1,0)).normalize();
    const across=new THREE.Vector3().crossVectors(normal,tangent).normalize();
    const tilt=i*.73;
    tangent.multiplyScalar(Math.cos(tilt)).addScaledVector(across,Math.sin(tilt)).normalize();
    const loopHeight=(18000+(i%6)*8500)/695700;
    const halfWidth=(14000+(i%4)*6500)/695700;
    for(let strand=0;strand<2;strand++) {
      const points=[];
      for(let j=0;j<=64;j++) {
        const t=j/64;
        const direction=normal.clone().addScaledVector(tangent,Math.cos(Math.PI*t)*halfWidth).normalize();
        points.push(direction.multiplyScalar(1.00015+Math.sin(Math.PI*t)*loopHeight*(1-strand*.1)).addScaledVector(across,Math.sin(Math.PI*t)*strand*.0015));
      }
      const curve=new THREE.CatmullRomCurve3(points);
      const geometry=new THREE.TubeGeometry(curve,64,(strand ? 260 : 480)/695700,5,false);
      const plasma=new THREE.ShaderMaterial({
        uniforms:{time:clock,life:{value:1},growth:{value:1},seed:{value:i*.91+strand}},
        vertexShader:`#include <common>
          #include <logdepthbuf_pars_vertex>
          uniform float growth; varying vec2 loopUv;
          void main(){loopUv=uv; float r=length(position); vec3 p=normalize(position)*(1.+(r-1.)*growth); vec4 mvPosition=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mvPosition;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader:`#include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float time;uniform float life;uniform float seed; varying vec2 loopUv;
          void main(){
          #include <logdepthbuf_fragment>
          float flow=.55+.45*pow(.5+.5*sin(loopUv.x*65.-time*3.+seed),3.);
          float edge=pow(max(0.,sin(loopUv.y*3.14159)),.55);
          vec3 color=mix(vec3(1.,.12,.008),vec3(1.,.72,.22),flow);
          gl_FragColor=vec4(color*1.8,life*edge*(.5+.5*flow));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`,
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      });
      globe.add(new THREE.Mesh(geometry,plasma));
      loops.push({material:plasma,phase:i*.137,duration:32+(i%5)*7});
    }
  }
  return { update(time:number) {
    clock.value=time;
    for(const loop of loops) {
      const age=(time/loop.duration+loop.phase)%1;
      const life=THREE.MathUtils.smoothstep(age,0,.18)*(1-THREE.MathUtils.smoothstep(age,.66,1));
      loop.material.uniforms.life.value=life;
      loop.material.uniforms.growth.value=.25+.75*THREE.MathUtils.smoothstep(age,0,.42);
    }
  }};
}
