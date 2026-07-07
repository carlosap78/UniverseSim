import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createIcons, Home, Pause, Play, RotateCcw } from 'lucide';

type ViewMode = 'fall' | 'separation' | 'formula';
type BodyKind = 'apple' | 'top' | 'bottom' | 'left' | 'right';

type BodyConfig = {
  id: string;
  name: string;
  shortName: string;
  kind: BodyKind;
  color: number;
  initialOffset: THREE.Vector3;
};

type Body = {
  config: BodyConfig;
  mesh: THREE.Group;
  label: THREE.Sprite;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  velocityArrow: THREE.ArrowHelper;
  separationArrow: THREE.ArrowHelper;
  deltaAccelerationArrow: THREE.ArrowHelper;
  trail: THREE.Line;
  trailPoints: THREE.Vector3[];
  initialSeparation: number;
};

type CurvaturePlane = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    base: Float32Array;
  };
};

const canvas = document.querySelector<HTMLCanvasElement>('#universe-canvas');
if (!canvas) throw new Error('Canvas #universe-canvas not found');

const centralRadius = 3.2;
const baseMu = 38;
const maxTrailPoints = 260;
const clusterStart = new THREE.Vector3(0, 12.2, 0);
const separationDistance = 1.35;
const visualC = 38;

const bodyConfigs: BodyConfig[] = [
  {
    id: 'apple',
    name: 'Manzana de referencia',
    shortName: 'manzana',
    kind: 'apple',
    color: 0xff5548,
    initialOffset: new THREE.Vector3(0, 0, 0),
  },
  {
    id: 'top',
    name: 'Objeto arriba de la manzana',
    shortName: 'arriba',
    kind: 'top',
    color: 0xffd166,
    initialOffset: new THREE.Vector3(0, separationDistance, 0),
  },
  {
    id: 'bottom',
    name: 'Objeto abajo de la manzana',
    shortName: 'abajo',
    kind: 'bottom',
    color: 0x4cc9f0,
    initialOffset: new THREE.Vector3(0, -separationDistance, 0),
  },
  {
    id: 'left',
    name: 'Objeto izquierda de la manzana',
    shortName: 'izquierda',
    kind: 'left',
    color: 0xb388ff,
    initialOffset: new THREE.Vector3(-separationDistance, 0, 0),
  },
  {
    id: 'right',
    name: 'Objeto derecha de la manzana',
    shortName: 'derecha',
    kind: 'right',
    color: 0x7bd88f,
    initialOffset: new THREE.Vector3(separationDistance, 0, 0),
  },
];

const state = {
  view: 'fall' as ViewMode,
  paused: false,
  simTime: 0,
  lastFrame: performance.now(),
  commonFallSpeed: 0.6,
  massScale: 1,
  curvatureStrength: 1,
  timeScale: 1,
  selectedId: 'top',
  showVelocity: true,
  showDeltaAcceleration: true,
  showSeparation: true,
  showField: true,
  showTrails: true,
};

const copyByView: Record<ViewMode, { title: string; copy: string }> = {
  fall: {
    title: 'Objetos alrededor de una manzana',
    copy:
      'La manzana y sus vecinos empiezan juntos en caída libre. Los objetos arriba, abajo, izquierda y derecha no caen igual porque el campo cambia con la posición.',
  },
  separation: {
    title: 'Separación vista desde la manzana',
    copy:
      'La cámara sigue a la manzana. El vecino de abajo se aleja hacia la masa, el de arriba se queda atrás y los laterales tienden a comprimirse hacia el eje radial.',
  },
  formula: {
    title: 'Desviación geodésica interactiva',
    copy:
      'La diferencia entre aceleraciones explica la separación: Δa = a_vecino - a_manzana. En campo débil se aproxima por el tensor tidal T aplicado a ξ.',
  },
};

const elements = {
  playToggle: must<HTMLButtonElement>('#play-toggle'),
  resetSim: must<HTMLButtonElement>('#reset-sim'),
  cameraHome: must<HTMLButtonElement>('#camera-home'),
  objectSelect: must<HTMLSelectElement>('#object-select'),
  fallSpeed: must<HTMLInputElement>('#launch-speed'),
  fallSpeedValue: must<HTMLOutputElement>('#launch-speed-value'),
  massScale: must<HTMLInputElement>('#mass-scale'),
  massScaleValue: must<HTMLOutputElement>('#mass-scale-value'),
  curvatureStrength: must<HTMLInputElement>('#curvature-strength'),
  curvatureValue: must<HTMLOutputElement>('#curvature-value'),
  timeScale: must<HTMLInputElement>('#time-scale'),
  timeScaleValue: must<HTMLOutputElement>('#time-scale-value'),
  showVelocity: must<HTMLInputElement>('#show-velocity'),
  showDeltaAcceleration: must<HTMLInputElement>('#show-acceleration'),
  showSeparation: must<HTMLInputElement>('#show-position'),
  showField: must<HTMLInputElement>('#show-field'),
  showTrails: must<HTMLInputElement>('#show-trails'),
  timeReadout: must<HTMLElement>('#time-readout'),
  objectReadout: must<HTMLElement>('#object-readout'),
  gravityReadout: must<HTMLElement>('#gravity-readout'),
  modeTitle: must<HTMLElement>('#mode-title'),
  modeCopy: must<HTMLElement>('#mode-copy'),
  metricOneLabel: must<HTMLElement>('#metric-one-label'),
  metricOneValue: must<HTMLElement>('#metric-one-value'),
  metricTwoLabel: must<HTMLElement>('#metric-two-label'),
  metricTwoValue: must<HTMLElement>('#metric-two-value'),
  metricThreeLabel: must<HTMLElement>('#metric-three-label'),
  metricThreeValue: must<HTMLElement>('#metric-three-value'),
  formulaAccel: must<HTMLElement>('#formula-accel'),
  formulaPotential: must<HTMLElement>('#formula-potential'),
  formulaMetric: must<HTMLElement>('#formula-metric'),
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
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);
scene.fog = new THREE.FogExp2(0x020308, 0.012);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.02, 900);
camera.position.set(16, 14, 24);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 80;
controls.target.set(0, 5.5, 0);

const root = new THREE.Group();
const planeGroup = new THREE.Group();
const fieldGroup = new THREE.Group();
const bodyGroup = new THREE.Group();
const labelGroup = new THREE.Group();
const separationGroup = new THREE.Group();
scene.add(root);
root.add(planeGroup, fieldGroup, bodyGroup, labelGroup, separationGroup);

scene.add(new THREE.AmbientLight(0x66707f, 1.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(10, 16, 12);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x88d9ff, 90, 90, 1.4);
rimLight.position.set(-8, 8, -12);
scene.add(rimLight);

const starField = createStarField();
const axes = createAxes();
const centralMass = createCentralMass();
const startFrame = createStartFrame();
const curvaturePlane = createCurvaturePlane();
const fieldArrows = createFieldArrows();
const bodies = bodyConfigs.map(createBody);
const connectorLines = new Map<string, THREE.Line>();

root.add(starField, axes, centralMass, startFrame);
planeGroup.add(curvaturePlane);
fieldGroup.add(...fieldArrows);
bodyGroup.add(...bodies.flatMap((body) => [
  body.mesh,
  body.velocityArrow,
  body.separationArrow,
  body.deltaAccelerationArrow,
  body.trail,
]));
labelGroup.add(...bodies.map((body) => body.label));
for (const body of bodies) {
  if (body.config.id === 'apple') continue;
  const line = makeLine([new THREE.Vector3(), new THREE.Vector3()], body.config.color, 0.82);
  connectorLines.set(body.config.id, line);
  separationGroup.add(line);
}

mountControls();
resetSimulation();
setView('fall');
requestAnimationFrame(animate);

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function mountControls() {
  elements.playToggle.innerHTML = '<i data-lucide="pause"></i>';
  elements.resetSim.innerHTML = '<i data-lucide="rotate-ccw"></i>';
  elements.cameraHome.innerHTML = '<i data-lucide="home"></i>';
  createIcons({ icons: { Home, Pause, Play, RotateCcw } });

  elements.objectSelect.innerHTML = bodyConfigs
    .filter((config) => config.id !== 'apple')
    .map((config) => `<option value="${config.id}">${config.name}</option>`)
    .join('');
  elements.objectSelect.value = state.selectedId;

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view as ViewMode));
  });

  elements.playToggle.addEventListener('click', () => {
    state.paused = !state.paused;
    elements.playToggle.innerHTML = state.paused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
    elements.playToggle.setAttribute('aria-label', state.paused ? 'Reproducir simulación' : 'Pausar simulación');
    elements.playToggle.setAttribute('title', state.paused ? 'Reproducir simulación' : 'Pausar simulación');
    createIcons({ icons: { Pause, Play } });
  });

  elements.resetSim.addEventListener('click', resetSimulation);
  elements.cameraHome.addEventListener('click', () => setView(state.view));
  elements.objectSelect.addEventListener('change', () => {
    state.selectedId = elements.objectSelect.value;
    updateHud();
  });

  elements.fallSpeed.addEventListener('input', () => {
    state.commonFallSpeed = Number(elements.fallSpeed.value);
    elements.fallSpeedValue.value = state.commonFallSpeed.toFixed(1);
    resetSimulation();
  });
  elements.massScale.addEventListener('input', () => {
    state.massScale = Number(elements.massScale.value);
    elements.massScaleValue.value = `${state.massScale.toFixed(2)}x`;
    updateCurvature();
    updateFieldArrows();
  });
  elements.curvatureStrength.addEventListener('input', () => {
    state.curvatureStrength = Number(elements.curvatureStrength.value);
    elements.curvatureValue.value = `${state.curvatureStrength.toFixed(2)}x`;
    updateCurvature();
  });
  elements.timeScale.addEventListener('input', () => {
    state.timeScale = Number(elements.timeScale.value);
    elements.timeScaleValue.value = `${state.timeScale.toFixed(2)}x`;
  });

  elements.showVelocity.addEventListener('change', () => {
    state.showVelocity = elements.showVelocity.checked;
  });
  elements.showDeltaAcceleration.addEventListener('change', () => {
    state.showDeltaAcceleration = elements.showDeltaAcceleration.checked;
  });
  elements.showSeparation.addEventListener('change', () => {
    state.showSeparation = elements.showSeparation.checked;
  });
  elements.showField.addEventListener('change', () => {
    state.showField = elements.showField.checked;
  });
  elements.showTrails.addEventListener('change', () => {
    state.showTrails = elements.showTrails.checked;
  });

  window.addEventListener('resize', onResize);
}

function setView(view: ViewMode) {
  state.view = view;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });

  elements.modeTitle.textContent = copyByView[view].title;
  elements.modeCopy.textContent = copyByView[view].copy;

  if (view === 'fall') {
    camera.position.set(16, 14, 24);
    controls.target.set(0, 5.4, 0);
  } else if (view === 'separation') {
    const apple = getApple();
    camera.position.copy(apple.position).add(new THREE.Vector3(7.2, 4.6, 8.8));
    controls.target.copy(apple.position);
  } else {
    const selected = getSelectedBody();
    camera.position.copy(getApple().position).add(new THREE.Vector3(8.2, 5.4, 10.2));
    controls.target.copy(selected.position);
  }
  controls.update();
}

function resetSimulation() {
  state.simTime = 0;
  const commonVelocity = new THREE.Vector3(0, -state.commonFallSpeed, 0);
  for (const body of bodies) {
    body.position.copy(clusterStart).add(body.config.initialOffset);
    body.velocity.copy(commonVelocity);
    body.acceleration.copy(gravityAt(body.position));
    body.initialSeparation = body.config.initialOffset.length();
    body.trailPoints = [body.position.clone()];
    body.mesh.position.copy(body.position);
    updateTrail(body);
  }
  updateCurvature();
  updateFieldArrows();
  updateHud();
}

function animate(now: number) {
  const rawDt = Math.min((now - state.lastFrame) / 1000, 0.05);
  state.lastFrame = now;

  if (!state.paused) {
    advanceSimulation(rawDt * state.timeScale);
  }

  updateScene();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function advanceSimulation(dt: number) {
  state.simTime += dt;
  const iterations = Math.max(1, Math.ceil(dt / 0.012));
  const subDt = dt / iterations;

  for (let i = 0; i < iterations; i += 1) {
    for (const body of bodies) {
      body.acceleration.copy(gravityAt(body.position));
      body.velocity.addScaledVector(body.acceleration, subDt);
      body.position.addScaledVector(body.velocity, subDt);
      if (body.position.length() < centralRadius + 0.22) {
        body.position.normalize().multiplyScalar(centralRadius + 0.22);
        body.velocity.set(0, 0, 0);
      }
    }
  }

  for (const body of bodies) {
    body.trailPoints.push(body.position.clone());
    if (body.trailPoints.length > maxTrailPoints) body.trailPoints.shift();
  }

  if (state.simTime > 10.5 || getApple().position.length() < centralRadius + 0.35) {
    resetSimulation();
  }
}

function updateScene() {
  centralMass.rotation.y += 0.003 * state.timeScale;
  startFrame.rotation.z += 0.006 * state.timeScale;

  for (const body of bodies) {
    body.mesh.position.copy(body.position);
    body.mesh.rotation.x += 0.012;
    body.mesh.rotation.y += 0.018;
    body.acceleration.copy(gravityAt(body.position));
    updateBodyVectors(body);
    updateTrail(body);
    updateLabel(body);
  }

  updateConnectors();
  updateHud();
  updateVisibility();

  if (state.view === 'separation') {
    const apple = getApple();
    controls.target.lerp(apple.position, 0.12);
  } else if (state.view === 'formula') {
    controls.target.lerp(getSelectedBody().position, 0.08);
  }
}

function updateBodyVectors(body: Body) {
  const apple = getApple();
  const selected = body.config.id === state.selectedId;
  const isApple = body.config.id === 'apple';
  const separation = body.position.clone().sub(apple.position);
  const deltaAcceleration = body.acceleration.clone().sub(apple.acceleration);

  setArrow(body.velocityArrow, body.position, body.velocity, 0.68, selected || isApple ? 1.0 : 0.74);
  setArrow(body.separationArrow, apple.position, separation, 1.1, selected ? 1.18 : 0.82);
  setArrow(body.deltaAccelerationArrow, body.position, deltaAcceleration, 28, selected ? 1.22 : 0.86);
}

function updateConnectors() {
  const apple = getApple();
  for (const body of bodies) {
    const line = connectorLines.get(body.config.id);
    if (!line) continue;
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints([apple.position, body.position]);
  }
}

function updateVisibility() {
  fieldGroup.visible = state.showField;
  planeGroup.visible = state.showField;

  for (const body of bodies) {
    const isApple = body.config.id === 'apple';
    const selected = body.config.id === state.selectedId;
    body.velocityArrow.visible = state.showVelocity && (state.view !== 'formula' || selected || isApple);
    body.separationArrow.visible = state.showSeparation && !isApple && (state.view !== 'formula' || selected);
    body.deltaAccelerationArrow.visible = state.showDeltaAcceleration && !isApple && (state.view !== 'formula' || selected);
    body.trail.visible = state.showTrails;
    body.label.visible = state.view !== 'formula' || selected || isApple;
  }

  for (const [id, line] of connectorLines) {
    line.visible = state.showSeparation && (state.view !== 'formula' || id === state.selectedId);
  }
}

function updateHud() {
  const apple = getApple();
  const selected = getSelectedBody();
  const separation = selected.position.clone().sub(apple.position);
  const deltaAcceleration = selected.acceleration.clone().sub(apple.acceleration);
  const initial = Math.max(selected.initialSeparation, 0.0001);
  const separationChange = separation.length() - initial;
  const phi = potentialAt(apple.position);
  const phiOverC2 = phi / (visualC * visualC);

  elements.timeReadout.textContent = `t = ${state.simTime.toFixed(1)} s`;
  elements.objectReadout.textContent = `vecino: ${selected.config.shortName}`;
  elements.gravityReadout.textContent = `separación = ${separation.length().toFixed(2)}`;

  elements.metricOneLabel.textContent = '|ξ| actual';
  elements.metricOneValue.textContent = `${separation.length().toFixed(3)} u`;
  elements.metricTwoLabel.textContent = 'cambio relativo';
  elements.metricTwoValue.textContent = `${separationChange >= 0 ? '+' : ''}${separationChange.toFixed(3)} u`;
  elements.metricThreeLabel.textContent = '|Δa|';
  elements.metricThreeValue.textContent = `${deltaAcceleration.length().toFixed(4)} u/s²`;

  elements.formulaAccel.textContent =
    `Δa = (${deltaAcceleration.x.toFixed(4)}, ${deltaAcceleration.y.toFixed(4)}, ${deltaAcceleration.z.toFixed(4)})`;
  elements.formulaPotential.textContent = `|ξ| = ${separation.length().toFixed(4)}; ξ = (${separation.x.toFixed(2)}, ${separation.y.toFixed(2)}, ${separation.z.toFixed(2)})`;
  elements.formulaMetric.textContent =
    `Phi/c²=${phiOverC2.toFixed(4)}; radial≈+2μξ/r³, lateral≈-μξ/r³`;
}

function updateCurvature() {
  const positions = curvaturePlane.geometry.attributes.position;
  const base = curvaturePlane.userData.base;
  const strength = state.curvatureStrength * state.massScale;
  for (let i = 0; i < positions.count; i += 1) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const z = base[i * 3 + 2];
    const radius = Math.max(1.4, Math.sqrt(x * x + z * z));
    const depression = -3.3 * strength * Math.exp(-(radius * radius) / 58);
    positions.setXYZ(i, x, y + depression, z);
  }
  positions.needsUpdate = true;
  curvaturePlane.geometry.computeVertexNormals();
}

function updateFieldArrows() {
  for (const arrow of fieldArrows) {
    const base = arrow.userData.base as THREE.Vector3;
    const acceleration = gravityAt(base);
    acceleration.y = 0;
    setArrow(arrow, base, acceleration, 5.6, 0.76);
  }
}

function getApple() {
  return bodies[0];
}

function getSelectedBody() {
  return bodies.find((body) => body.config.id === state.selectedId) ?? bodies[1];
}

function gravityAt(position: THREE.Vector3) {
  const distanceSq = Math.max(position.lengthSq(), 1.05);
  const distance = Math.sqrt(distanceSq);
  return position.clone().multiplyScalar(-mu() / (distanceSq * distance));
}

function potentialAt(position: THREE.Vector3) {
  return -mu() / Math.max(position.length(), 1.05);
}

function mu() {
  return baseMu * state.massScale;
}

function setArrow(
  arrow: THREE.ArrowHelper,
  origin: THREE.Vector3,
  vector: THREE.Vector3,
  visualScale: number,
  emphasis = 1,
) {
  const length = vector.length() * visualScale * emphasis;
  arrow.position.copy(origin);
  if (length < 0.001) {
    arrow.setLength(0.001, 0.001, 0.001);
    return;
  }
  arrow.setDirection(vector.clone().normalize());
  arrow.setLength(Math.min(length, 6.6), Math.min(0.58, Math.max(0.16, length * 0.16)), 0.18 * emphasis);
}

function createBody(config: BodyConfig): Body {
  const mesh = createBodyMesh(config);
  const label = createLabel(config.name, config.color);
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([clusterStart]),
    new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: 0.78 }),
  );

  return {
    config,
    mesh,
    label,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    velocityArrow: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0xffd166, 0.35, 0.16),
    separationArrow: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x5bc0eb, 0.35, 0.14),
    deltaAccelerationArrow: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0xff5a5f, 0.35, 0.16),
    trail,
    trailPoints: [],
    initialSeparation: config.initialOffset.length(),
  };
}

function createBodyMesh(config: BodyConfig) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.5,
    metalness: 0.08,
    emissive: config.color,
    emissiveIntensity: 0.08,
  });

  if (config.kind === 'apple') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 18), material);
    body.scale.set(1, 0.95, 1);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x6e4020, roughness: 0.72 }),
    );
    stem.position.y = 0.35;
    stem.rotation.z = 0.25;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 8),
      new THREE.MeshStandardMaterial({ color: 0x51b36a, roughness: 0.56 }),
    );
    leaf.scale.set(1.55, 0.32, 0.85);
    leaf.position.set(0.16, 0.42, 0);
    group.add(body, stem, leaf);
  } else if (config.kind === 'top') {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 14), material));
  } else if (config.kind === 'bottom') {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), material));
  } else if (config.kind === 'left') {
    group.add(new THREE.Mesh(new THREE.TetrahedronGeometry(0.36), material));
  } else {
    group.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.56, 24), material));
  }

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(config.kind === 'apple' ? 0.68 : 0.48, 24, 12),
    new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.kind === 'apple' ? 0.18 : 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(halo);
  return group;
}

function createCentralMass() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(centralRadius, 72, 36),
    new THREE.MeshStandardMaterial({
      color: 0x1f5e7a,
      roughness: 0.58,
      metalness: 0.05,
      emissive: 0x082338,
      emissiveIntensity: 0.45,
    }),
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(centralRadius * 1.035, 72, 36),
    new THREE.MeshBasicMaterial({
      color: 0x68c7ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(core, atmosphere);
  return group;
}

function createStartFrame() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(separationDistance, 0.018, 12, 90),
    new THREE.MeshBasicMaterial({ color: 0xf5f0df, transparent: true, opacity: 0.64 }),
  );
  ring.position.copy(clusterStart);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.add(makeLine([clusterStart.clone().add(new THREE.Vector3(-2, 0, 0)), clusterStart.clone().add(new THREE.Vector3(2, 0, 0))], 0x5bc0eb, 0.55));
  group.add(makeLine([clusterStart.clone().add(new THREE.Vector3(0, -2, 0)), clusterStart.clone().add(new THREE.Vector3(0, 2, 0))], 0xffd166, 0.55));
  return group;
}

function createCurvaturePlane(): CurvaturePlane {
  const geometry = new THREE.PlaneGeometry(24, 24, 58, 58);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xc9b458,
    transparent: true,
    opacity: 0.28,
    wireframe: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(geometry, material) as CurvaturePlane;
  plane.userData.base = geometry.attributes.position.array.slice(0) as Float32Array;
  return plane;
}

function createFieldArrows() {
  const arrows: THREE.ArrowHelper[] = [];
  for (const x of [-9, -6, -3, 3, 6, 9]) {
    for (const z of [-9, -6, -3, 3, 6, 9]) {
      const position = new THREE.Vector3(x, 0, z);
      if (position.length() < centralRadius + 0.6) continue;
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), position, 0.8, 0xf4d35e, 0.25, 0.1);
      arrow.userData.base = position.clone();
      arrows.push(arrow);
    }
  }
  return arrows;
}

function createAxes() {
  const group = new THREE.Group();
  group.add(makeLine([new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)], 0x5bc0eb, 0.8));
  group.add(makeLine([new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 14, 0)], 0xffd166, 0.8));
  group.add(makeLine([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, 12)], 0xb388ff, 0.62));
  group.add(createStaticLabel('eje lateral X', new THREE.Vector3(12.4, 0, 0), 0x5bc0eb));
  group.add(createStaticLabel('eje radial Y', new THREE.Vector3(0, 14.4, 0), 0xffd166));
  return group;
}

function createStarField() {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const radius = 70 + Math.random() * 180;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    color.setHSL(0.55 + Math.random() * 0.12, 0.24, 0.58 + Math.random() * 0.26);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    }),
  );
}

function updateTrail(body: Body) {
  body.trail.geometry.dispose();
  body.trail.geometry = new THREE.BufferGeometry().setFromPoints(body.trailPoints);
}

function updateLabel(body: Body) {
  body.label.position.copy(body.position).add(new THREE.Vector3(0.35, 0.48, 0.18));
  body.label.scale.set(body.config.id === 'apple' ? 5.4 : 4.5, body.config.id === 'apple' ? 1.1 : 0.94, 1);
}

function createStaticLabel(text: string, position: THREE.Vector3, color: number) {
  const label = createLabel(text, color);
  label.position.copy(position);
  label.scale.set(4.8, 1.0, 1);
  return label;
}

function createLabel(text: string, color: number) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 760;
  labelCanvas.height = 150;
  const context = labelCanvas.getContext('2d');
  if (!context) throw new Error('Unable to create label context');
  context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = 'rgba(3, 7, 12, 0.58)';
  roundRect(context, 14, 18, labelCanvas.width - 28, labelCanvas.height - 36, 22);
  context.fill();
  context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 4;
  roundRect(context, 14, 18, labelCanvas.width - 28, labelCanvas.height - 36, 22);
  context.stroke();
  context.fillStyle = '#fff7df';
  context.font = '600 39px Inter, system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.fillText(text, 46, labelCanvas.height / 2);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(5.2, 1.1, 1);
  return sprite;
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

function makeLine(points: THREE.Vector3[], color: number, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
