import * as THREE from "three";
import { raytraceMeshEligible, raytraceSourceGeometry } from "./experience-raytrace.js?v=advanced-render-20260930";

// Geometry-only G-buffer leaves the original baked/onBeforeCompile materials
// untouched. World normals and positive view depth use bottom-up WebGL order.
export function createRaytraceGBufferCapture(renderer, { maxPixels = 98304 } = {}) {
  let target = null, disposed = false, pending = false;
  const excludedMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const materials = new Map();
  const cameraWorld = new THREE.Matrix4();
  const viewport = new THREE.Vector4(), scissor = new THREE.Vector4(), clearColor = new THREE.Color();
  function getMaterial(source) {
    const key = `${source.side}:${!!source.flatShading}`;
    if (!materials.has(key)) {
      materials.set(key, new THREE.ShaderMaterial({
        name: "Raytrace normal and linear depth", side: source.side,
        defines: source.flatShading ? { CAPTURE_FLAT_NORMAL: 1 } : {},
        uniforms: { captureCameraWorld: { value: cameraWorld } }, toneMapped: false, blending: THREE.NoBlending,
        vertexShader: `
          uniform mat4 captureCameraWorld;
          varying vec3 vWorldNormal;
          varying float vLinearDepth;
          #ifdef CAPTURE_FLAT_NORMAL
            varying vec3 vCaptureWorldPosition;
          #endif
          void main() {
            vec3 objectNormal = normal;
            vec3 transformed = position;
            #ifdef USE_INSTANCING
              mat3 im = mat3(instanceMatrix);
              objectNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
              objectNormal = im * objectNormal;
              transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
            #endif
            vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
            vLinearDepth = -viewPosition.z;
            vWorldNormal = normalize(mat3(captureCameraWorld) * normalMatrix * objectNormal);
            #ifdef CAPTURE_FLAT_NORMAL
              vCaptureWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            #endif
            gl_Position = projectionMatrix * viewPosition;
          }`,
        fragmentShader: `
          varying vec3 vWorldNormal;
          varying float vLinearDepth;
          #ifdef CAPTURE_FLAT_NORMAL
            varying vec3 vCaptureWorldPosition;
          #endif
          void main() {
            #ifdef CAPTURE_FLAT_NORMAL
              // Match Three's flat-shaded normal_fragment_begin: screen-space
              // derivatives already orient the geometric face toward the view.
              vec3 normal = normalize(cross(dFdx(vCaptureWorldPosition), dFdy(vCaptureWorldPosition)));
            #else
              vec3 normal = normalize(vWorldNormal);
              #ifdef DOUBLE_SIDED
                normal *= gl_FrontFacing ? 1.0 : -1.0;
              #endif
              #ifdef FLIP_SIDED
                normal = -normal;
              #endif
            #endif
            gl_FragColor = vec4(normal, vLinearDepth);
          }`,
      }));
    }
    return materials.get(key);
  }
  const eligibleMaterial = (material) => material && material.visible !== false && !material.transparent &&
    (material.opacity ?? 1) >= 0.98 && !material.transmission && !material.alphaTest && !material.alphaMap && !material.wireframe;
  function render({ scene, camera, width, height, exclude = [] }) {
    if (disposed || !renderer.extensions.has("EXT_color_buffer_float")) return null;
    const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)));
    width = Math.max(1, Math.floor(width * scale)); height = Math.max(1, Math.floor(height * scale));
    if (!target) {
      target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: false });
      target.texture.name = "Raytrace world normal and view depth";
      target.texture.colorSpace = THREE.NoColorSpace;
      target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    } else if (target.width !== width || target.height !== height) target.setSize(width, height);
    const originalTarget = renderer.getRenderTarget(), originalFace = renderer.getActiveCubeFace(), originalMip = renderer.getActiveMipmapLevel();
    const originalScissorTest = renderer.getScissorTest(), originalAutoClear = renderer.autoClear;
    const originalShadow = renderer.shadowMap.enabled, originalXR = renderer.xr.enabled;
    const originalAlpha = renderer.getClearAlpha(), background = scene.background, override = scene.overrideMaterial;
    renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
    const changed = [], excluded = new Set(exclude.filter(Boolean));
    camera.updateMatrixWorld(); scene.updateMatrixWorld(true); cameraWorld.copy(camera.matrixWorld);
    try {
      scene.traverse((object) => {
        if (!object.isMesh && !object.isSprite && !object.isLine && !object.isPoints) return;
        if (!raytraceMeshEligible(object, excluded)) {
          if (object.visible) { changed.push([object, null, true, null]); object.visible = false; }
          return;
        }
        changed.push([object, object.material, null, object.geometry]);
        object.geometry = raytraceSourceGeometry(object);
        const substitute = (material) => eligibleMaterial(material) ? getMaterial(material) : excludedMaterial;
        object.material = Array.isArray(object.material) ? object.material.map(substitute) : substitute(object.material);
      });
      scene.background = null; scene.overrideMaterial = null; renderer.autoClear = true;
      renderer.shadowMap.enabled = false; renderer.xr.enabled = false;
      renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.setClearColor(0, 0);
      renderer.clear(); renderer.render(scene, camera);
    } finally {
      for (const [object, material, visible, geometry] of changed) {
        if (material !== null) object.material = material;
        if (visible !== null) object.visible = visible;
        if (geometry !== null) object.geometry = geometry;
      }
      scene.background = background; scene.overrideMaterial = override; renderer.autoClear = originalAutoClear;
      renderer.shadowMap.enabled = originalShadow; renderer.xr.enabled = originalXR;
      renderer.setRenderTarget(originalTarget, originalFace, originalMip); renderer.setViewport(viewport); renderer.setScissor(scissor);
      renderer.setScissorTest(originalScissorTest); renderer.setClearColor(clearColor, originalAlpha);
    }
    return { width, height, inverseProjection: Array.from(camera.projectionMatrixInverse.elements), cameraWorld: Array.from(camera.matrixWorld.elements) };
  }
  async function capture(options) {
    if (disposed || pending || !renderer.readRenderTargetPixelsAsync) return null;
    pending = true;
    try {
      const frame = render(options);
      if (!frame) return null;
      const normalDepth = new Float32Array(frame.width * frame.height * 4);
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, frame.width, frame.height, normalDepth);
      return disposed ? null : { ...frame, normalDepth };
    } finally { pending = false; }
  }
  function dispose() { disposed = true; target?.dispose(); target = null; for (const material of materials.values()) material.dispose(); materials.clear(); excludedMaterial.dispose(); }
  return { render, capture, dispose, get target() { return target; }, get normalDepthTexture() { return target?.texture || null; }, get depthTexture() { return target?.depthTexture || null; }, get pending() { return pending; } };
}
