import * as THREE from 'three';
import { addLandscape } from './landscape.js';
import { addArchitecture } from './architecture.js';
import { chapters, markerSites } from './site.js';

const dayFog = new THREE.Color(0x9ab9ac);
const duskFog = new THREE.Color(0x9b7160);
const daySun = new THREE.Color(0xffefda);
const duskSun = new THREE.Color(0xffbd83);

function layout(renderer, camera, container) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const mobile = width <= 660 || width / height < .9;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.42 : 1.65));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = mobile ? 60 : 44;
  camera.filmOffset = mobile ? 0 : -5.4;
  camera.updateProjectionMatrix();
  return mobile;
}

export function createWorld(container, markers, reducedMotion) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.dataset.scene = 'ecospace';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(dayFog, .0046);
  const camera = new THREE.PerspectiveCamera(44, 1, .18, 1500);
  let mobile = layout(renderer, camera, container);
  const root = new THREE.Group();
  scene.add(root);
  const landscape = addLandscape(root);
  const architecture = addArchitecture(root);

  const fill = new THREE.HemisphereLight(0xcadfe5, 0x666443, 1.75);
  const sun = new THREE.DirectionalLight(daySun, 2.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -66;
  sun.shadow.camera.right = 66;
  sun.shadow.camera.top = 64;
  sun.shadow.camera.bottom = -64;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 214;
  sun.shadow.bias = -.00031;
  sun.shadow.normalBias = .12;
  sun.position.set(24, 45, -65);
  sun.target.position.set(-5, 0, 32);
  scene.add(fill, sun, sun.target);

  const aim = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const currentAim = new THREE.Vector3();
  const screen = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  let currentProgress = 0;
  let targetProgress = 0;
  let dusk = 0;
  let targetDusk = 0;
  let clock = 0;
  let lastFrame = null;
  let lastLight = -1;
  let stopped = false;
  let frameId;

  function chooseCamera(progress) {
    const start = Math.floor(progress);
    const fraction = progress - start;
    const end = Math.min(start + 1, chapters.length - 1);
    const weight = fraction * fraction * (3 - 2 * fraction);
    const positionKey = mobile ? 'phone' : 'position';
    const lookKey = mobile ? 'phoneLook' : 'look';
    cameraPosition.fromArray(chapters[start][positionKey]).lerp(to.fromArray(chapters[end][positionKey]), weight);
    aim.fromArray(chapters[start][lookKey]).lerp(to.fromArray(chapters[end][lookKey]), weight);
  }

  function projectMarkers() {
    const wide = !mobile && currentProgress < .59;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const occupied = [];
    camera.getWorldDirection(rayDirection);
    for (const element of markers) {
      const [x, z, y] = markerSites[element.dataset.marker];
      screen.set(x, y, z);
      const front = from.copy(screen).sub(camera.position).dot(rayDirection) > 0;
      screen.project(camera);
      const px = (screen.x * .5 + .5) * width;
      const py = (-screen.y * .5 + .5) * height;
      const separate = occupied.every(([cx, cy]) => Math.abs(px - cx) > 94 || Math.abs(py - cy) > 32);
      const visible = wide && front && separate && px > width * .49 && px < width - 62 && py > 86 && py < height - 90;
      element.dataset.visible = visible;
      if (visible) {
        occupied.push([px, py]);
        element.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0) translate(-50%,-50%)';
      }
    }
  }

  function updateLight() {
    if (Math.abs(lastLight - dusk) < .008) return;
    lastLight = dusk;
    sun.intensity = 2.25 - dusk * .72;
    sun.color.copy(daySun).lerp(duskSun, dusk);
    sun.position.set(24 - dusk * 63, 45 - dusk * 29, -65 + dusk * 42);
    fill.intensity = 1.75 - dusk * 1.05;
    scene.fog.color.copy(dayFog).lerp(duskFog, dusk);
    architecture.update(dusk);
    renderer.shadowMap.needsUpdate = true;
  }

  function frame(now) {
    if (stopped) return;
    const dt = lastFrame === null ? 1 / 60 : Math.min((now - lastFrame) / 1000, .12);
    lastFrame = now;
    const staticMotion = reducedMotion.matches;
    if (!staticMotion) clock += dt;
    currentProgress = staticMotion ? Math.round(targetProgress) : THREE.MathUtils.damp(currentProgress, targetProgress, 7.4, dt);
    dusk = staticMotion ? targetDusk : THREE.MathUtils.damp(dusk, targetDusk, 2.25, dt);
    chooseCamera(currentProgress);
    camera.position.copy(cameraPosition);
    camera.lookAt(currentAim.copy(aim));
    camera.updateMatrixWorld();
    updateLight();
    landscape.update(clock, dusk);
    renderer.render(scene, camera);
    projectMarkers();
    frameId = requestAnimationFrame(frame);
  }

  const handleResize = () => { mobile = layout(renderer, camera, container); };
  const onContextLost = (event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(frameId);
    container.classList.remove('ready');
    for (const marker of markers) marker.dataset.visible = false;
    container.dispatchEvent(new Event('scene-unavailable'));
  };

  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    stopped = false;
    lastLight = -1;
    lastFrame = null;
    container.classList.add('ready');
    container.dispatchEvent(new Event('scene-available'));
    frameId = requestAnimationFrame(frame);
  });
  window.addEventListener('resize', handleResize, { passive: true });
  renderer.shadowMap.autoUpdate = false;
  updateLight();
  container.prepend(renderer.domElement);

  return {
    start(progress) {
      currentProgress = targetProgress = progress;
      frame(performance.now());
      container.classList.add('ready');
    },
    progress(value) { targetProgress = value; },
    dusk(value) { targetDusk = Number(value); },
  };
}
