import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { traceCoronalField } from './coronal-field.ts';

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
  const geometries: THREE.BufferGeometry[] = [];
  const footpoints: THREE.Vector3[] = [];
  const radiusKm=695700;
  let inspection: { position: THREE.Vector3; target: THREE.Vector3 };
  // Clusters of nested arcades, with a spread of footpoint separations.
  for(let region=0;region<8;region++) {
    const azimuth=region*2.39996;
    const normal=new THREE.Vector3(Math.cos(azimuth),.12+(region%3)*.16,Math.sin(azimuth)).normalize();
    const east=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),normal).normalize();
    const north=new THREE.Vector3().crossVectors(normal,east).normalize();
    const tilt=.35*Math.sin(region*1.7);
    const tangent=east.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(north,Math.sin(tilt));
    const across=new THREE.Vector3().crossVectors(normal,tangent).normalize();
    if(region===3) inspection={position:normal.clone().multiplyScalar(1.06).addScaledVector(across,.3),target:normal.clone().multiplyScalar(1.035)};
    const separation=24000+(region%4)*18000;
    for(let strand=0;strand<66;strand++) {
      const family=Math.floor(strand/3);
      const seed=.05+(family%11)*.054+Math.sin(strand*3.71)*.002;
      const lateral=(Math.floor(family/11)-.5)*separation*.08 + Math.sin(strand*2.3)*separation*.009;
      const local=traceCoronalField(separation,seed,lateral);
      if(local.length<3) continue;
      const points=local.map(p=>normal.clone().addScaledVector(tangent,p.x/radiusKm).addScaledVector(across,p.z/radiusKm).normalize().multiplyScalar(1+(p.y+220)/radiusKm));
      const curve=new THREE.CatmullRomCurve3(points);
      // Observed resolved fine strands are of order 200–500 km across.
      const widthKm=200+(strand%5)*65;
      const geometry=new THREE.TubeGeometry(curve,128,widthKm*.5/radiusKm,6,false);
      const count=geometry.attributes.position.count;
      const strandData=new Float32Array(count*4);
      const lengthKm=curve.getLength()*radiusKm;
      for(let v=0;v<count;v++) {
        strandData[v*4]=region*.63+family*.173+Math.sin(strand)*.016;
        strandData[v*4+1]=lengthKm;
        strandData[v*4+2]=4200+(region%4)*1500+family*37;
        strandData[v*4+3]=widthKm/radiusKm;
      }
      geometry.setAttribute('strandData',new THREE.BufferAttribute(strandData,4));
      geometries.push(geometry);
      if(strand%15===0) footpoints.push(points[0],points[points.length-1]);
    }
  }
  const merged=mergeGeometries(geometries)!;
  geometries.forEach(g=>g.dispose());
  const vertexShader=`#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec4 strandData; varying vec4 data; varying vec2 loopUv;
    varying vec3 viewNormal; varying vec3 viewDirection; varying float altitude;
    uniform float sheath;
    void main(){
      data=strandData; loopUv=uv; altitude=max(0.,(length(position)-1.)*695700.);
      vec3 p=position+normal*strandData.w*sheath;
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);
      viewNormal=normalize(normalMatrix*normal);viewDirection=normalize(-mvPosition.xyz);
      gl_Position=projectionMatrix*mvPosition;
      #include <logdepthbuf_vertex>
    }`;
  const fragmentShader=`#include <common>
    #include <logdepthbuf_pars_fragment>
    uniform float time; uniform float sheath;
    varying vec4 data; varying vec2 loopUv; varying vec3 viewNormal; varying vec3 viewDirection; varying float altitude;
    void main(){
      #include <logdepthbuf_fragment>
      // The externally supplied clock is at 1/120 simulated seconds.
      float seconds=time*120.;
      float age=fract(seconds/data.z+data.x);
      float heating=smoothstep(0.,.10,age)*(1.-smoothstep(.45,.85,age));
      float cooling=smoothstep(.42,.60,age)*(1.-smoothstep(.82,1.,age));
      float density=(.35+.65*heating)*exp(-altitude/70000.);
      float feet=exp(-loopUv.x*22.)+exp(-(1.-loopUv.x)*22.);
      // Rain packets accelerate away from the apex, then drain into either footpoint.
      float rainAge=mod(seconds+data.x*271.,900.);
      float travel=30.*rainAge+.025*rainAge*rainAge;
      float along=abs(loopUv.x-.5)*data.y;
      float packet=exp(-pow((along-travel)/1100.,2.));
      float threads=.7+.3*sin(loopUv.x*37.+data.x*17.)*sin(loopUv.x*83.+data.x);
      float emission=density*density*threads + feet*.22*heating + packet*cooling*1.5;
      float soft=pow(abs(dot(normalize(viewNormal),normalize(viewDirection))),1.5);
      float alpha=soft*emission*(sheath>.5 ? .095 : .8);
      vec3 hot=vec3(1.,.38,.055), cool=vec3(1.,.095,.012);
      vec3 color=mix(hot,cool,cooling*.7);
      gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  for(const sheath of [0,2]) {
    const plasma=new THREE.ShaderMaterial({uniforms:{time:clock,sheath:{value:sheath}},vertexShader,fragmentShader,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.FrontSide});
    globe.add(new THREE.Mesh(merged,plasma));
  }
  // Patchy transition-region emission at the anchored footpoints (coronal moss).
  const mossGeometry=new THREE.BufferGeometry().setFromPoints(footpoints);
  const mossMaterial=new THREE.ShaderMaterial({uniforms:{time:clock},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(1400./max(1.,-mvPosition.z),1.,16.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.3,.03,exp(-r*r*5.)*.3);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  globe.add(new THREE.Points(mossGeometry,mossMaterial));
  return { inspection: inspection!, update(time:number){clock.value=time;} };
}
