import * as THREE from 'three';

// Schwarzschild null geodesics in pseudo-Cartesian coordinates, rs=1:
// p'' = -3 h² p / (2 |p|⁵). Velocity Verlet with adaptive affine steps.
// The static-observer tetrad initializes the angular momentum at finite radius.
// This is an independent numerical implementation, not Bruneton's LUT code.
const vertexShader = `varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader = `
precision highp float;
varying vec2 uvScreen;
uniform sampler2D depthMap, baseMap;
uniform mat3 cameraBasis;
uniform vec3 eye;
uniform float aspect, tanFov, radius, farPlane, time, lensing, diskEnabled, horizonGuide;
const float PI=3.14159265359;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec3 sky(vec3 d){
  // Direction-space stars, shared by straight and bent rays. Derivative filtering
  // softens points when a lens stretches their footprints.
  d=normalize(d);
  vec2 q=vec2(atan(d.z,d.x)/(2.*PI)+.5,asin(clamp(d.y,-1.,1.))/PI+.5)*vec2(1100.,550.);
  vec2 cell=floor(q);float h=hash(vec3(cell,1.));
  vec2 f=fract(q)-vec2(.15+.7*hash(vec3(cell,2.)),.15+.7*hash(vec3(cell,3.)));
  float width=max(.03,min(.45,length(fwidth(q))*.4));
  float star=(1.-smoothstep(.025,.025+width,length(f)))*step(.984,h);
  float twinkle=.72+.28*sin(time*.65+h*700.);
  return star*twinkle*mix(vec3(.65,.78,1.),vec3(1.,.86,.65),hash(vec3(cell,4.)));
}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(vec3(i,0.)),hash(vec3(i+vec2(1,0),0.)),f.x),mix(hash(vec3(i+vec2(0,1),0.)),hash(vec3(i+1.,0.)),f.x),f.y);}
vec3 emission(vec3 p,vec3 v){
  float r=length(p.xz);float a=atan(p.z,p.x);
  // Kepler-like differential rotation. Visual time deliberately independent of
  // mass so all seven disks can be inspected at an illustrative pace.
  float phase=a-time*.65/pow(r/3.,1.5);
  float bands=.45+.45*noise(vec2(r*11.,phase*4.))+ .10*sin(r*31.+sin(phase*5.+r*2.));
  float filaments=.6+.4*noise(vec2(r*27.,phase*11.));
  float edge=smoothstep(3.,3.25,r)*(1.-smoothstep(6.5,8.,r));
  float flux=pow(3./r,2.2)*bands*filaments*edge;
  vec3 tangent=normalize(vec3(-p.z,0.,p.x));
  float beta=sqrt(1./max(2.*(r-1.),1.));
  float doppler=sqrt(1.-beta*beta)/(1.-beta*dot(tangent,-normalize(v)));
  float g=sqrt(max(.01,1.-1./r))*doppler;
  vec3 color=mix(vec3(1.,.08,.008),vec3(1.,.65,.26),clamp((g-.5)*1.25+flux*.4,0.,1.));
  return color*flux*pow(g,3.)*3.5;
}
void main(){
  vec2 xy=(uvScreen*2.-1.)*vec2(aspect,1.)*tanFov;
  vec3 localRay=normalize(vec3(xy,-1.));
  vec3 rd=normalize(cameraBasis*localRay);
  float depth=texture2D(depthMap,uvScreen).x;
  float sceneDistance=(exp2(depth*log2(farPlane+1.))-1.)/(-localRay.z)/radius;
  float closest=-dot(eye,rd);
  // Preserve nearby high-resolution planets, clouds and ground. Only objects
  // behind the lens are candidates for its image; exhibition matter is static.
  bool ground=false;
  float groundT=rd.y<-.000001?(-1.-eye.y)/rd.y:1.e20;
  bool isFloor=depth<.999999 && groundT>0. && abs(sceneDistance-groundT)<max(.00005,groundT*.003);
  if(depth<.999999 && sceneDistance<max(0.,closest-3.) && !isFloor){gl_FragColor=vec4(0.);return;}
  ground=isFloor && groundT<max(0.,closest);
  vec3 p=eye;
  if(ground){p+=rd*groundT;p.y=-.99999;rd.y=-rd.y;}
  float along=-dot(p,rd);
  float impact2=dot(p,p)-along*along;
  // Outside the display disk, use the same sky without an expensive trace.
  if(along<0. || impact2>100.){
    gl_FragColor=ground?vec4(0.):vec4(1.-exp(-sky(rd)*1.3),depth>.999999?1.:0.);return;
  }
  if(length(p)>40.){float entry=along-sqrt(max(0.,1600.-impact2));p+=rd*max(0.,entry);}
  float r0=length(p);vec3 radial=p/r0;
  vec3 v=rd;
  if(lensing>.5) v=radial*dot(rd,radial)+(rd-radial*dot(rd,radial))/sqrt(max(.001,1.-1./r0));
  vec3 h=cross(p,v);float h2=dot(h,h);
  vec3 light=vec3(0.);float transmission=1.;bool captured=false;bool hitFloor=false;
  for(int i=0;i<220;i++){
    float r=length(p);
    if(r<1.001){captured=true;break;}
    if(r>42. && dot(p,v)>0.)break;
    float ds=clamp(r*.085,.018,2.);
    vec3 acc=-1.5*h2*p/pow(r,5.)*lensing;
    vec3 next=p+v*ds+.5*acc*ds*ds;
    float nr=max(length(next),.5);
    vec3 nv=v+.5*(acc-1.5*h2*next/pow(nr,5.)*lensing)*ds;
    if(diskEnabled>.5 && p.y*next.y<0.){
      vec3 crossing=mix(p,next,p.y/(p.y-next.y));float cr=length(crossing.xz);
      if(cr>3. && cr<8.){
        light+=transmission*emission(crossing,v);
        transmission*=.18;
      }
    }
    if(!ground && p.y> -1. && next.y<= -1.){hitFloor=true;break;}
    p=next;v=nv;
  }
  vec3 result=light+(captured||hitFloor?vec3(0.):sky(v)*transmission);
  // Gentle filmic compression. Main solar-system rendering stays at full res.
  result=1.-exp(-result*1.3);
  if(horizonGuide>.5 && !ground){
    float b=sqrt(max(0.,impact2));float line=1.-smoothstep(.003+fwidth(b),.006+fwidth(b)*2.,abs(b-1.));
    result=mix(result,vec3(.28,.72,1.),line*.9);
  }
  if(hitFloor) result+=(texture2D(baseMap,uvScreen).rgb)*transmission;
  float alpha=ground?.065:(((depth<.999999||hitFloor) && !captured && length(light)<.0001)?0.:1.);
  gl_FragColor=vec4(result,alpha);
}
`;

export function createBlackHoleEffects(renderer: THREE.WebGLRenderer) {
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  sceneTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const effectTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const uniforms = { baseMap: { value: sceneTarget.texture }, depthMap: { value: sceneTarget.depthTexture }, cameraBasis: { value: new THREE.Matrix3() }, eye: { value: new THREE.Vector3() }, aspect: { value: 1 }, tanFov: { value: 1 }, radius: { value: 1 }, farPlane: { value: 1e10 }, time: { value: 0 }, lensing: { value: 1 }, diskEnabled: { value: 1 }, horizonGuide: { value: 0 } };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const plane = new THREE.PlaneGeometry(2, 2);
  const passScene = new THREE.Scene();
  const pass = new THREE.Mesh(plane, material);pass.frustumCulled=false;passScene.add(pass);
  const ortho = new THREE.Camera();
  const compositeMaterial = new THREE.ShaderMaterial({ vertexShader, fragmentShader: `varying vec2 uvScreen; uniform sampler2D baseMap,effectMap;void main(){vec4 e=texture2D(effectMap,uvScreen);vec3 base=texture2D(baseMap,uvScreen).rgb;gl_FragColor=vec4(mix(base,e.rgb,e.a),1.);#include <colorspace_fragment>\n}`.replace(';#include',';\n#include'), uniforms: { baseMap:{value:sceneTarget.texture}, effectMap:{value:effectTarget.texture} }, depthTest:false, depthWrite:false, toneMapped:false });
  const composite = new THREE.Scene();composite.add(new THREE.Mesh(plane,compositeMaterial));
  const size = new THREE.Vector2();
  function resize(){
    renderer.getDrawingBufferSize(size);sceneTarget.setSize(size.x,size.y);
    const scale=Math.min(1,1280/size.x,900/size.y);effectTarget.setSize(Math.round(size.x*scale),Math.round(size.y*scale));
  }
  resize();
  return {
    resize,
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, center: THREE.Vector3, radius: number, time: number, lensing: boolean, disk: boolean, guide: boolean){
      uniforms.eye.value.copy(camera.position).sub(center).divideScalar(radius);
      uniforms.cameraBasis.value.setFromMatrix4(camera.matrixWorld);
      uniforms.aspect.value=camera.aspect;uniforms.tanFov.value=Math.tan(camera.fov*Math.PI/360);
      uniforms.radius.value=radius;uniforms.farPlane.value=camera.far;uniforms.time.value=time;
      uniforms.lensing.value=Number(lensing);uniforms.diskEnabled.value=Number(disk);uniforms.horizonGuide.value=Number(guide);
      renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      renderer.setRenderTarget(effectTarget);renderer.render(passScene,ortho);
      renderer.setRenderTarget(null);renderer.render(composite,ortho);
    },
    dispose(){sceneTarget.dispose();effectTarget.dispose();material.dispose();compositeMaterial.dispose();plane.dispose();},
  };
}
