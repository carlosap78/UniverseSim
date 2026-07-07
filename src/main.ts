import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createIcons, Home, Pause, Play, RotateCcw } from 'lucide';

type ViewMode = 'lab' | 'planes' | 'formula';
type ProjectileKind = 'apple' | 'sphere' | 'cube' | 'cone' | 'front' | 'back';
type PlaneKind = 'xz' | 'xy' | 'yz';

type ProjectileConfig = {
  id: string;
  name: string;
  shortName: string;
  kind: ProjectileKind;
  color: number;
  direction: THREE.Vector3;
  offset: THREE.Vector3;
};

type Projectile = {
  config: ProjectileConfig;
  mesh: THREE.Group;
  label: THREE.Sprite;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  velocityArrow: THREE.ArrowHelper;
  accelerationArrow: THREE.ArrowHelper;
  positionArrow: THREE.ArrowHelper;
  trail: THREE.Line;
  trailPoints: THREE.Vector3[];
  impacted: boolean;
};

type CurvaturePlane = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    base: Float32Array;
    kind: PlaneKind;
  };
};

const canvas = document.querySelector<HTMLCanvasElement>('#universe-canvas');
if (!canvas) {
  throw new Error('Canvas #universe-canvas not found');
}

const centralRadius = 3.15;
const baseMu = 24;
const visualC = 34;
const maxTrailPoints = 210;
const launchOrigin = new THREE.Vector3(0, 6.9, 0);

const projectileConfigs: ProjectileConfig[] = [
  {
    id: 'apple-up',
    name: 'Manzana arriba',
    shortName: 'arriba',
    kind: 'apple',
    color: 0xff5548,
    direction: new THREE.Vector3(0, 1, 0),
    offset: new THREE.Vector3(-0.42, 0, 0),
  },
  {
    id: 'sphere-down',
    name: 'Esfera abajo',
    shortName: 'abajo',
    kind: 'sphere',
    color: 0x4cc9f0,
    direction: new THREE.Vector3(0, -1, 0),
    offset: new THREE.Vector3(0.42, 0, 0),
  },
  {
    id: 'cube-left',
    name: 'Cubo izquierda',
    shortName: 'izquierda',
    kind: 'cube',
    color: 0xffc857,
    direction: new THREE.Vector3(-1, 0, 0),
    offset: new THREE.Vector3(0, 0, -0.42),
  },
  {
    id: 'cone-right',
    name: 'Cono derecha',
    shortName: 'derecha',
    kind: 'cone',
    color: 0x7bd88f,
    direction: new THREE.Vector3(1, 0, 0),
    offset: new THREE.Vector3(0, 0, 0.42),
  },
  {
    id: 'front-z',
    name: 'Capsula plano Z+',
    shortName: 'plano Z+',
    kind: 'front',
    color: 0xb388ff,
    direction: new THREE.Vector3(0, 0, 1),
    offset: new THREE.Vector3(-0.28, 0, 0.72),
  },
  {
    id: 'back-z',
    name: 'Prisma plano Z-',
    shortName: 'plano Z-',
    kind: 'back',
    color: 0x5ea1ff,
    direction: new THREE.Vector3(0, 0, -1),
    offset: new THREE.Vector3(0.28, 0, -0.72),
  },
];

const state = {
  view: 'lab' as ViewMode,
  paused: false,
  simTime: 0,
  lastFrame: performance.now(),
  massScale: 1,
  launchSpeed: 3.2,
  curvatureStrength: 1,
  timeScale: 1,
  selectedId: 'apple-up',
  showVelocity: true,
  showAcceleration: true,
  showPosition: true,
  showField: true,
  showTrails: true,
};

const copyByView: Record<ViewMode, { title: string; copy: string }> = {
  lab: {
    title: 'Vectores de cada lanzamiento',
    copy:
      'Todos los objetos salen desde la misma region con velocidades iniciales distintas. La flecha amarilla es v, la roja es a hacia la masa y la azul es r desde el centro.',
  },
  planes: {
    title: 'Vectores proyectados en otros planos',
    copy:
      'Las mallas XZ, XY e YZ muestran la misma curvatura desde cortes diferentes. Las flechas pequeñas son el campo gravitatorio proyectado sobre cada plano.',
  },
  formula: {
    title: 'Formula y geometria conectadas',
    copy:
      'La simulacion usa la aproximacion de campo debil: a = -mu r/|r|^3 y una metrica visual con Phi/c². Cambia masa, velocidad y curvatura para ver como cambian los numeros.',
  },
};

const elements = {
  playToggle: must<HTMLButtonElement>('#play-toggle'),
  resetSim: must<HTMLButtonElement>('#reset-sim'),
  cameraHome: must<HTMLButtonElement>('#camera-home'),
  objectSelect: must<HTMLSelectElement>('#object-select'),
  launchSpeed: must<HTMLInputElement>('#launch-speed'),
  launchSpeedValue: must<HTMLOutputElement>('#launch-speed-value'),
  massScale: must<HTMLInputElement>('#mass-scale'),
  massScaleValue: must<HTMLOutputElement>('#mass-scale-value'),
  curvatureStrength: must<HTMLInputElement>('#curvature-strength'),
  curvatureValue: must<HTMLOutputElement>('#curvature-value'),
  timeScale: must<HTMLInputElement>('#time-scale'),
  timeScaleValue: must<HTMLOutputElement>('#time-scale-value'),
  showVelocity: must<HTMLInputElement>('#show-velocity'),
  showAcceleration: must<HTMLInputElement>('#show-acceleration'),
  showPosition: must<HTMLInputElement>('#show-position'),
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
camera.position.set(18, 13, 24);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 80;
controls.target.set(0, 2, 0);

const root = new THREE.Group();
const planeGroup = new THREE.Group();
const fieldGroup = new THREE.Group();
const projectileGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(root);
root.add(planeGroup, fieldGroup, projectileGroup, labelGroup);

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
const launchRing = createLaunchRing();
const curvaturePlanes = [
  createCurvaturePlane('xz', 0xc9b458, 0.28),
  createCurvaturePlane('xy', 0x62c9d8, 0.18),
  createCurvaturePlane('yz', 0x9f86ff, 0.18),
];
const fieldArrows = createFieldArrows();
const projectiles = projectileConfigs.map(createProjectile);

root.add(starField, axes, centralMass, launchRing);
planeGroup.add(...curvaturePlanes);
fieldGroup.add(...fieldArrows);
projectileGroup.add(...projectiles.flatMap((projectile) => [
  projectile.mesh,
  projectile.velocityArrow,
  projectile.accelerationArrow,
  projectile.positionArrow,
  projectile.trail,
]));
labelGroup.add(...projectiles.map((projectile) => projectile.label));
labelGroup.add(createStaticLabel('plano XZ', new THREE.Vector3(9.4, -1.9, 9.2), 0xc9b458));
labelGroup.add(createStaticLabel('plano XY', new THREE.Vector3(9.6, 8.8, 0.4), 0x62c9d8));
labelGroup.add(createStaticLabel('plano YZ', new THREE.Vector3(0.4, 8.6, 9.4), 0x9f86ff));

mountControls();
resetSimulation();
setView('lab');
requestAnimationFrame(animate);

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element ${selector}`);
  }
  return element;
}

function mountControls() {
  elements.playToggle.innerHTML = '<i data-lucide="pause"></i>';
  elements.resetSim.innerHTML = '<i data-lucide="rotate-ccw"></i>';
  elements.cameraHome.innerHTML = '<i data-lucide="home"></i>';
  createIcons({ icons: { Home, Pause, Play, RotateCcw } });

  elements.objectSelect.innerHTML = projectileConfigs
    .map((config) => `<option value="${config.id}">${config.name}</option>`)
    .join('');
  elements.objectSelect.value = state.selectedId;

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view as ViewMode));
  });

  elements.playToggle.addEventListener('click', () => {
    state.paused = !state.paused;
    elements.playToggle.innerHTML = state.paused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
    elements.playToggle.setAttribute('aria-label', state.paused ? 'Reproducir simulacion' : 'Pausar simulacion');
    elements.playToggle.setAttribute('title', state.paused ? 'Reproducir simulacion' : 'Pausar simulacion');
    createIcons({ icons: { Pause, Play } });
  });

  elements.resetSim.addEventListener('click', resetSimulation);
  elements.cameraHome.addEventListener('click', () => setView(state.view));

  elements.objectSelect.addEventListener('change', () => {
    state.selectedId = elements.objectSelect.value;
    updateHud();
  });

  elements.launchSpeed.addEventListener('input', () => {
    state.launchSpeed = Number(elements.launchSpeed.value);
    elements.launchSpeedValue.value = state.launchSpeed.toFixed(1);
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
  elements.showAcceleration.addEventListener('change', () => {
    state.showAcceleration = elements.showAcceleration.checked;
  });
  elements.showPosition.addEventListener('change', () => {
    state.showPosition = elements.showPosition.checked;
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

  if (view === 'lab') {
    camera.position.set(18, 13, 24);
    controls.target.set(0, 2.1, 0);
  } else if (view === 'planes') {
    camera.position.set(22, 20, 28);
    controls.target.set(0, 1.4, 0);
  } else {
    camera.position.set(12, 8.5, 16);
    controls.target.copy(getSelectedProjectile().position);
  }
  controls.update();
}

function resetSimulation() {
  state.simTime = 0;
  for (const projectile of projectiles) {
    projectile.position.copy(launchOrigin).add(projectile.config.offset);
    projectile.velocity.copy(projectile.config.direction).normalize().multiplyScalar(state.launchSpeed);
    projectile.acceleration.copy(gravityAt(projectile.position));
    projectile.impacted = false;
    projectile.trailPoints = [projectile.position.clone()];
    projectile.mesh.position.copy(projectile.position);
    updateTrail(projectile);
  }
  updateCurvature();
  updateFieldArrows();
  updateHud();
}

function animate(now: number) {
  const rawDt = Math.min((now - state.lastFrame) / 1000, 0.05);
  state.lastFrame = now;

  if (!state.paused) {
    const dt = rawDt * state.timeScale;
    advanceSimulation(dt);
  }

  updateScene();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function advanceSimulation(dt: number) {
  state.simTime += dt;
  const step = Math.min(dt / 3, 0.016);
  const iterations = Math.max(1, Math.ceil(dt / step));
  const subDt = dt / iterations;

  for (let i = 0; i < iterations; i += 1) {
    for (const projectile of projectiles) {
      if (projectile.impacted) continue;
      projectile.acceleration.copy(gravityAt(projectile.position));
      projectile.velocity.addScaledVector(projectile.acceleration, subDt);
      projectile.position.addScaledVector(projectile.velocity, subDt);

      const distance = projectile.position.length();
      if (distance < centralRadius + 0.24) {
        projectile.position.normalize().multiplyScalar(centralRadius + 0.24);
        projectile.velocity.set(0, 0, 0);
        projectile.acceleration.copy(gravityAt(projectile.position));
        projectile.impacted = true;
      }
    }
  }

  for (const projectile of projectiles) {
    projectile.trailPoints.push(projectile.position.clone());
    if (projectile.trailPoints.length > maxTrailPoints) {
      projectile.trailPoints.shift();
    }
  }

  const allFinished = projectiles.every((projectile) => projectile.impacted || projectile.position.length() > 24);
  if (state.simTime > 11.5 || allFinished) {
    resetSimulation();
  }
}

function updateScene() {
  centralMass.rotation.y += 0.003 * state.timeScale;
  launchRing.rotation.z += 0.008 * state.timeScale;

  for (const projectile of projectiles) {
    projectile.mesh.position.copy(projectile.position);
    projectile.mesh.rotation.x += 0.015 + projectile.velocity.length() * 0.002;
    projectile.mesh.rotation.y += 0.02;
    projectile.acceleration.copy(gravityAt(projectile.position));
    updateProjectileVectors(projectile);
    updateTrail(projectile);
    updateLabel(projectile);
  }

  updateHud();
  updateLayerVisibility();
}

function updateProjectileVectors(projectile: Projectile) {
  const selected = projectile.config.id === state.selectedId;
  setArrow(projectile.velocityArrow, projectile.position, projectile.velocity, 0.62, selected ? 1.18 : 0.82);
  setArrow(projectile.accelerationArrow, projectile.position, projectile.acceleration, 4.1, selected ? 1.18 : 0.82);
  setArrow(projectile.positionArrow, new THREE.Vector3(0, 0, 0), projectile.position, 0.78, selected ? 1 : 0.62);
}

function updateLayerVisibility() {
  const formulaFocus = state.view === 'formula';
  fieldGroup.visible = state.showField;
  planeGroup.visible = true;

  for (const projectile of projectiles) {
    const selected = projectile.config.id === state.selectedId;
    projectile.velocityArrow.visible = state.showVelocity && (!formulaFocus || selected);
    projectile.accelerationArrow.visible = state.showAcceleration && (!formulaFocus || selected);
    projectile.positionArrow.visible = state.showPosition && (!formulaFocus || selected);
    projectile.trail.visible = state.showTrails;
    projectile.label.visible = state.view !== 'formula' || selected;
  }
}

function updateHud() {
  const selected = getSelectedProjectile();
  const r = selected.position.length();
  const v = selected.velocity.length();
  const a = selected.acceleration.length();
  const phi = potentialAt(selected.position);
  const phiOverC2 = phi / (visualC * visualC);
  const temporalFactor = 1 + 2 * phiOverC2;
  const spatialFactor = 1 - 2 * phiOverC2;

  elements.timeReadout.textContent = `t = ${state.simTime.toFixed(1)} s`;
  elements.objectReadout.textContent = `objeto: ${selected.config.shortName}`;
  elements.gravityReadout.textContent = `|a| = ${a.toFixed(2)}`;

  elements.metricOneLabel.textContent = 'r del objeto';
  elements.metricOneValue.textContent = `${r.toFixed(2)} u`;
  elements.metricTwoLabel.textContent = '|v| actual';
  elements.metricTwoValue.textContent = `${v.toFixed(2)} u/s`;
  elements.metricThreeLabel.textContent = '|a| gravitatoria';
  elements.metricThreeValue.textContent = `${a.toFixed(2)} u/s²`;

  elements.formulaAccel.textContent =
    `a = (${selected.acceleration.x.toFixed(2)}, ${selected.acceleration.y.toFixed(2)}, ${selected.acceleration.z.toFixed(2)})`;
  elements.formulaPotential.textContent = `Phi/c² = ${phiOverC2.toFixed(4)} con mu = ${mu().toFixed(1)}`;
  elements.formulaMetric.textContent = `g_tt ≈ ${(-temporalFactor).toFixed(4)}, g_espacial ≈ ${spatialFactor.toFixed(4)}`;

  if (state.view === 'formula') {
    controls.target.lerp(selected.position, 0.08);
  }
}

function updateCurvature() {
  for (const plane of curvaturePlanes) {
    const positions = plane.geometry.attributes.position;
    const base = plane.userData.base;
    const strength = state.curvatureStrength * state.massScale;

    for (let i = 0; i < positions.count; i += 1) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      const radius = Math.max(1.4, Math.sqrt(x * x + y * y + z * z));
      const depression = -3.0 * strength * Math.exp(-(radius * radius) / 58);
      const ripple = 0.08 * Math.sin(radius * 1.5 + state.simTime) * Math.exp(-radius / 12);

      if (plane.userData.kind === 'xz') {
        positions.setXYZ(i, x, y + depression + ripple, z);
      } else if (plane.userData.kind === 'xy') {
        positions.setXYZ(i, x, y, z + depression + ripple);
      } else {
        positions.setXYZ(i, x + depression + ripple, y, z);
      }
    }
    positions.needsUpdate = true;
    plane.geometry.computeVertexNormals();
  }
}

function updateFieldArrows() {
  for (const arrow of fieldArrows) {
    const base = arrow.userData.base as THREE.Vector3;
    const plane = arrow.userData.plane as PlaneKind;
    const acceleration = gravityAt(base);
    if (plane === 'xz') acceleration.y = 0;
    if (plane === 'xy') acceleration.z = 0;
    if (plane === 'yz') acceleration.x = 0;
    setArrow(arrow, base, acceleration, 4.8, 0.8);
  }
}

function getSelectedProjectile() {
  return projectiles.find((projectile) => projectile.config.id === state.selectedId) ?? projectiles[0];
}

function gravityAt(position: THREE.Vector3) {
  const distanceSq = Math.max(position.lengthSq(), 1.1);
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
  arrow.setLength(Math.min(length, 6.8), Math.min(0.55, Math.max(0.16, length * 0.16)), 0.18 * emphasis);
}

function createProjectile(config: ProjectileConfig): Projectile {
  const mesh = createProjectileMesh(config);
  const label = createLabel(config.name, config.color);
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([launchOrigin]),
    new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: 0.76 }),
  );

  return {
    config,
    mesh,
    label,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    velocityArrow: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffd166, 0.35, 0.16),
    accelerationArrow: new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0xff5a5f, 0.35, 0.16),
    positionArrow: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x5bc0eb, 0.35, 0.13),
    trail,
    trailPoints: [],
    impacted: false,
  };
}

function createProjectileMesh(config: ProjectileConfig) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.5,
    metalness: 0.08,
    emissive: config.color,
    emissiveIntensity: 0.08,
  });

  if (config.kind === 'apple') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 18), material);
    body.scale.set(1, 0.95, 1);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x6e4020, roughness: 0.72 }),
    );
    stem.position.y = 0.34;
    stem.rotation.z = 0.25;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 8),
      new THREE.MeshStandardMaterial({ color: 0x51b36a, roughness: 0.56 }),
    );
    leaf.scale.set(1.55, 0.32, 0.85);
    leaf.position.set(0.16, 0.42, 0);
    group.add(body, stem, leaf);
  } else if (config.kind === 'cube') {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.58), material));
  } else if (config.kind === 'cone') {
    group.add(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.75, 28), material));
  } else if (config.kind === 'front') {
    const capsule = new THREE.Group();
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 24), material);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), material);
    const bottom = top.clone();
    top.position.y = 0.31;
    bottom.position.y = -0.31;
    capsule.add(cylinder, top, bottom);
    capsule.rotation.z = Math.PI / 2;
    group.add(capsule);
  } else if (config.kind === 'back') {
    group.add(new THREE.Mesh(new THREE.TetrahedronGeometry(0.45), material));
  } else {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 16), material));
  }

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 12),
    new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.12,
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
  const equator = new THREE.Mesh(
    new THREE.RingGeometry(centralRadius * 1.02, centralRadius * 1.025, 128),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
  );
  equator.rotation.x = Math.PI / 2;
  group.add(core, atmosphere, equator);
  return group;
}

function createLaunchRing() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.018, 12, 80),
    new THREE.MeshBasicMaterial({ color: 0xf5f0df, transparent: true, opacity: 0.72 }),
  );
  ring.position.copy(launchOrigin);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function createCurvaturePlane(kind: PlaneKind, color: number, opacity: number): CurvaturePlane {
  const geometry = new THREE.PlaneGeometry(22, 22, 54, 54);
  if (kind === 'xz') geometry.rotateX(-Math.PI / 2);
  if (kind === 'yz') geometry.rotateY(Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    wireframe: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(geometry, material) as CurvaturePlane;
  plane.userData.base = geometry.attributes.position.array.slice(0) as Float32Array;
  plane.userData.kind = kind;
  return plane;
}

function createFieldArrows() {
  const arrows: THREE.ArrowHelper[] = [];
  const coords = [-9, -6, -3, 3, 6, 9];
  const make = (plane: PlaneKind, position: THREE.Vector3) => {
    if (position.length() < centralRadius + 0.6) return;
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), position, 0.8, 0xf4d35e, 0.25, 0.1);
    arrow.userData.base = position.clone();
    arrow.userData.plane = plane;
    arrows.push(arrow);
  };

  for (const a of coords) {
    for (const b of coords) {
      make('xz', new THREE.Vector3(a, 0, b));
      make('xy', new THREE.Vector3(a, b, 0));
      make('yz', new THREE.Vector3(0, a, b));
    }
  }
  return arrows;
}

function createAxes() {
  const group = new THREE.Group();
  group.add(makeLine([new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)], 0x5bc0eb, 0.8));
  group.add(makeLine([new THREE.Vector3(0, -8, 0), new THREE.Vector3(0, 12, 0)], 0xffd166, 0.8));
  group.add(makeLine([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, 12)], 0xb388ff, 0.8));
  group.add(createStaticLabel('X izquierda/derecha', new THREE.Vector3(12.4, 0, 0), 0x5bc0eb));
  group.add(createStaticLabel('Y arriba/abajo', new THREE.Vector3(0, 12.4, 0), 0xffd166));
  group.add(createStaticLabel('Z otros planos', new THREE.Vector3(0, 0, 12.4), 0xb388ff));
  return group;
}

function createStarField() {
  const count = 1400;
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

function updateTrail(projectile: Projectile) {
  projectile.trail.geometry.dispose();
  projectile.trail.geometry = new THREE.BufferGeometry().setFromPoints(projectile.trailPoints);
}

function updateLabel(projectile: Projectile) {
  projectile.label.position.copy(projectile.position).add(new THREE.Vector3(0.45, 0.6, 0.25));
  projectile.label.scale.set(4.6, 1.0, 1);
}

function createStaticLabel(text: string, position: THREE.Vector3, color: number) {
  const label = createLabel(text, color);
  label.position.copy(position);
  label.scale.set(5.2, 1.1, 1);
  return label;
}

function createLabel(text: string, color: number) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 760;
  labelCanvas.height = 150;
  const context = labelCanvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create label context');
  }
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
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
  return new THREE.Line(geometry, material);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
