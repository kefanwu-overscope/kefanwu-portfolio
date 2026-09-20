import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createProjectResourceCache, fetchProjectBuffer, abortError } from './studio-inspector-loader.js';
import { clampProgress, readBufferView, createSampledMotion } from './studio-motion-runtime.js';
import { installSourceMaterial } from './studio-inspector-materials.js';
import { fitCameraEnvelope } from './studio-inspector-camera.js';

const RELEASE = 'studio-packed-20260919';
const ASSET_ROOT = new URL('./assets/studio-motion/', import.meta.url);
const WORLD_ROTATION = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const toWorld = (point) => new THREE.Vector3().fromArray(point).applyQuaternion(WORLD_ROTATION);

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

function createMaterial(source) {
  const base = source.baseColor || [0.35, 0.35, 0.35, 1];
  const opacity = source.opacity ?? base[3] ?? 1;
  const settings = {
    name: source.name || '',
    color: new THREE.Color().setRGB(base[0], base[1], base[2]),
    metalness: source.metalness ?? 0,
    roughness: source.roughness ?? 0.5,
    opacity,
    transparent: opacity < 0.999 || source.transparent === true || !!source.tracks?.opacity,
    depthWrite: source.depthWrite ?? opacity >= 0.999,
    side: source.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors: !!source.vertexColors,
    clearcoat: source.clearcoat ?? 0,
    clearcoatRoughness: source.clearcoatRoughness ?? 0.3,
    transmission: source.transmission ?? 0,
    ior: source.ior ?? 1.45,
  };
  const material = source.unlit ? new THREE.MeshBasicMaterial({ color: settings.color, side: settings.side,
    vertexColors: settings.vertexColors, transparent: settings.transparent, opacity: settings.opacity,
    depthWrite: settings.depthWrite, toneMapped: false }) : new THREE.MeshPhysicalMaterial(settings);
  if (source.emissive && material.emissive) material.emissive.fromArray(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity ?? 1;
  material.userData.source = source;
  material.userData.motionUniforms = {};
  installSourceMaterial(material, source);
  return material;
}

function createGeometry(source, buffer, { dynamic = false, sourceCoordinates = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color', 'sourceCoordinates', 'objectCoordinates', 'heatExposure', 'attributeOpacity', 'attributeRoughness']) {
    if (!source[name]) continue;
    if (name === 'sourceCoordinates' && !sourceCoordinates) continue;
    let array = readBufferView(buffer, source[name]);
    // Deforming positions must not overwrite the immutable source buffer or
    // any sibling that shares the original component geometry.
    if (dynamic && (name === 'position' || name === 'normal' || name.startsWith('attribute'))) array = array.slice();
    const attribute = new THREE.BufferAttribute(array, source[name].itemSize || (name === 'uv' ? 2 : 3));
    if (dynamic && (name === 'position' || name === 'normal' || name.startsWith('attribute'))) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
  }
  if (source.index) geometry.setIndex(new THREE.BufferAttribute(readBufferView(buffer, source.index), 1));
  for (const group of source.groups || []) geometry.addGroup(group.start, group.count, group.materialIndex);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Parts with identical absolute motion can use one mesh without changing any
// source vertex, material, transform or sample. Transparent parts retain their
// own sorting; steering retains individual meshes for annotations.
function batchRigidParts(key, manifest, root, nodes) {
  if (key === 'steering') return;
  const groups = new Map();
  for (let index = 0; index < nodes.length; index++) {
    const object = nodes[index], source = manifest.nodes[index], material = object.material;
    if (Array.isArray(material) || material.transparent || material.transmission > 0 || object.userData.presentationHidden ||
        Object.keys(source.tracks || {}).some((name) => !['position', 'quaternion', 'scale', 'visible'].includes(name))) continue;
    const attributes = Object.entries(object.geometry.attributes).map(([name, attribute]) => [name, attribute.itemSize, attribute.array.constructor.name]);
    const id = JSON.stringify([source.materialIndices, source.transform, source.visible, source.tracks, attributes]);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(index);
  }
  const retired = new Set();
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const leader = nodes[indices[0]], geometry = new THREE.BufferGeometry();
    let vertices = 0, indexCount = 0;
    for (const index of indices) {
      const part = nodes[index].geometry;
      vertices += part.attributes.position.count;
      indexCount += part.index?.count || part.attributes.position.count;
    }
    for (const [name, attribute] of Object.entries(leader.geometry.attributes)) {
      const array = new attribute.array.constructor(vertices * attribute.itemSize);
      let offset = 0;
      for (const index of indices) {
        const source = nodes[index].geometry.attributes[name].array;
        array.set(source, offset); offset += source.length;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    const indexArray = new (vertices > 65535 ? Uint32Array : Uint16Array)(indexCount);
    let vertexOffset = 0, indexOffset = 0;
    for (const index of indices) {
      const part = nodes[index].geometry, source = part.index?.array;
      const count = source?.length || part.attributes.position.count;
      for (let i = 0; i < count; i++) indexArray[indexOffset++] = vertexOffset + (source ? source[i] : i);
      vertexOffset += part.attributes.position.count;
      retired.add(part);
    }
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    leader.geometry = geometry;
    leader.name = `${leader.name} (+${indices.length - 1} matching parts)`;
    for (const index of indices.slice(1)) { root.remove(nodes[index]); nodes[index] = leader; }
  }
  const retained = new Set(nodes.map((node) => node.geometry));
  for (const geometry of retired) if (!retained.has(geometry)) geometry.dispose();
}

function buildResource(key, manifest, geometryBuffer, motionBuffer, { initial = false, loadMotion } = {}) {
  if (manifest.schema !== 'studio-motion-v1' || manifest.coordinates !== 'blender-z-up') {
    throw new Error('Unsupported interactive model format.');
  }
  const root = new THREE.Group();
  root.name = key;
  root.quaternion.copy(WORLD_ROTATION);
  const materials = manifest.materials.map(createMaterial);
  const geometries = new Map();
  const nodes = [];
  const sharedDynamic = new Map();
  try {
    for (const source of manifest.nodes) {
      const dynamic = !!(source.tracks?.deformationPosition || source.tracks?.attributeRoughness);
      const assigned = (source.materialIndices || [0]).map((index) => materials[index]);
      const sourceCoordinates = assigned.some((material) => ['carbon', 'noise'].includes(material.userData.source.procedural?.type));
      const id = JSON.stringify(source.geometry);
      // The exporter certifies that this group has at most one visible cloth
      // at every source sample. All shared attributes are replaced on seek.
      const sharedId = dynamic && source.exclusiveDeformationGroup ? `${source.exclusiveDeformationGroup}:${id}` : null;
      let geometry = sharedId ? sharedDynamic.get(sharedId) : !dynamic && geometries.get(`${sourceCoordinates}:${id}`);
      if (!geometry) {
        geometry = createGeometry(source.geometry, geometryBuffer, { dynamic, sourceCoordinates });
        if (sharedId) sharedDynamic.set(sharedId, geometry);
        else if (!dynamic) geometries.set(`${sourceCoordinates}:${id}`, geometry);
      }
      if (assigned.some((material) => material.userData.source.procedural?.coordinateSpace === 'object') && !geometry.attributes.objectCoordinates) {
        geometry.setAttribute('objectCoordinates', new THREE.BufferAttribute(geometry.attributes.position.array.slice(), 3));
      }
      if (assigned.some((material) => material.userData.source.procedural?.type === 'carbon')) {
        const length = geometry.attributes.position.count;
        if (!geometry.attributes.attributeOpacity) geometry.setAttribute('attributeOpacity', new THREE.BufferAttribute(new Float32Array(length).fill(1), 1));
        if (!geometry.attributes.attributeRoughness) geometry.setAttribute('attributeRoughness', new THREE.BufferAttribute(new Float32Array(length).fill(assigned[0].roughness), 1));
      }
      const object = new THREE.Mesh(geometry, assigned.length === 1 ? assigned[0] : assigned);
      object.name = source.name;
      object.userData.group = source.group;
      object.userData.sourceName = source.name;
      const transform = source.transform || {};
      object.position.fromArray(transform.position || [0, 0, 0]);
      object.quaternion.fromArray(transform.quaternion || [0, 0, 0, 1]);
      object.scale.fromArray(transform.scale || [1, 1, 1]);
      object.visible = source.visible !== false;
      if (key === 'ansysCfd' && (source.name === 'Pressure legend label' || source.name === 'Actual pressure range color scale' || source.name.startsWith('Pressure tick '))) {
        // The host presents the same source pressure scale as fixed, readable
        // HTML. These source-camera labels would turn backwards under orbit.
        object.userData.presentationHidden = true;
        object.visible = false;
      }
      object.matrixAutoUpdate = false;
      object.updateMatrix();
      if (dynamic) object.frustumCulled = false;
      root.add(object);
      nodes.push(object);
    }
    batchRigidParts(key, manifest, root, nodes);
    const motion = createSampledMotion({ manifest, buffer: motionBuffer, nodes, materials, initial });
    motion.seek(0);
    root.updateMatrixWorld(true);
    // Box3 deliberately includes invisible assembly parts, which are still
    // needed to frame a complete assembly/explosion without clipping.
    const bounds = new THREE.Box3();
    for (const node of new Set(nodes)) if (!node.userData.presentationHidden) bounds.expandByObject(node);
    if (manifest.bounds?.motion && key !== 'ansysCfd') {
      const { min, max } = manifest.bounds.motion;
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) bounds.expandByPoint(toWorld([x, y, z]));
    }
    let motionController = null, motionRequest = null, closed = false;
    const entry = {
      key, root, manifest, motion, nodes, bounds, motionReady: !initial,
      get byteLength() {
        let gpuBytes = 0;
        const buffers = new Set(entry.motion.buffers);
        for (const geometry of new Set(nodes.map((object) => object.geometry))) {
          for (const attribute of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) {
            gpuBytes += attribute.array.byteLength; buffers.add(attribute.array.buffer);
          }
        }
        return gpuBytes + [...buffers].reduce((total, buffer) => total + buffer.byteLength, 0);
      },
      ensureMotion() {
        if (closed) return Promise.reject(abortError());
        if (entry.motionReady) return Promise.resolve(entry);
        if (motionRequest) return motionRequest;
        const controller = new AbortController(); motionController = controller;
        const request = (async () => {
          const buffer = await loadMotion(controller.signal);
          if (closed || controller.signal.aborted) throw abortError();
          const next = createSampledMotion({ manifest, buffer, nodes, materials });
          next.seek(0);
          entry.motion = next; entry.motionReady = true;
          return entry;
        })();
        motionRequest = request;
        request.finally(() => {
          if (motionRequest === request) { motionRequest = null; motionController = null; }
        }).catch(() => {});
        return request;
      },
      cancelMotion() { motionController?.abort(); motionController = null; motionRequest = null; },
      dispose() { closed = true; entry.cancelMotion(); disposeObject(root); },
    };
    return entry;
  } catch (error) {
    disposeObject(root);
    for (const material of materials) material.dispose();
    throw error;
  }
}

/**
 * Independent project workbench. The host hides/suspends its room renderer
 * while active; this renderer never schedules work for the hidden room.
 */
export function createStudioInspector({
  canvas,
  onStatus = () => {},
  onProgress = () => {},
  onPlaybackChange = () => {},
  onPartSelect = () => {},
  manifestUrl,
  quality = 'auto',
} = {}) {
  if (!canvas) throw new Error('The project workbench needs a canvas.');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x191919, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x191919);
  let environmentTarget;
  function rebuildEnvironment() {
    environmentTarget?.dispose();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(environment, 0.04);
    scene.environment = environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
  }
  rebuildEnvironment();
  scene.environmentIntensity = 0.65;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x737373, 1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 1.3);
  fillLight.position.set(-5, 2, -3);
  scene.add(fillLight);

  let camera = new THREE.PerspectiveCamera(38, 1, 0.001, 1000);
  camera.position.set(3, 2, 3);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.11;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.85;
  controls.minPolarAngle = 0.005;
  controls.maxPolarAngle = Math.PI - 0.005;
  controls.screenSpacePanning = true;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowTier = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
  let disposed = false;
  let active = true;
  let contextLost = false;
  let playing = false;
  let direction = 1;
  let progress = 0;
  let selectedKey = null;
  let resource = null;
  let state = 'idle';
  let raf = 0;
  let lastTime = 0;
  let dirty = true;
  let interaction = false;
  let loadTicket = 0;
  let sourceView = null;
  let viewHeight = 2;
  let frameWidth = 3;
  let frameAspect = 1.5;
  let radius = 1;
  let selectedAt = 0;
  let renderedFrames = 0;
  let poseDirty = false;
  let insideFrame = false;
  let motionTask = null;
  let motionCompletion = Promise.resolve(null);
  let motionError = false;
  const saved = new Map();
  const frameSamples = [];
  let manifestIndexRequest = null;
  const manifestIndexController = new AbortController();

  async function resolveManifestUrl(key, signal) {
    if (manifestUrl) {
      const relative = typeof manifestUrl === 'function' ? manifestUrl(key) :
        `${manifestUrl.replace(/\/$/, '')}/${encodeURIComponent(key)}/manifest.json`;
      return new URL(relative, document.baseURI);
    }
    if (signal.aborted) throw abortError();
    if (!manifestIndexRequest) {
      // The small catalog belongs to this inspector, so switching projects
      // must not abort a request that the next selection also needs.
      const request = (async () => {
        const response = await fetch(new URL(`index.json?v=${RELEASE}`, ASSET_ROOT), { signal: manifestIndexController.signal });
        if (!response.ok) throw new Error(`The interactive project catalog could not load (${response.status}).`);
        const index = await response.json();
        if (index.schema !== 'studio-motion-index-v1' || !index.projects || typeof index.projects !== 'object') {
          throw new Error('Unsupported interactive project catalog.');
        }
        return index;
      })();
      manifestIndexRequest = request;
      request.catch(() => { if (manifestIndexRequest === request) manifestIndexRequest = null; });
    }
    const index = await new Promise((resolve, reject) => {
      const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()); };
      signal.addEventListener('abort', abort, { once: true });
      manifestIndexRequest.then(
        (value) => { signal.removeEventListener('abort', abort); resolve(value); },
        (error) => { signal.removeEventListener('abort', abort); reject(error); },
      );
    });
    if (signal.aborted) throw abortError();
    const relative = index.projects[key]?.manifest;
    if (typeof relative !== 'string' || !relative) throw new Error('This interactive project is unavailable.');
    return new URL(relative, ASSET_ROOT);
  }

  const cache = createProjectResourceCache({
    maxEntries: 2,
    maxBytes: lowTier ? 100 * 1024 * 1024 : 192 * 1024 * 1024,
    dispose: (entry) => entry.dispose(),
    load: async (key, signal, reserve) => {
      const url = await resolveManifestUrl(key, signal);
      if (signal.aborted) throw abortError();
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`The interactive model could not load (${response.status}).`);
      const manifest = await response.json();
      const buffers = manifest.buffers || {};
      const geometryFile = typeof buffers.geometry === 'string' ? buffers.geometry : buffers.geometry?.url || buffers.geometry?.uri;
      const motionFile = typeof buffers.motion === 'string' ? buffers.motion : buffers.motion?.url || buffers.motion?.uri;
      const initialFile = typeof buffers.initialMotion === 'string' ? buffers.initialMotion : buffers.initialMotion?.url || buffers.initialMotion?.uri;
      // Includes decoded attributes and likely GPU copies, leaving space before
      // any incoming binary starts to inflate. Precise accounting follows build.
      reserve((buffers.geometry?.byteLength || 0) * 3 + (buffers.motion?.byteLength || 0) * 2);
      const [geometryBuffer, motionBuffer] = await Promise.all([
        fetchProjectBuffer(new URL(geometryFile || 'geometry.bin.gz', url), { signal }),
        fetchProjectBuffer(new URL(initialFile || motionFile || 'motion.bin.gz', url), { signal }),
      ]);
      if (signal.aborted) throw abortError();
      return buildResource(key, manifest, geometryBuffer, motionBuffer, { initial: !!initialFile,
        loadMotion: (motionSignal) => {
          cache.reserve((buffers.motion?.byteLength || 0) * 2, 0);
          return fetchProjectBuffer(new URL(motionFile || 'motion.bin.gz', url), { signal: motionSignal });
        },
      });
    },
  });

  function emitStatus(next, extra = {}) {
    state = next;
    onStatus({ state: next, key: selectedKey, ...extra });
  }

  renderer.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
    console.error('[studio] Source material could not compile', context.getProgramInfoLog(program),
      context.getShaderInfoLog(vertexShader), context.getShaderInfoLog(fragmentShader));
    emitStatus('error', { message: 'This browser could not render the source material. The case study preview is still available.' });
    pause();
  };

  function invalidate() {
    dirty = true;
    if (!raf && !insideFrame && !disposed && active && !contextLost && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function notifyPlayback() { onPlaybackChange({ playing, direction }); }

  function pause() {
    if (!playing) return;
    playing = false;
    notifyPlayback();
  }

  function setProgress(value) {
    if (disposed) return;
    const next = clampProgress(value);
    if (resource && !resource.motionReady && next !== 0) return;
    if (next === progress && !poseDirty) return;
    progress = next;
    poseDirty = true;
    invalidate();
  }

  function frame(time) {
    raf = 0;
    if (disposed || !active || contextLost || document.hidden) return;
    insideFrame = true;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.08) : 0;
    lastTime = time;
    if (playing && resource) {
      setProgress(progress + direction * dt / resource.motion.duration);
      if ((direction > 0 && progress >= 1) || (direction < 0 && progress <= 0)) pause();
    }
    if (poseDirty && resource) {
      resource.motion.seek(progress);
      onProgress(progress);
      poseDirty = false;
    }
    const moving = controls.update();
    if (dirty || moving || playing) {
      const started = performance.now();
      renderer.render(scene, camera);
      renderedFrames += 1;
      frameSamples.push(performance.now() - started);
      if (frameSamples.length > 120) frameSamples.shift();
      dirty = false;
      if (motionTask && !motionTask.scheduled) {
        const task = motionTask;
        task.scheduled = true;
        // Let the first source pose reach the screen before animation download
        // and decoding compete with its shader compilation and upload.
        requestAnimationFrame(() => setTimeout(() => finishMotion(task), 0));
      }
    }
    insideFrame = false;
    if ((playing || moving || interaction) && !raf) raf = requestAnimationFrame(frame);
    else if (!raf) lastTime = 0;
  }

  async function finishMotion(task) {
    if (task !== motionTask || disposed || task.ticket !== loadTicket || task.signal?.aborted) { task.resolve(null); return; }
    try {
      await task.entry.ensureMotion();
      if (task !== motionTask || disposed || task.ticket !== loadTicket || task.signal?.aborted) { task.resolve(null); return; }
      motionError = false;
      poseDirty = true;
      setProgress(task.restoreProgress);
      cache.trim();
      if (!contextLost) emitStatus('ready', { motionReady: true, manifest: task.entry.manifest, message: 'Drag to rotate · scroll to zoom', loadMilliseconds: performance.now() - selectedAt });
      invalidate();
      task.resolve({ key: task.entry.key, motionReady: true });
    } catch (error) {
      if (task === motionTask && !disposed && task.ticket === loadTicket && error.name !== 'AbortError') {
        motionError = true;
        if (!contextLost) emitStatus('ready', { motionReady: false, motionError: true, manifest: task.entry.manifest, message: 'Animation could not load. You can still rotate the model.', error });
      }
      task.resolve(null);
    } finally {
      task.signal?.removeEventListener('abort', task.abort);
      if (motionTask === task) motionTask = null;
    }
  }

  function prepareMotion(entry, ticket, { signal, restoreProgress = 0 } = {}) {
    if (entry.motionReady) return Promise.resolve({ key: entry.key, motionReady: true });
    return new Promise((resolve) => {
      const task = { entry, ticket, signal, restoreProgress, resolve, scheduled: false,
        abort() {
          entry.cancelMotion();
          signal?.removeEventListener('abort', task.abort);
          if (motionTask === task) motionTask = null;
          resolve(null);
        },
      };
      signal?.addEventListener('abort', task.abort, { once: true });
      motionTask = task;
      if (signal?.aborted) task.abort();
    });
  }

  function cancelMotionTask() {
    if (!motionTask) return;
    motionTask.signal?.removeEventListener('abort', motionTask.abort);
    motionTask.abort(); motionTask = null;
  }

  function retryMotion() {
    if (!resource || disposed) return Promise.resolve(null);
    if (resource.motionReady || motionTask) return motionCompletion;
    motionError = false;
    motionCompletion = prepareMotion(resource, loadTicket, { restoreProgress: progress });
    emitStatus('ready', { motionReady: false, manifest: resource.manifest, message: 'Loading animation…' });
    invalidate();
    return motionCompletion;
  }

  function resize() {
    if (disposed) return;
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    const tier = quality === 'auto' ? (lowTier ? 'low' : 'high') : quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.25 : 2));
    renderer.setSize(width, height, false);
    if (camera.isOrthographicCamera) {
      viewHeight = frameWidth / Math.min(width / height, frameAspect);
      camera.left = -viewHeight * width / height / 2;
      camera.right = viewHeight * width / height / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
    } else camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function captureView() {
    return { position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(), zoom: camera.zoom, frameWidth, frameAspect };
  }

  function applyView(view) {
    if (view.frameWidth) frameWidth = view.frameWidth;
    if (view.frameAspect) frameAspect = view.frameAspect;
    controls.stopListenToKeyEvents();
    camera.position.fromArray(view.position);
    camera.up.fromArray(view.up || [0, 1, 0]);
    controls.target.fromArray(view.target);
    camera.zoom = view.zoom || 1;
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    // Consume any old damping delta before restoring the selected view.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.fromArray(view.position);
    controls.target.fromArray(view.target);
    camera.lookAt(controls.target);
    controls.update();
    controls.enableDamping = damping;
    resize();
    invalidate();
  }

  function initializeCamera(entry) {
    const bounds = entry.bounds;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    radius = Math.max(size.length() / 2, 0.01);
    const source = entry.manifest.camera || {};
    const box = canvas.getBoundingClientRect();
    const aspect = Math.max(0.2, box.width / Math.max(1, box.height));
    const orthographic = source.type === 'orthographic' || source.type === 'ORTHO' || source.orthoScale != null;
    camera = orthographic ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 1000) : new THREE.PerspectiveCamera(source.fov || 38, aspect, 0.001, 1000);
    controls.object = camera;
    camera.near = Math.max(radius / 1000, 0.0001);
    camera.far = Math.max(radius * 100, 100);
    controls.minDistance = radius * 0.2;
    controls.maxDistance = radius * 12;
    controls.minZoom = 0.35;
    controls.maxZoom = 6;
    const sourcePosition = source.position ? toWorld(source.position) : center.clone().add(new THREE.Vector3(1, 0.6, 1).normalize().multiplyScalar(radius * 3.4));
    const target = source.target ? toWorld(source.target) : center;
    const up = source.up ? toWorld(source.up).normalize() : new THREE.Vector3(0, 1, 0);
    const sourceAspect = source.aspect || 1.5;
    // Blender's ortho_scale is horizontal for the landscape source images.
    // Preserve their camera direction while widening portrait framing so the
    // same complete project remains visible on a phone.
    frameWidth = source.orthoScale || radius * 2.2 * sourceAspect;
    frameAspect = sourceAspect;
    // Fit once to the entire source motion envelope using the original camera
    // axes. This keeps distant exploded components visible without moving the
    // camera as progress changes or altering the initial viewing direction.
    const fitted = fitCameraEnvelope({ bounds, position: sourcePosition, target, up, sourceAspect, aspect, fov: camera.fov || 38, orthoScale: frameWidth });
    if (orthographic) frameWidth = fitted.frameWidth;
    else sourcePosition.copy(target).addScaledVector(fitted.forward, -fitted.distance);
    sourceView = { position: sourcePosition.toArray(), target: target.toArray(), up: up.toArray(), zoom: 1, frameWidth, frameAspect };
    resize();
    applyView(sourceView);
    controls.saveState();
  }

  async function selectProject(key, { signal } = {}) {
    if (disposed) throw abortError();
    const ticket = ++loadTicket;
    cancelMotionTask();
    motionError = false;
    pause();
    if (resource) {
      saved.set(resource.key, { progress, view: captureView() });
      scene.remove(resource.root);
      renderer.renderLists.dispose();
      resource = null;
    }
    selectedKey = key;
    selectedAt = performance.now();
    emitStatus('loading', { message: 'Loading interactive model…' });
    invalidate();
    try {
      const entry = await cache.select(key, { signal });
      if (disposed || ticket !== loadTicket || signal?.aborted) throw abortError();
      resource = entry;
      scene.add(entry.root);
      initializeCamera(entry);
      const previous = saved.get(key);
      poseDirty = true;
      setProgress(entry.motionReady ? previous?.progress || 0 : 0);
      if (previous?.view) applyView(previous.view);
      frameSamples.length = 0;
      motionCompletion = prepareMotion(entry, ticket, { signal, restoreProgress: previous?.progress || 0 });
      if (!contextLost) emitStatus('ready', { motionReady: entry.motionReady, message: entry.motionReady ? 'Drag to rotate · scroll to zoom' : 'Loading animation…', manifest: entry.manifest, loadMilliseconds: performance.now() - selectedAt });
      invalidate();
      return { key, manifest: entry.manifest, progress, motionReady: entry.motionReady, whenMotionReady: motionCompletion };
    } catch (error) {
      if (disposed || ticket !== loadTicket || error.name === 'AbortError') return null;
      emitStatus('error', { message: error.message || 'The interactive model is unavailable.', error });
      return null;
    }
  }

  function play({ direction: nextDirection = direction } = {}) {
    if (disposed || !resource?.motionReady || !active || contextLost) return;
    direction = nextDirection < 0 ? -1 : 1;
    if ((direction > 0 && progress >= 1) || (direction < 0 && progress <= 0)) setProgress(direction > 0 ? 0 : 1);
    playing = true;
    lastTime = 0;
    notifyPlayback();
    invalidate();
  }

  function setView(view) {
    if (!resource || !sourceView) return;
    if (view === 'source' || view === 'reset') { applyView(sourceView); return; }
    const vectors = { front: [0, 0, 1], side: [1, 0, 0], top: [0, 1, 0.001], iso: [1, 0.7, 1] };
    if (!vectors[view]) return;
    const target = resource.bounds.getCenter(new THREE.Vector3());
    const position = new THREE.Vector3().fromArray(vectors[view]).normalize().multiplyScalar(radius * 3.5).add(target);
    applyView({ position: position.toArray(), target: target.toArray(), up: [0, 1, 0], zoom: 1, frameWidth: radius * 2.2, frameAspect: 1 });
  }

  function setActive(value) {
    active = !!value;
    controls.enabled = active && !contextLost;
    if (!active) {
      pause();
      cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
    } else { resize(); invalidate(); }
  }

  const change = () => invalidate();
  const interactionStart = () => { interaction = true; invalidate(); };
  const interactionEnd = () => { interaction = false; invalidate(); };
  controls.addEventListener('change', change);
  controls.addEventListener('start', interactionStart);
  controls.addEventListener('end', interactionEnd);
  const visibilityChange = () => {
    if (document.hidden) {
      pause(); cancelAnimationFrame(raf); raf = 0; lastTime = 0;
    } else invalidate();
  };
  const lost = (event) => {
    event.preventDefault();
    contextLost = true;
    controls.enabled = false;
    pause();
    cancelAnimationFrame(raf); raf = 0;
    emitStatus('context-lost', { message: 'The 3D view was interrupted. Restoring the model…' });
  };
  const restored = () => {
    contextLost = false;
    rebuildEnvironment();
    controls.enabled = active;
    emitStatus(resource ? 'ready' : 'idle', { message: '3D view restored.', ...(resource ? { manifest: resource.manifest, motionReady: resource.motionReady, motionError } : {}) });
    resize();
  };
  const reducedChange = () => { if (reducedMotion.matches) pause(); };
  document.addEventListener('visibilitychange', visibilityChange);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  reducedMotion.addEventListener('change', reducedChange);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const raycaster = new THREE.Raycaster();
  let pointerDown = null;
  const pointerStart = (event) => { pointerDown = [event.clientX, event.clientY]; };
  const pointerEnd = (event) => {
    if (selectedKey !== 'steering' || !resource || !pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
    pointerDown = null;
    const box = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(resource.nodes, false).find((result) => result.object.visible);
    if (hit) onPartSelect({ key: selectedKey, name: hit.object.name, group: hit.object.userData.group });
  };
  canvas.addEventListener('pointerdown', pointerStart);
  canvas.addEventListener('pointerup', pointerEnd);
  resize();

  return {
    selectProject, setProgress, play, pause, resize, setView, setActive, retryMotion,
    whenMotionReady: () => motionCompletion,
    reset({ camera: resetCamera = true } = {}) {
      if (motionTask) motionTask.restoreProgress = 0;
      pause(); setProgress(0); if (resetCamera) setView('source');
    },
    setQuality(value) { quality = ['auto', 'low', 'high'].includes(value) ? value : 'auto'; resize(); },
    getState() {
      return { key: selectedKey, state, progress, playing, direction, active, quality, motionReady: !!resource?.motionReady, motionError, reducedMotion: reducedMotion.matches,
        cache: cache.stats(), objects: { ...renderer.info.memory }, drawCalls: renderer.info.render.calls, renderedFrames,
        camera: captureView(),
        sourceShaders: resource ? [...new Set(resource.nodes.flatMap((object) => Array.isArray(object.material) ? object.material : [object.material]))]
          .filter((material) => material.userData.source.procedural || material.userData.source.heat)
          .map((material) => ({ name: material.name, compiled: !!material.userData.sourceShaderCompiled, type: material.userData.source.procedural?.type || 'heat' })) : [],
        triangles: renderer.info.render.triangles,
        renderMilliseconds: frameSamples.length ? frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length : 0 };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loadTicket += 1;
      cancelMotionTask();
      manifestIndexController.abort();
      playing = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      canvas.removeEventListener('pointerdown', pointerStart);
      canvas.removeEventListener('pointerup', pointerEnd);
      reducedMotion.removeEventListener('change', reducedChange);
      controls.dispose();
      cache.dispose();
      environmentTarget.dispose();
      renderer.dispose();
      resource = null;
      saved.clear();
    },
  };
}
