import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createIcons, Home, Pause, Play, RotateCcw } from 'lucide';

type ViewMode = 'galaxy' | 'curvature' | 'freefall';

type LabelSprite = THREE.Sprite & {
  userData: {
    baseScale: number;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    text: string;
  };
};

type ModeMetric = {
  label: string;
  value: string;
};

const canvas = document.querySelector<HTMLCanvasElement>('#universe-canvas');
if (!canvas) {
  throw new Error('Canvas #universe-canvas not found');
}

const state = {
  mode: 'galaxy' as ViewMode,
  paused: false,
  elapsed: 0,
  appleCycle: 0,
  timeScale: 1,
  curvatureStrength: 1,
  showWorldline: true,
  showLabels: true,
};

const explanationByMode: Record<ViewMode, { title: string; copy: string }> = {
  galaxy: {
    title: 'La galaxia desde el sistema solar',
    copy:
      'El Sol queda fijado como origen. La Via Lactea gira alrededor de un centro desplazado a escala: asi se ve el vecindario galactico sin abandonar nuestro marco de referencia.',
  },
  curvature: {
    title: 'Gravedad como geometria',
    copy:
      'La malla no es una sabana fisica: representa como las trayectorias naturales se inclinan cerca de la Tierra. La manzana cae porque su geodesica apunta hacia menor radio.',
  },
  freefall: {
    title: 'Manzana inerte, piso acelerado',
    copy:
      'Este es el marco local que cae con la manzana. La manzana permanece casi fija porque sigue una geodesica; el piso, sostenido por la materia de la Tierra, acelera hacia arriba hasta alcanzarla.',
  },
};

const metricsByMode: Record<ViewMode, [ModeMetric, ModeMetric, ModeMetric]> = {
  galaxy: [
    { label: 'Sol a centro galactico', value: '~26 000 años luz' },
    { label: 'Marco usado', value: 'sistema solar como origen' },
    { label: 'Lectura fisica', value: 'la galaxia queda en contexto' },
  ],
  curvature: [
    { label: 'Aceleracion superficial', value: '9.8 m/s²' },
    { label: 'Manzana', value: 'geodesica de caida libre' },
    { label: 'Piso', value: 'linea no geodesica' },
  ],
  freefall: [
    { label: 'Manzana', value: 'a propia ~ 0 m/s²' },
    { label: 'Piso/Tierra', value: 'a propia ~ 9.8 m/s² arriba' },
    { label: 'Movimiento', value: 'el suelo sube en este marco' },
  ],
};

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030306);
scene.fog = new THREE.FogExp2(0x030306, 0.006);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.02, 3200);
camera.position.set(26, 16, 38);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 620;
controls.target.set(0, 0, 0);

const root = new THREE.Group();
const galaxyGroup = new THREE.Group();
const earthGroup = new THREE.Group();
const freefallGroup = new THREE.Group();
const labelsGroup = new THREE.Group();
root.add(galaxyGroup, earthGroup, freefallGroup, labelsGroup);
scene.add(root);

const galaxyCenter = new THREE.Vector3(-140, -6, -90);
const solarOrigin = new THREE.Vector3(0, 0, 0);
const earthRadius = 5;
const appleStartHeight = 42;
const appleVisualHeight = 6.4;
const appleRadius = 0.34;
const fallDuration = Math.sqrt((2 * appleStartHeight) / 9.81);
const localApplePosition = new THREE.Vector3(5.2, 2.35, 0);

const ambient = new THREE.AmbientLight(0x4f586f, 1.7);
const sunLight = new THREE.PointLight(0xfff3c4, 550, 900, 1.25);
sunLight.position.copy(solarOrigin);
const earthLight = new THREE.DirectionalLight(0xcde9ff, 3.0);
earthLight.position.set(18, 20, 24);
scene.add(ambient, sunLight, earthLight);

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(
  'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
);
earthTexture.colorSpace = THREE.SRGBColorSpace;
const earthBump = textureLoader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');

const galaxy = createGalaxy();
const galacticPlane = createGalacticPlane();
const sun = createSun();
const solarAxes = createSolarAxes();
const orbitRings = createOrbitRings();
galaxyGroup.add(galaxy, galacticPlane, sun, solarAxes, orbitRings);

const earth = createEarth();
const atmosphere = createAtmosphere();
const spacetimeGrid = createSpacetimeGrid();
const apple = createApple();
const accelerationArrow = createArrow(0xe65f3c, 8);
const surfaceArrow = createArrow(0x58d38b, 3.9);
const worldline = createWorldline();
const localLab = createLocalLab();
earthGroup.position.set(0, 0, 0);
earthGroup.add(earth, atmosphere, spacetimeGrid, apple, accelerationArrow, surfaceArrow, worldline);
freefallGroup.add(localLab);

const galacticLabel = createLabel('Sagittarius A* / centro galactico', 0xf0c15d);
galacticLabel.position.copy(galaxyCenter).add(new THREE.Vector3(0, 10, 0));
const solarLabel = createLabel('Sistema solar: origen del marco', 0x8fd8ff);
solarLabel.position.set(0, 5.5, 0);
const earthLabel = createLabel('Tierra: superficie acelerada', 0x9bd3ff);
earthLabel.position.set(-7.2, 6.8, 0);
const appleLabel = createLabel('manzana inercial: a propia ~ 0', 0xff7662);
const gridLabel = createLabel('malla = geometria efectiva del espacio-tiempo', 0xe8dd9c);
gridLabel.position.set(9, -1.5, -8);
const floorLabel = createLabel('piso/Tierra acelera hacia arriba', 0x88f2a6);
floorLabel.position.set(8.7, -3.6, 2);
floorLabel.scale.set(6.8, 1.25, 1);
labelsGroup.add(galacticLabel, solarLabel, earthLabel, appleLabel, gridLabel, floorLabel);

const clock = new THREE.Clock();

const elements = {
  playToggle: document.querySelector<HTMLButtonElement>('#play-toggle'),
  resetSim: document.querySelector<HTMLButtonElement>('#reset-sim'),
  cameraHome: document.querySelector<HTMLButtonElement>('#camera-home'),
  timeScale: document.querySelector<HTMLInputElement>('#time-scale'),
  timeScaleValue: document.querySelector<HTMLOutputElement>('#time-scale-value'),
  curvatureStrength: document.querySelector<HTMLInputElement>('#curvature-strength'),
  curvatureValue: document.querySelector<HTMLOutputElement>('#curvature-value'),
  showWorldline: document.querySelector<HTMLInputElement>('#show-worldline'),
  showLabels: document.querySelector<HTMLInputElement>('#show-labels'),
  modeTitle: document.querySelector<HTMLElement>('#mode-title'),
  modeCopy: document.querySelector<HTMLElement>('#mode-copy'),
  timeReadout: document.querySelector<HTMLElement>('#time-readout'),
  heightReadout: document.querySelector<HTMLElement>('#height-readout'),
  frameReadout: document.querySelector<HTMLElement>('#frame-readout'),
  metricOneLabel: document.querySelector<HTMLElement>('#metric-one-label'),
  metricOneValue: document.querySelector<HTMLElement>('#metric-one-value'),
  metricTwoLabel: document.querySelector<HTMLElement>('#metric-two-label'),
  metricTwoValue: document.querySelector<HTMLElement>('#metric-two-value'),
  metricThreeLabel: document.querySelector<HTMLElement>('#metric-three-label'),
  metricThreeValue: document.querySelector<HTMLElement>('#metric-three-value'),
};

createIcons({
  icons: { Home, Pause, Play, RotateCcw },
  attrs: {
    width: 18,
    height: 18,
    'stroke-width': 2.1,
  },
});

mountControls();
setMode('galaxy');
animate();

function mountControls() {
  if (!elements.playToggle || !elements.resetSim || !elements.cameraHome) {
    throw new Error('Missing control buttons');
  }

  elements.playToggle.innerHTML = '<i data-lucide="pause"></i>';
  elements.resetSim.innerHTML = '<i data-lucide="rotate-ccw"></i>';
  elements.cameraHome.innerHTML = '<i data-lucide="home"></i>';
  createIcons({ icons: { Home, Pause, Play, RotateCcw } });

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.view as ViewMode));
  });

  elements.playToggle.addEventListener('click', () => {
    state.paused = !state.paused;
    elements.playToggle!.innerHTML = state.paused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
    elements.playToggle!.setAttribute('aria-label', state.paused ? 'Reproducir simulacion' : 'Pausar simulacion');
    elements.playToggle!.setAttribute('title', state.paused ? 'Reproducir simulacion' : 'Pausar simulacion');
    createIcons({ icons: { Pause, Play } });
  });

  elements.resetSim.addEventListener('click', () => {
    state.appleCycle = 0;
  });

  elements.cameraHome.addEventListener('click', () => {
    setMode(state.mode);
  });

  elements.timeScale?.addEventListener('input', () => {
    state.timeScale = Number(elements.timeScale!.value);
    elements.timeScaleValue!.value = `${state.timeScale.toFixed(2)}x`;
  });

  elements.curvatureStrength?.addEventListener('input', () => {
    state.curvatureStrength = Number(elements.curvatureStrength!.value);
    elements.curvatureValue!.value = `${state.curvatureStrength.toFixed(2)}x`;
  });

  elements.showWorldline?.addEventListener('change', () => {
    state.showWorldline = elements.showWorldline!.checked;
  });

  elements.showLabels?.addEventListener('change', () => {
    state.showLabels = elements.showLabels!.checked;
  });

  window.addEventListener('resize', onResize);
}

function setMode(mode: ViewMode) {
  state.mode = mode;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    const selected = button.dataset.view === mode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });

  elements.modeTitle!.textContent = explanationByMode[mode].title;
  elements.modeCopy!.textContent = explanationByMode[mode].copy;
  elements.frameReadout!.textContent = `marco: ${mode === 'freefall' ? 'caida libre' : mode === 'galaxy' ? 'solar' : 'curvatura'}`;
  updateMetrics(mode);

  if (mode === 'galaxy') {
    tweenCamera(new THREE.Vector3(34, 24, 54), new THREE.Vector3(-28, -3, -22));
  } else if (mode === 'curvature') {
    tweenCamera(new THREE.Vector3(18, 12, 22), new THREE.Vector3(0, 0.6, 0));
  } else {
    tweenCamera(new THREE.Vector3(12.5, 5.5, 13), new THREE.Vector3(5.4, -0.9, 0));
  }
}

function updateMetrics(mode: ViewMode) {
  const [one, two, three] = metricsByMode[mode];
  elements.metricOneLabel!.textContent = one.label;
  elements.metricOneValue!.textContent = one.value;
  elements.metricTwoLabel!.textContent = two.label;
  elements.metricTwoValue!.textContent = two.value;
  elements.metricThreeLabel!.textContent = three.label;
  elements.metricThreeValue!.textContent = three.value;
}

function tweenCamera(position: THREE.Vector3, target: THREE.Vector3) {
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!state.paused) {
    state.elapsed += dt * state.timeScale;
    state.appleCycle = (state.appleCycle + dt * state.timeScale) % (fallDuration + 1.4);
  }

  updateScene(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateScene(dt: number) {
  const t = state.elapsed;
  galaxyGroup.rotation.y += dt * 0.014 * state.timeScale;
  galaxy.rotation.y = Math.sin(t * 0.04) * 0.018;
  galacticPlane.rotation.z = -0.12 + Math.sin(t * 0.05) * 0.015;
  earth.rotation.y += dt * 0.18 * state.timeScale;
  atmosphere.rotation.y -= dt * 0.04 * state.timeScale;

  const fallT = Math.min(state.appleCycle, fallDuration);
  const heightMeters = Math.max(0, appleStartHeight - 0.5 * 9.81 * fallT * fallT);
  const normalizedHeight = heightMeters / appleStartHeight;
  const radialDistance = earthRadius + appleRadius + normalizedHeight * appleVisualHeight;
  const orbitAngle = -0.42 + Math.sin(t * 0.2) * 0.08;
  apple.position.set(Math.sin(orbitAngle) * 1.35, radialDistance, Math.cos(orbitAngle) * 1.35);
  apple.rotation.y += dt * 2.8;
  apple.rotation.x += dt * 1.4;
  accelerationArrow.position.copy(apple.position).add(new THREE.Vector3(0, -1.0, 0));
  accelerationArrow.lookAt(new THREE.Vector3(0, 0, 0));
  accelerationArrow.visible = state.mode === 'curvature';

  updateSpacetimeGrid();
  updateWorldline();
  updateLocalLab(fallT);
  updateDynamicLabels();
  updateVisibility();
  updateReadouts(fallT, heightMeters);
}

function updateDynamicLabels() {
  if (state.mode === 'freefall') {
    appleLabel.scale.set(6.2, 1.25, 1);
    appleLabel.position.copy(localApplePosition).add(new THREE.Vector3(1.4, 1.1, 0.4));
    return;
  }

  appleLabel.scale.set(8.8, 1.8, 1);
  appleLabel.position.copy(apple.position).add(new THREE.Vector3(1.4, 1.2, 0.5));
}

function updateVisibility() {
  galaxyGroup.visible = state.mode === 'galaxy';
  galacticLabel.visible = state.mode === 'galaxy' && state.showLabels;
  solarLabel.visible = state.mode === 'galaxy' && state.showLabels;

  earthGroup.visible = state.mode !== 'galaxy';
  earth.visible = state.mode === 'curvature';
  atmosphere.visible = state.mode === 'curvature';
  spacetimeGrid.visible = state.mode === 'curvature';
  freefallGroup.visible = state.mode === 'freefall';
  earthLabel.visible = state.mode === 'curvature' && state.showLabels;
  appleLabel.visible = state.mode !== 'galaxy' && state.showLabels;
  gridLabel.visible = state.mode === 'curvature' && state.showLabels;
  floorLabel.visible = state.mode === 'freefall' && state.showLabels;
  labelsGroup.visible = state.showLabels;
  worldline.visible = state.showWorldline && state.mode === 'curvature';
  localLab.userData.floorTrail.visible = state.showWorldline && state.mode === 'freefall';
}

function updateReadouts(fallT: number, heightMeters: number) {
  elements.timeReadout!.textContent = `t = ${fallT.toFixed(1)} s`;
  elements.heightReadout!.textContent = `manzana: ${heightMeters.toFixed(1)} m`;
}

function createGalaxy() {
  const count = 18000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const radius = Math.pow(Math.random(), 0.58) * 170 + 8;
    const arm = i % 4;
    const spin = radius * 0.043;
    const angle = arm * Math.PI * 0.5 + spin + randomSpread(0.34);
    const band = randomSpread(5.2) * (1 - radius / 240);
    const x = galaxyCenter.x + Math.cos(angle) * radius + randomSpread(4.2);
    const z = galaxyCenter.z + Math.sin(angle) * radius + randomSpread(4.2);
    const y = galaxyCenter.y + band + randomSpread(1.2);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const core = Math.max(0, 1 - radius / 170);
    const blue = Math.random() > 0.75 ? 0.32 : 0;
    color.setHSL(0.08 + blue, 0.42 + Math.random() * 0.3, 0.52 + core * 0.26);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.78,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createGalacticPlane() {
  const geometry = new THREE.RingGeometry(42, 178, 160, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x335c67,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.position.copy(galaxyCenter);
  plane.rotation.x = Math.PI / 2;
  return plane;
}

function createSun() {
  const group = new THREE.Group();
  const sunGeometry = new THREE.SphereGeometry(1.45, 48, 24);
  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd773,
    emissive: 0xffa124,
    emissiveIntensity: 3.2,
    roughness: 0.46,
  });
  const star = new THREE.Mesh(sunGeometry, sunMaterial);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd173,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(star, halo);
  return group;
}

function createSolarAxes() {
  const group = new THREE.Group();
  group.add(makeLine([new THREE.Vector3(-18, 0, 0), new THREE.Vector3(18, 0, 0)], 0x71dbd4, 0.9));
  group.add(makeLine([new THREE.Vector3(0, -18, 0), new THREE.Vector3(0, 18, 0)], 0xd2a03d, 0.7));
  group.add(makeLine([new THREE.Vector3(0, 0, -18), new THREE.Vector3(0, 0, 18)], 0xcd6b57, 0.7));
  return group;
}

function createOrbitRings() {
  const group = new THREE.Group();
  [5, 8, 12, 16].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.015, radius + 0.015, 120),
      new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0x6aaeb8 : 0xd4b45c,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  });
  return group;
}

function createEarth() {
  const material = new THREE.MeshStandardMaterial({
    map: earthTexture,
    normalMap: earthBump,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.65,
    metalness: 0.02,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 96, 48), material);
}

function createAtmosphere() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.035, 96, 48),
    new THREE.MeshBasicMaterial({
      color: 0x78c7ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createSpacetimeGrid() {
  const resolution = 58;
  const size = 26;
  const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe5cc79,
    transparent: true,
    opacity: 0.38,
    wireframe: true,
    depthWrite: false,
  });
  const grid = new THREE.Mesh(geometry, material);
  grid.position.y = -earthRadius * 0.52;
  grid.userData.original = geometry.attributes.position.array.slice(0);
  return grid;
}

function updateSpacetimeGrid() {
  const geometry = spacetimeGrid.geometry as THREE.PlaneGeometry;
  const positions = geometry.attributes.position;
  const original = spacetimeGrid.userData.original as Float32Array;
  const strength = state.curvatureStrength;

  for (let i = 0; i < positions.count; i += 1) {
    const x = original[i * 3];
    const y = original[i * 3 + 1];
    const z = original[i * 3 + 2];
    const r = Math.sqrt(x * x + z * z);
    const depression = -strength * 4.8 * Math.exp(-(r * r) / 48);
    const ripple = Math.sin(r * 1.25 - state.elapsed * 2.4) * 0.1 * strength * Math.exp(-r / 15);
    positions.setXYZ(i, x, y + depression + ripple, z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createApple() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(appleRadius, 32, 18),
    new THREE.MeshStandardMaterial({
      color: 0xc9392f,
      roughness: 0.48,
      metalness: 0.02,
    }),
  );
  body.scale.set(1, 0.94, 1);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a3f24, roughness: 0.8 }),
  );
  stem.position.y = 0.36;
  stem.rotation.z = 0.25;
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f9e5a, roughness: 0.56 }),
  );
  leaf.scale.set(1.5, 0.35, 0.8);
  leaf.position.set(0.16, 0.43, 0);
  leaf.rotation.z = -0.52;
  group.add(body, stem, leaf);
  return group;
}

function createArrow(color: number, length: number) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, length, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  );
  shaft.position.y = -length / 2;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.66, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  head.position.y = -length - 0.26;
  group.add(shaft, head);
  return group;
}

function createWorldline() {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 120; i += 1) {
    const p = i / 119;
    const h = appleStartHeight - 0.5 * 9.81 * Math.pow(p * fallDuration, 2);
    const normalizedHeight = Math.max(0, h / appleStartHeight);
    points.push(
      new THREE.Vector3(
        -1.9 + p * 1.1,
        earthRadius + appleRadius + normalizedHeight * appleVisualHeight,
        -1.2 + p * 2.2,
      ),
    );
  }
  return makeLine(points, 0xff705b, 1);
}

function updateWorldline() {
  const material = worldline.material as THREE.LineBasicMaterial;
  material.opacity = state.showWorldline ? 0.82 : 0;
}

function createLocalLab() {
  const group = new THREE.Group();
  const floorAssembly = new THREE.Group();
  const earthBlock = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 1.05, 5.2),
    new THREE.MeshStandardMaterial({
      color: 0x123a3d,
      roughness: 0.7,
      metalness: 0.04,
      transparent: true,
      opacity: 0.78,
    }),
  );
  earthBlock.position.y = -0.64;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 0.16, 5.2),
    new THREE.MeshStandardMaterial({
      color: 0x8ef0d2,
      roughness: 0.62,
      metalness: 0.04,
    }),
  );
  floor.position.y = 0;
  floorAssembly.position.set(5.2, -5.55, 0);
  floorAssembly.add(earthBlock, floor);

  const referenceFrame = new THREE.Group();
  for (const x of [1.2, 9.2]) {
    referenceFrame.add(makeLine([new THREE.Vector3(x, -5.8, -2.6), new THREE.Vector3(x, 3.0, -2.6)], 0x8be0d3, 0.58));
    referenceFrame.add(makeLine([new THREE.Vector3(x, -5.8, 2.6), new THREE.Vector3(x, 3.0, 2.6)], 0x8be0d3, 0.58));
  }
  for (const y of [-5.2, -3.4, -1.6, 0.2, 2.0]) {
    referenceFrame.add(makeLine([new THREE.Vector3(1.2, y, -2.6), new THREE.Vector3(9.2, y, -2.6)], 0x376f72, 0.42));
    referenceFrame.add(makeLine([new THREE.Vector3(1.2, y, 2.6), new THREE.Vector3(9.2, y, 2.6)], 0x376f72, 0.42));
  }

  const floorTrail = new THREE.Group();
  for (const y of [-5.55, -4.1, -2.25, -0.15, 1.35]) {
    const ghost = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.035, 5.2),
      new THREE.MeshBasicMaterial({
        color: 0x8ef0d2,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    ghost.position.set(5.2, y, 0);
    floorTrail.add(ghost);
  }

  const localAppleTrack = makeLine(
    [localApplePosition.clone(), new THREE.Vector3(localApplePosition.x, -5.6, localApplePosition.z)],
    0xffc15d,
    0.72,
  );
  localAppleTrack.name = 'localAppleTrack';
  const inertialRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.018, 12, 72),
    new THREE.MeshBasicMaterial({
      color: 0xffc15d,
      transparent: true,
      opacity: 0.82,
    }),
  );
  inertialRing.position.copy(localApplePosition);
  inertialRing.rotation.x = Math.PI / 2;

  group.userData.floorAssembly = floorAssembly;
  group.userData.referenceFrame = referenceFrame;
  group.userData.floorTrail = floorTrail;
  group.add(floorTrail, referenceFrame, localAppleTrack, inertialRing, floorAssembly);
  return group;
}

function updateLocalLab(fallT: number) {
  const floorAssembly = localLab.userData.floorAssembly as THREE.Group;
  const progress = Math.min(1, fallT / fallDuration);
  const easedProgress = progress * progress;
  const floorY = -5.55 + easedProgress * 6.9;
  floorAssembly.position.y = floorY;

  if (state.mode === 'freefall') {
    apple.position.copy(localApplePosition);
    surfaceArrow.position.set(3.35, floorY + 0.24, -1.9);
    surfaceArrow.rotation.set(Math.PI, 0, 0);
    surfaceArrow.visible = true;
    floorLabel.position.set(7.5, floorY + 1.35, 1.7);
  } else {
    surfaceArrow.visible = false;
  }
}

function makeLine(points: THREE.Vector3[], color: number, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
  return new THREE.Line(geometry, material);
}

function createLabel(text: string, color: number): LabelSprite {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 768;
  canvasEl.height = 160;
  const context = canvasEl.getContext('2d');
  if (!context) {
    throw new Error('Unable to create label canvas context');
  }
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material) as LabelSprite;
  sprite.userData = {
    baseScale: 5.6,
    canvas: canvasEl,
    context,
    texture,
    text,
  };
  drawLabel(sprite, text, color);
  sprite.scale.set(8.8, 1.8, 1);
  return sprite;
}

function drawLabel(sprite: LabelSprite, text: string, color: number) {
  const { canvas: canvasEl, context, texture } = sprite.userData;
  context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  context.fillStyle = 'rgba(3, 5, 8, 0.58)';
  roundRect(context, 14, 18, canvasEl.width - 28, canvasEl.height - 36, 24);
  context.fill();
  context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 4;
  roundRect(context, 14, 18, canvasEl.width - 28, canvasEl.height - 36, 24);
  context.stroke();
  context.fillStyle = '#f6f1e3';
  context.font = '500 42px Inter, system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.fillText(text, 46, canvasEl.height / 2);
  texture.needsUpdate = true;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function randomSpread(amount: number) {
  return (Math.random() - 0.5) * amount;
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
