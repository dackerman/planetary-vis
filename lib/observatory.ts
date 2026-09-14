import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BODIES, bodyDimensions, type BodyId } from './planets';

export interface Observatory {
  focus(id: BodyId): void;
  overview(): void;
  zoom(factor: number): void;
  setLabels(enabled: boolean): void;
  setMotion(enabled: boolean): void;
  dispose(): void;
}
interface Callbacks {
  onReady(): void;
  onProgress(message: string): void;
  onSelect(id: BodyId): void;
  onError(message: string): void;
}

export function createObservatory(container: HTMLElement, callbacks: Callbacks): Observatory {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020306');
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D scene. Arrow keys orbit. Plus and minus zoom. Home returns to Earth.');
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.005, 30000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.8;
  controls.maxDistance = 2000;
  controls.minDistance = 1.15;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.screenSpacePanning = true;

  scene.add(new THREE.AmbientLight(0xb5c7e2, 0.35));
  scene.add(new THREE.HemisphereLight(0xc9ddff, 0x10121c, 0.9));
  const key = new THREE.DirectionalLight(0xfff3e5, 3.2);
  key.position.set(-40, 65, 55);
  scene.add(key);
  const sunLight = new THREE.DirectionalLight(0xffb960, 0.75);
  sunLight.position.set(-115, 109, -255);
  scene.add(sunLight);

  let disposed = false;
  let motion = true;
  let labelsEnabled = true;
  let animationId = 0;
  let elapsed = 0;
  let frame = 0;
  const textures: THREE.Texture[] = [];
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const missingAssets: string[] = [];
  manager.onProgress = (_url, loaded, total) => callbacks.onProgress(`Bringing worlds into view · ${Math.round(loaded / total * 100)}%`);
  manager.onError = url => missingAssets.push(url);
  manager.onLoad = () => {
    if (disposed) { textures.forEach(t => t.dispose()); return; }
    if (missingAssets.length) callbacks.onError('Some planet textures could not load. Reload to restore the full experience.');
    else callbacks.onReady();
  };
  function texture(file: string, color = true) {
    const map = loader.load(`/textures/${file}`);
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(map);
    return map;
  }

  const geometry = new THREE.SphereGeometry(1, 112, 80);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  container.appendChild(labelLayer);
  const bodies = BODIES.map(data => {
    const { radius, height } = bodyDimensions(data);
    const group = new THREE.Group();
    group.position.set(data.x, height, data.z);
    const material = data.id === 'sun'
      ? new THREE.MeshBasicMaterial({ map: texture(data.texture), color: 0xffd4a3 })
      : new THREE.MeshStandardMaterial({ map: texture(data.id === 'earth' ? '8k_earth_daymap.jpg' : data.texture), roughness: data.id === 'earth' ? 0.72 : 0.95, metalness: 0 });
    const globe = new THREE.Mesh(geometry, material);
    globe.scale.set(radius, height, radius);
    globe.rotation.y = data.id === 'earth' ? 2.2 : 0.6;
    group.add(globe);
    scene.add(group);

    if (data.id === 'earth') {
      const clouds = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 'white', alphaMap: texture('2k_earth_clouds.jpg', false), transparent: true, opacity: 0.68, roughness: 1, depthWrite: false }));
      clouds.scale.set(radius * 1.0015, height * 1.0015, radius * 1.0015);
      clouds.rotation.y = globe.rotation.y;
      group.add(clouds);
      // A thin atmosphere (80 km), not an exaggerated second planet radius.
      const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color('#3e9fff') } },
        vertexShader: `varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }`,
        fragmentShader: `varying vec3 n; varying vec3 v; uniform vec3 glow; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.); gl_FragColor=vec4(glow,rim*.4); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      atmosphere.scale.set(radius + 80 / 6378.1, height + 80 / 6378.1, radius + 80 / 6378.1);
      group.add(atmosphere);
    }
    if (data.id === 'saturn') {
      const inner = 74500 / 6378.1, outer = 136775 / 6378.1;
      const ringsGeometry = new THREE.RingGeometry(inner, outer, 192, 1);
      const position = ringsGeometry.attributes.position;
      const uv = ringsGeometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        const r = Math.hypot(position.getX(i), position.getY(i));
        uv.setXY(i, (r - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(ringsGeometry, new THREE.MeshStandardMaterial({ map: texture('2k_saturn_ring_alpha.png'), side: THREE.DoubleSide, transparent: true, opacity: 0.92, alphaTest: 0.03, roughness: 0.9 }));
      // Horizontal display orientation keeps both the planet and rings above the shared ground.
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    }
    if (data.id === 'sun') {
      const halo = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        uniforms: { haloColor: { value: new THREE.Color('#ff8f28') } },
        vertexShader: `varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
        fragmentShader: `varying vec3 n;varying vec3 v;uniform vec3 haloColor;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);gl_FragColor=vec4(haloColor,rim*.25);}`,
        side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      halo.scale.setScalar(radius * 1.025);
      group.add(halo);
    }
    const label = document.createElement('button');
    label.className = 'world-label';
    label.innerHTML = `<span class="label-dot" style="background:${data.color}"></span>${data.name}<small>${(data.equatorial / 6378.1).toFixed(data.id === 'sun' ? 1 : 2)} × Earth</small>`;
    label.setAttribute('aria-label', `Travel to ${data.name}`);
    label.addEventListener('click', () => { focus(data.id); callbacks.onSelect(data.id); });
    labelLayer.appendChild(label);
    return { data, group, globe, radius, height, label };
  });

  // Perspective-correct planar reflection, darkened to resemble polished obsidian.
  const reflectionShader = {
    uniforms: { color: { value: new THREE.Color(0x151a22) }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() }, bodies: { value: bodies.map(b => new THREE.Vector4(b.data.x, b.data.z, b.radius, b.height)) } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 world;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vUv=textureMatrix*vec4(position,1.); world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec4 bodies[9]; varying vec4 vUv; varying vec3 world;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 reflection=texture2DProj(tDiffuse,vUv).rgb;
        float shadow=0.;
        for(int i=0;i<9;i++){
          vec4 b=bodies[i]; vec2 p=world.xz-b.xy;
          float contact=exp(-dot(p,p)/(b.z*b.z*.20))*.96;
          vec2 projected=(p-vec2(.615,-.846)*b.w)/vec2(b.z*1.18,b.z*1.32);
          float castShadow=(1.-smoothstep(.72,1.35,length(projected)))*.68;
          shadow=max(shadow,max(contact,castShadow));
        }
        float grazing=pow(1.-clamp(normalize(cameraPosition-world).y,0.,1.),3.);
        vec3 ground=vec3(.036,.046,.062)*(1.-shadow*.97);
        vec2 grid=abs(fract(world.xz/2.-.5)-.5)/max(fwidth(world.xz/2.),vec2(.0001));
        float line=1.-min(min(grid.x,grid.y),1.);
        float groundDistance=length(world.xz-cameraPosition.xz);
        float gridFade=exp(-groundDistance*.018);
        vec2 majorGrid=abs(fract(world.xz/20.-.5)-.5)/max(fwidth(world.xz/20.),vec2(.0001));
        float majorLine=1.-min(min(majorGrid.x,majorGrid.y),1.);
        ground+=vec3(.033,.047,.066)*(line*.65*gridFade+majorLine*exp(-groundDistance*.0015))*(1.-shadow);
        // The broad light gradient and two grid scales keep the shared plane readable
        // both beside Earth and when the camera is hundreds of Earth radii away.
        ground*=mix(.75,1.,exp(-groundDistance*.001));
        gl_FragColor=vec4(ground+reflection*(.30+.25*grazing)*(1.-shadow*.45),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const floor = new Reflector(new THREE.PlaneGeometry(24000, 24000), { textureWidth: Math.min(1536, container.clientWidth), textureHeight: Math.min(1024, container.clientHeight), multisample: 0, clipBias: 0.00001, shader: reflectionShader });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(2600 * 3);
  const phases = new Float32Array(2600);
  let seed = 2046;
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < 2600; i++) {
    const phi = Math.acos(2 * random() - 1), theta = random() * Math.PI * 2;
    starPositions.set([Math.sin(phi) * Math.cos(theta) * 9000, Math.abs(Math.cos(phi)) * 9000 + 40, Math.sin(phi) * Math.sin(theta) * 9000], i * 3);
    phases[i] = random() * 20;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const starsMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float phase; varying float p; uniform float pixelRatio;void main(){p=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(.75+fract(phase)*1.7)*pixelRatio;}`,
    fragmentShader: `uniform float time;varying float p;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.12,.5,d))*(.35+.5*(.5+.5*sin(time*(.35+fract(p)) + p)));gl_FragColor=vec4(mix(vec3(.7,.8,1.),vec3(1.,.9,.75),fract(p)),a);}`,
    transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Points(starGeometry, starsMaterial));

  // All custom materials share logarithmic depth with the planetary surfaces.
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
    const material = object.material;
    if (!(material instanceof THREE.ShaderMaterial) || material.vertexShader.includes('logdepthbuf_pars_vertex')) return;
    material.vertexShader = '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + material.vertexShader.replace(/}\s*$/, '\n#include <logdepthbuf_vertex>\n}');
    material.fragmentShader = '#include <logdepthbuf_pars_fragment>\n' + material.fragmentShader.replace(/void main\(\)\s*{/, 'void main(){\n#include <logdepthbuf_fragment>\n');
  });

  let transition: { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; start: number; duration: number } | null = null;
  function framePosition(id: BodyId) {
    const body = bodies.find(b => b.data.id === id)!;
    const aspect = container.clientWidth / container.clientHeight;
    const displayRadius = id === 'saturn' ? 22 : body.radius;
    const distance = displayRadius * Math.max(3.9, 2.9 / aspect);
    const target = body.group.position.clone();
    // Aim below the center so the tangent point and its reflection remain above
    // the bottom navigation instead of disappearing underneath it.
    target.y = body.height * 0.65;
    if (aspect > 1.2) target.x -= displayRadius * 0.32;
    return { position: target.clone().add(new THREE.Vector3(displayRadius * 0.08, displayRadius * 0.95, distance)), target };
  }
  function travel(position: THREE.Vector3, target: THREE.Vector3) {
    transition = { from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target, start: performance.now(), duration: motion ? 1800 : 0 };
  }
  function focus(id: BodyId) {
    const body = bodies.find(b => b.data.id === id)!;
    controls.minDistance = body.radius * 1.13;
    const frame = framePosition(id);
    travel(frame.position, frame.target);
  }
  function overview() {
    controls.minDistance = 1;
    const aspect = container.clientWidth / container.clientHeight;
    travel(new THREE.Vector3(130, 230, Math.max(365, 410 / aspect)), new THREE.Vector3(-50, 65, -125));
  }
  function zoom(factor: number) {
    transition = null;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }
  const opening = framePosition('earth');
  camera.position.copy(opening.position);
  controls.target.copy(opening.target);
  controls.update();
  const cancelTravel = () => { transition = null; };
  controls.addEventListener('start', cancelTravel);
  const keys = new Set<string>();
  function keyDown(event: KeyboardEvent) {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) event.preventDefault();
    keys.add(event.key);
    if (event.key === '+' || event.key === '=') zoom(0.85);
    if (event.key === '-') zoom(1.18);
    if (event.key === 'Home') { focus('earth'); callbacks.onSelect('earth'); }
  }
  const keyUp = (event: KeyboardEvent) => keys.delete(event.key);
  const blur = () => keys.clear();
  renderer.domElement.addEventListener('keydown', keyDown);
  renderer.domElement.addEventListener('keyup', keyUp);
  renderer.domElement.addEventListener('blur', blur);
  const contextLost = (event: Event) => { event.preventDefault(); callbacks.onError('The graphics connection was interrupted. Reload to reopen the observatory.'); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);

  const resize = new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    floor.getRenderTarget().setSize(Math.min(1536, container.clientWidth), Math.min(1024, container.clientHeight));
  });
  resize.observe(container);
  const clock = new THREE.Clock();
  const projected = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const ray = new THREE.Ray();
  const localRay = new THREE.Ray();
  const inverse = new THREE.Matrix4();
  const hit = new THREE.Vector3();
  const unitSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();

  function animate() {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (motion) elapsed += dt;
    if (transition) {
      const t = transition.duration ? Math.min((performance.now() - transition.start) / transition.duration, 1) : 1;
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.from, transition.to, ease);
      controls.target.lerpVectors(transition.targetFrom, transition.targetTo, ease);
      if (t === 1) transition = null;
    }
    if (keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') || keys.has('ArrowDown')) {
      transition = null;
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      spherical.theta += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * dt;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * dt, 0.03, Math.PI * 0.5);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    }
    controls.update();
    // Keep navigation above the plane and outside every actual ellipsoid.
    for (const body of bodies) {
      offset.copy(camera.position).sub(body.group.position).divide(new THREE.Vector3(body.radius, body.height, body.radius));
      if (offset.lengthSq() < 1.08 * 1.08) {
        if (offset.lengthSq() < 0.00001) offset.set(0, 0, 1);
        offset.normalize().multiplyScalar(1.08).multiply(new THREE.Vector3(body.radius, body.height, body.radius));
        camera.position.copy(body.group.position).add(offset);
      }
      if (motion) body.globe.rotation.y += dt * (body.data.id === 'sun' ? 0.006 : 0.013);
    }
    camera.position.y = Math.max(0.04, camera.position.y);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    starsMaterial.uniforms.time.value = elapsed;
    renderer.render(scene, camera);
    if (++frame % 4 !== 0) return;
    const occupied: { x: number; y: number }[] = [];
    for (const body of bodies) {
      const anchor = new THREE.Vector3(body.data.x, body.height * 2 + body.radius * 0.13, body.data.z);
      projected.copy(anchor).project(camera);
      let visible = labelsEnabled && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.92 && projected.y < 0.78 && projected.y > -0.52;
      const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
      if (body.radius / camera.position.distanceTo(body.group.position) < 0.004) visible = false;
      if (visible) {
        const distance = anchor.distanceTo(camera.position);
        ray.set(camera.position, direction.copy(anchor).sub(camera.position).normalize());
        for (const other of bodies) {
          if (other === body) continue;
          inverse.copy(other.globe.matrixWorld).invert();
          localRay.copy(ray).applyMatrix4(inverse);
          if (localRay.intersectSphere(unitSphere, hit)) {
            hit.applyMatrix4(other.globe.matrixWorld);
            if (hit.distanceTo(camera.position) < distance) { visible = false; break; }
          }
        }
        if (occupied.some(p => Math.abs(p.x - x) < 115 && Math.abs(p.y - y) < 42)) visible = false;
      }
      body.label.hidden = !visible;
      if (visible) { occupied.push({x,y}); body.label.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; }
    }
  }
  animate();

  return {
    focus, overview, zoom,
    setLabels(value) { labelsEnabled = value; labelLayer.hidden = !value; },
    setMotion(value) { motion = value; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationId);
      resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('keydown', keyDown);
      renderer.domElement.removeEventListener('keyup', keyUp);
      renderer.domElement.removeEventListener('blur', blur);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      textures.forEach(t => t.dispose()); floor.dispose(); renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
