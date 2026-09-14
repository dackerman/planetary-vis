import { BLACK_HOLES, blackHoleRadius, blackHolePosition, type BlackHoleId } from './black-holes';
import { createBlackHoleEffects } from './black-hole-effects';
import { createSolarEffects } from './solar-effects';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BODIES, bodyDimensions, bodyPosition, KM_PER_UNIT, type BodyId, type LayoutMode } from './planets';
import { DEFAULT_SPEED, formatDistance, surfaceDistanceKm, clampSpeed, movementDelta, safeMovement, type NavigationMode, type Telemetry } from './navigation';

export interface Observatory {
  focus(id: BodyId): void;
  setBlackHoles(enabled: boolean): void;
  selectBlackHole(id: BlackHoleId): void;
  inspectBlackHole(): void;
  besideSun(): void;
  setLensing(enabled: boolean): void;
  setDisk(enabled: boolean): void;
  setHorizonGuide(enabled: boolean): void;
  inspectSolarArcade(): void;
  overview(): void;
  zoom(factor: number): void;
  setLayout(layout: LayoutMode): void;
  setNavigation(mode: NavigationMode): void;
  setSpeed(kms: number): void;
  setMovementKey(code: string, pressed: boolean): void;
  setLabels(enabled: boolean): void;
  setMotion(enabled: boolean): void;
  setSolarTimeScale(scale: 1 | 120): void;
  dispose(): void;
}
interface Callbacks {
  onTelemetry(value: Telemetry): void;
  onSpeed(value: number): void;
  onNavigation(value: NavigationMode): void;
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
  renderer.domElement.setAttribute('aria-label', '3D scene. WASD moves, Q and E change altitude. Drag to look. Brackets change speed. Home returns to Earth.');
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.005, 10_000_000_000);
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

  let blackHolesEnabled = false;
  let activeHole: BlackHoleId = 'sgr';
  let lensingEnabled = true, diskEnabled = true, horizonGuide = false;
  let holeEffects: ReturnType<typeof createBlackHoleEffects> | undefined;
  const holeCenter = new THREE.Vector3();
  let holeRadius = blackHoleRadius(4.3e6);
  let layout: LayoutMode = 'compact';
  let navigation: NavigationMode = 'look';
  let selected: BodyId = 'earth';
  let speedKms = DEFAULT_SPEED;
  let traveledKm = 0;
  let telemetryTime = 0;
  let disposed = false;
  let motion = true;
  let labelsEnabled = true;
  let animationId = 0;
  let elapsed = 0;
  let solarElapsed = 0;
  let solarTimeScale: 1 | 120 = 120;
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
  let solarEffects: ReturnType<typeof createSolarEffects> | undefined;
  const bodies = BODIES.map(data => {
    const { radius, height } = bodyDimensions(data);
    const group = new THREE.Group();
    group.position.set(data.x, height, data.z);
    const material = data.id === 'sun'
      ? new THREE.MeshBasicMaterial({ map: texture('4k_sun.jpg'), color: 0xffd4a3 })
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
      solarEffects = createSolarEffects(globe, material as THREE.MeshBasicMaterial);
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
    label.innerHTML = `<span class="label-dot" style="background:${data.color}"></span>${data.name}<small>${(data.equatorial / 6378.1).toFixed(data.id === 'sun' ? 1 : 2)} × Earth</small><small class="label-distance"></small>`;
    label.setAttribute('aria-label', `Travel to ${data.name}`);
    label.addEventListener('click', () => { focus(data.id); callbacks.onSelect(data.id); });
    const distanceLabel = label.querySelector<HTMLElement>('.label-distance')!;
    labelLayer.appendChild(label);
    return { data, group, globe, radius, height, label, distanceLabel };
  });

  // Perspective-correct planar reflection, darkened to resemble polished obsidian.
  const reflectionShader = {
    uniforms: { gridStep: { value: 20 }, color: { value: new THREE.Color(0x151a22) }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() }, bodies: { value: bodies.map(b => new THREE.Vector4(b.data.x, b.data.z, b.radius, b.height)) } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 world;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vUv=textureMatrix*vec4(position,1.); world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float gridStep; uniform vec4 bodies[9]; varying vec4 vUv; varying vec3 world;
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
        vec2 majorGrid=abs(fract(world.xz/gridStep-.5)-.5)/max(fwidth(world.xz/gridStep),vec2(.0001));
        float majorLine=1.-min(min(majorGrid.x,majorGrid.y),1.);
        ground+=vec3(.033,.047,.066)*(line*.65*gridFade+majorLine*exp(-groundDistance/gridStep*.015))*(1.-shadow);
        // The broad light gradient and two grid scales keep the shared plane readable
        // both beside Earth and when the camera is hundreds of Earth radii away.
        ground*=mix(.75,1.,exp(-groundDistance*.001));
        gl_FragColor=vec4(ground+reflection*(.09+.12*grazing)*(1.-shadow*.45),1.);
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
  const stars = new THREE.Points(starGeometry, starsMaterial);
  stars.scale.setScalar(1000);
  stars.frustumCulled = false;
  scene.add(stars);

  // All custom materials share logarithmic depth with the planetary surfaces.
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
    const material = object.material;
    if (!(material instanceof THREE.ShaderMaterial) || material.vertexShader.includes('logdepthbuf_pars_vertex')) return;
    material.vertexShader = '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + material.vertexShader.replace(/}\s*$/, '\n#include <logdepthbuf_vertex>\n}');
    material.fragmentShader = '#include <logdepthbuf_pars_fragment>\n' + material.fragmentShader.replace(/void main\(\)\s*{/, 'void main(){\n#include <logdepthbuf_fragment>\n');
  });

  const holeLabel = document.createElement('button');
  holeLabel.className = 'world-label black-hole-label';
  holeLabel.hidden = true;
  holeLabel.addEventListener('click', () => inspectBlackHole());
  labelLayer.appendChild(holeLabel);

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
    if (blackHolesEnabled) setSpeed(DEFAULT_SPEED);
    selected = id;
    keys.clear();
    const body = bodies.find(b => b.data.id === id)!;
    controls.minDistance = body.radius * 1.13;
    const frame = framePosition(id);
    travel(frame.position, frame.target);
  }
  function inspectSolarArcade() {
    if (blackHolesEnabled) setSpeed(DEFAULT_SPEED);
    const sun=bodies.find(b=>b.data.id==='sun')!;
    if(!solarEffects) return;
    selected='sun'; keys.clear(); setNavigation('look'); controls.minDistance=.1;
    sun.globe.updateWorldMatrix(true,false);
    travel(sun.globe.localToWorld(solarEffects.inspection.position.clone()), sun.globe.localToWorld(solarEffects.inspection.target.clone()));
  }
  function overview() {
    if (blackHolesEnabled) { inspectBlackHole(); return; }
    controls.minDistance = 1;
    const aspect = container.clientWidth / container.clientHeight;
    if (layout === 'distances') {
      const span = BODIES.find(b => b.id === 'neptune')!.orbitKm / KM_PER_UNIT;
      travel(new THREE.Vector3(span / 2, span * 0.35, span * Math.max(1.5, 1.5 / aspect)), new THREE.Vector3(span / 2, 0, 0));
    } else {
      travel(new THREE.Vector3(130, 230, Math.max(365, 410 / aspect)), new THREE.Vector3(-50, 65, -125));
    }
  }
  function zoom(factor: number) {
    transition = null;
    const offset = camera.position.clone().sub(controls.target);
    if (navigation === 'look') {
      const delta = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar((1 - factor) * Math.min(offset.length(), blackHolesEnabled ? Math.max(1000, holeRadius * 10) : 1000));
      const safe = safeMovement(camera.position, delta, collisionBodies, blackHolesEnabled ? Math.min(.04, holeRadius * .01) : .04);
      camera.position.add(safe); controls.target.add(safe);
      return;
    }
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }
  const collisionBodies = bodies.map(b => ({ position: b.group.position, radius: b.radius, height: b.height }));
  const holeCollision = { position: holeCenter, radius: holeRadius, height: holeRadius };
  function selectBlackHole(id: BlackHoleId) {
    activeHole = id;
    const data = BLACK_HOLES.find(h => h.id === id)!;
    holeRadius = blackHoleRadius(data.mass);
    const p = blackHolePosition(data.mass);
    holeCenter.set(p.x,p.y,p.z);
    holeCollision.radius = holeRadius; holeCollision.height = holeRadius;
    holeLabel.textContent = '';
    holeLabel.appendChild(document.createTextNode(data.name));
    const diameter = document.createElement('small');diameter.textContent = `${formatDistance(holeRadius * 2 * KM_PER_UNIT)} horizon`;
    const distance = document.createElement('small');distance.className='label-distance';
    holeLabel.appendChild(diameter);holeLabel.appendChild(distance);
    if (blackHolesEnabled) inspectBlackHole();
  }
  function inspectBlackHole() {
    if (!blackHolesEnabled) return;
    keys.clear();setNavigation('look');controls.minDistance=holeRadius*1.1;setSpeed(holeRadius*KM_PER_UNIT*.025);
    const distance = holeRadius * Math.max(19, 17 / camera.aspect);
    travel(holeCenter.clone().add(new THREE.Vector3(holeRadius * .15, holeRadius * 3.5, distance)), holeCenter.clone());
  }
  function besideSun() {
    selected='sun';callbacks.onSelect('sun');keys.clear();setNavigation('look');setSpeed(DEFAULT_SPEED);
    const sun=bodies.find(b=>b.data.id==='sun')!;
    travel(sun.group.position.clone().add(new THREE.Vector3(-150, 160, 650)),sun.group.position.clone().add(new THREE.Vector3(0,30,-500)));
  }
  function setBlackHoles(enabled: boolean) {
    if (enabled === blackHolesEnabled) return;
    blackHolesEnabled=enabled;holeLabel.hidden=!enabled;scene.background=new THREE.Color(enabled ? '#000000' : '#020306');
    if(enabled){
      holeEffects ??= createBlackHoleEffects(renderer);
      setLayout('compact');selectBlackHole(activeHole);
      collisionBodies.push(holeCollision);controls.maxDistance=2e9;
      besideSun();
    }else{
      collisionBodies.splice(collisionBodies.indexOf(holeCollision),1);
      controls.maxDistance=2000;setSpeed(Math.min(speedKms,1e8));camera.near=.005;camera.updateProjectionMatrix();
      focus('earth');callbacks.onSelect('earth');
    }
  }
  const opening = framePosition('earth');
  camera.position.copy(opening.position);
  controls.target.copy(opening.target);
  controls.update();
  controls.enabled = false;
  const cancelTravel = () => { transition = null; };
  controls.addEventListener('start', cancelTravel);
  const keys = new Set<string>();
  let lastMovementAt = performance.now();
  let movingKms = 0;
  function integrateMovement(now: number) {
    const movementDt = Math.min(Math.max(0, (now - lastMovementAt) / 1000), 0.25);
    lastMovementAt = now;
    if (movementDt === 0) return;
    const delta = movementDelta(keys, camera.getWorldDirection(new THREE.Vector3()), speedKms, movementDt);
    const movement = safeMovement(camera.position, delta, collisionBodies, blackHolesEnabled ? Math.min(.04, holeRadius * .01) : .04);
    camera.position.add(movement);
    controls.target.add(movement);
    const movedKm = movement.length() * KM_PER_UNIT;
    traveledKm += movedKm;
    movingKms = movedKm / movementDt;
  }
  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);
  function setSpeed(value: number) {
    speedKms = clampSpeed(value);
    callbacks.onSpeed(speedKms);
  }
  function setNavigation(value: NavigationMode) {
    navigation = value;
    controls.enabled = value === 'orbit';
    callbacks.onNavigation(value);
  }
  function setLayout(value: LayoutMode) {
    layout = value;
    transition = null;
    keys.clear();
    traveledKm = 0;
    bodies.forEach((body, i) => {
      const p = bodyPosition(body.data, value);
      body.group.position.set(p.x, body.height, p.z);
      (floor.material as THREE.ShaderMaterial).uniforms.bodies.value[i].set(p.x, p.z, body.radius, body.height);
    });
    controls.maxDistance = value === 'distances' ? 6_000_000 : 2000;
    const frame = framePosition(selected);
    camera.position.copy(frame.position);
    controls.target.copy(frame.target);
    camera.lookAt(controls.target);
  }
  function setMovementKey(code: string, pressed: boolean) {
    // Integrate at input boundaries too, so quick taps between animation frames
    // move for their actual duration instead of being silently discarded.
    integrateMovement(performance.now());
    if (pressed) {
      transition = null;
      if (movementCodes.has(code) && navigation !== 'look') setNavigation('look');
      keys.add(code);
    } else keys.delete(code);
  }
  function keyDown(event: KeyboardEvent) {
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"]') || document.querySelector('[role="dialog"]')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const supported = [...movementCodes, 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'BracketLeft', 'BracketRight', 'Equal', 'Minus', 'Home'];
    if (!supported.includes(event.code)) return;
    event.preventDefault();
    if (movementCodes.has(event.code) || event.code.startsWith('Arrow')) setMovementKey(event.code, true);
    if (event.code === 'BracketLeft') setSpeed(speedKms / 2);
    if (event.code === 'BracketRight') setSpeed(speedKms * 2);
    if (event.code === 'Equal') zoom(0.85);
    if (event.code === 'Minus') zoom(1.18);
    if (event.code === 'Home') { focus('earth'); callbacks.onSelect('earth'); }
  }
  const keyUp = (event: KeyboardEvent) => setMovementKey(event.code, false);
  const blur = () => keys.clear();
  const visibility = () => { if (document.hidden) keys.clear(); };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  let dragging = false;
  let lastPointerX = 0, lastPointerY = 0;
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  function look(dx: number, dy: number) {
    transition = null;
    const distance = Math.max(1, Math.min(camera.position.distanceTo(controls.target), 1000));
    lookEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    lookEuler.y -= dx;
    lookEuler.x = THREE.MathUtils.clamp(lookEuler.x - dy, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    camera.quaternion.setFromEuler(lookEuler);
    controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(distance));
  }
  function pointerDown(event: PointerEvent) {
    if (navigation !== 'look' || event.button !== 0) return;
    renderer.domElement.focus({ preventScroll: true });
    dragging = true; lastPointerX = event.clientX; lastPointerY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!dragging || navigation !== 'look') return;
    look((event.clientX - lastPointerX) * 0.0025, (event.clientY - lastPointerY) * 0.0025);
    lastPointerX = event.clientX; lastPointerY = event.clientY;
  }
  const pointerUp = () => { dragging = false; };
  function wheel(event: WheelEvent) {
    if (navigation !== 'look') return;
    event.preventDefault();
    zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY * 0.001, -0.4, 0.4)));
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  renderer.domElement.addEventListener('pointercancel', pointerUp);
  renderer.domElement.addEventListener('lostpointercapture', pointerUp);
  renderer.domElement.addEventListener('wheel', wheel, { passive: false });
  const contextLost = (event: Event) => { event.preventDefault(); callbacks.onError('The graphics connection was interrupted. Reload to reopen the observatory.'); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);

  const resize = new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    holeEffects?.resize();
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
    const wallDelta = clock.getDelta();
    const dt = Math.min(wallDelta, 0.05);
    if (motion) { elapsed += dt; solarElapsed += wallDelta * solarTimeScale / 120; }
    if (transition) {
      const t = transition.duration ? Math.min((performance.now() - transition.start) / transition.duration, 1) : 1;
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.from, transition.to, ease);
      controls.target.lerpVectors(transition.targetFrom, transition.targetTo, ease);
      if (t === 1) transition = null;
    }
    if (keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') || keys.has('ArrowDown')) {
      transition = null;
      if (navigation === 'look') {
        look(((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * dt,
          ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * dt);
      } else {
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      spherical.theta += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * dt;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * dt, 0.03, Math.PI * 0.5);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      }
    }
    if (navigation === 'orbit') controls.update();
    integrateMovement(performance.now());
    // Keep navigation above the plane and outside every actual ellipsoid.
    for (const body of bodies) {
      offset.copy(camera.position).sub(body.group.position).divide(new THREE.Vector3(body.radius, body.height, body.radius));
      if (offset.lengthSq() < 1.08 * 1.08) {
        if (offset.lengthSq() < 0.00001) offset.set(0, 0, 1);
        offset.normalize().multiplyScalar(1.08).multiply(new THREE.Vector3(body.radius, body.height, body.radius));
        camera.position.copy(body.group.position).add(offset);
      }
      if (motion) body.globe.rotation.y += body.data.id === 'sun' ? wallDelta * solarTimeScale * 2 * Math.PI / (25.38 * 86400) : dt * 0.013;
    }
    if (blackHolesEnabled) {
      offset.copy(camera.position).sub(holeCenter);
      if(offset.length()<holeRadius*1.08){
        if(offset.lengthSq()===0)offset.set(0,0,1);
        camera.position.copy(holeCenter).add(offset.setLength(holeRadius*1.08));
      }
      const near=Math.max(1e-7,Math.min(.005,holeRadius*.001));
      if(camera.near!==near){camera.near=near;camera.updateProjectionMatrix();}
    }
    camera.position.y = Math.max(blackHolesEnabled ? Math.min(.04,holeRadius*.01) : .04, camera.position.y);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    solarEffects?.update(solarElapsed);
    starsMaterial.uniforms.time.value = elapsed;
    stars.position.copy(camera.position);
    floor.position.set(camera.position.x, 0, camera.position.z);
    floor.scale.setScalar(Math.max(1, camera.position.y / 120));
    const gridStep = Math.max(20, 5 * 10 ** Math.floor(Math.log10(Math.max(1, camera.position.y))));
    (floor.material as THREE.ShaderMaterial).uniforms.gridStep.value = gridStep;
    telemetryTime += dt;
    if (telemetryTime >= 0.12) {
      const reference = bodies.find(b => b.data.id === selected)!;
      callbacks.onTelemetry({ movingKms, traveledKm, blackHoleKm: blackHolesEnabled ? Math.max(0,camera.position.distanceTo(holeCenter)-holeRadius)*KM_PER_UNIT : undefined,
        gridKm: gridStep * KM_PER_UNIT, referenceKm: camera.position.distanceTo(reference.group.position) * KM_PER_UNIT });
      telemetryTime = 0;
    }
    // Keep high detail nearby; skip subpixel corona and atmosphere work.
    for (const body of bodies) {
      const angular = body.radius / camera.position.distanceTo(body.group.position);
      body.group.visible = !blackHolesEnabled || angular > 1e-7;
    }
    if (blackHolesEnabled && holeEffects) {
      holeEffects.render(scene,camera,holeCenter,holeRadius,elapsed,lensingEnabled,diskEnabled,horizonGuide);
      const anchor=holeCenter.clone().add(new THREE.Vector3(0,holeRadius*1.12,0));
      projected.copy(anchor).project(camera);
      const visible=labelsEnabled && projected.z>-1 && projected.z<1 && Math.abs(projected.x)<1 && Math.abs(projected.y)<1;
      holeLabel.style.opacity=visible?'1':'0';holeLabel.style.pointerEvents=visible?'auto':'none';
      holeLabel.tabIndex=visible?0:-1;holeLabel.setAttribute('aria-hidden',String(!visible));
      holeLabel.style.transform=`translate3d(${(projected.x*.5+.5)*container.clientWidth}px,${(-projected.y*.5+.5)*container.clientHeight}px,0) translate(-50%,-100%)`;
      holeLabel.querySelector('.label-distance')!.textContent=`${formatDistance(Math.max(0,camera.position.distanceTo(holeCenter)-holeRadius)*KM_PER_UNIT)} to horizon`;
    } else renderer.render(scene, camera);
    // Project labels with the same camera on every rendered frame.
    for (const body of bodies) {
      const anchor = body.group.position.clone().add(new THREE.Vector3(0, body.height + body.radius * 0.13, 0));
      projected.copy(anchor).project(camera);
      let visible = labelsEnabled && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
      const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
      const angularRadius = body.radius / camera.position.distanceTo(body.group.position);
      const distantBlend = 1 - THREE.MathUtils.smoothstep(angularRadius, 0.002, 0.008);
      const stem = layout === 'distances' ? distantBlend * ((body.data.id === 'sun' ? 4 : bodies.indexOf(body) % 4) * 44 + 18) : 0;
      const y = (-projected.y * 0.5 + 0.5) * container.clientHeight - stem;
      body.label.style.setProperty('--stem-height', `${stem}px`);
      body.label.classList.toggle('distant-marker', stem > 0);
      const sizeOpacity = 1;
      const distanceText = `${formatDistance(surfaceDistanceKm(camera.position, body.group.position, body.radius, body.height))} to surface`;
      if (body.distanceLabel.textContent !== distanceText) body.distanceLabel.textContent = distanceText;
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
      }
      // Fade occlusion changes, but never interpolate position: that would lag behind the planet.
      body.label.style.opacity = String(visible ? sizeOpacity : 0);
      body.label.style.pointerEvents = visible && sizeOpacity > 0.5 ? 'auto' : 'none';
      body.label.setAttribute('aria-hidden', String(!visible || sizeOpacity < 0.5));
      body.label.tabIndex = visible && sizeOpacity > 0.5 ? 0 : -1;
      if (projected.z > -1 && projected.z < 1) body.label.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
    }
  }
  animate();

  return {
    setBlackHoles, selectBlackHole, inspectBlackHole, besideSun,
    setLensing(value) { lensingEnabled=value; },
    setDisk(value) { diskEnabled=value; },
    setHorizonGuide(value) { horizonGuide=value; },
    focus, inspectSolarArcade, overview, zoom, setLayout, setNavigation, setSpeed, setMovementKey,
    setLabels(value) { labelsEnabled = value; labelLayer.hidden = !value; },
    setMotion(value) { motion = value; },
    setSolarTimeScale(value) { solarTimeScale = value; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationId);
      resize.disconnect(); controls.dispose();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('lostpointercapture', pointerUp);
      renderer.domElement.removeEventListener('wheel', wheel);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      holeEffects?.dispose();
      textures.forEach(t => t.dispose()); floor.dispose(); renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
