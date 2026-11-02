// El estudio de «Dentro de Claude»: sala oscura (marca IAcademy, fondo «void»), suelo con una rejilla
// tenue y la máquina con sombras VSM, GTAO, un contorno suave y bloom contenido para las luces rojas.
// Base tomada del estudio del molino. frame(estado, t, cam, ops) dibuja un fotograma.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {buildMaquina} from './maquina.js';

const V3 = THREE.Vector3;
export const PALETTE = {
  bg: '#0f0f18',
  suelo: '#161624',
  rejilla: '#2a2a3d',
  metal: '#6e6e86',
  oscuro: '#1d1d2c',
  apagado: '#141420',
  vidrio: '#e8ecff',
  tubo: '#8a8aa8',
  rojo: '#ef4444',
  // capas del depósito: sistema, herramientas, proyecto, conversación
  capas: ['#d6d9ea', '#8f9ac4', '#d9b46a', '#7c86c2'],
};

const INK_FRAG = `
  uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal;
  uniform float uNear; uniform float uFar; uniform vec2 uPx; uniform vec3 uInk; uniform float uStrength;
  varying vec2 vUv;
  float lz(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }
  vec3 nn(vec2 uv){ return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    float z0 = lz(vUv);
    float zl = lz(vUv - vec2(uPx.x, 0.0)), zr = lz(vUv + vec2(uPx.x, 0.0));
    float zd = lz(vUv - vec2(0.0, uPx.y)), zu = lz(vUv + vec2(0.0, uPx.y));
    float lap = (abs(zl + zr - 2.0 * z0) + abs(zu + zd - 2.0 * z0)) / max(z0, 1e-3);
    float eD = 1.0 - smoothstep(0.016, 0.004, lap);
    vec3 n0 = nn(vUv);
    float eN = max(max(1.0 - dot(n0, nn(vUv - vec2(uPx.x, 0.0))), 1.0 - dot(n0, nn(vUv + vec2(uPx.x, 0.0)))),
                   max(1.0 - dot(n0, nn(vUv - vec2(0.0, uPx.y))), 1.0 - dot(n0, nn(vUv + vec2(0.0, uPx.y)))));
    float e = max(eD, smoothstep(0.3, 0.6, eN));
    c.rgb = mix(c.rgb, uInk, e * uStrength);
    gl_FragColor = c;
  }`;

const SUELO_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SUELO_FRAG = `uniform vec3 uG; uniform vec3 uBg; uniform vec3 uL; varying vec3 vW;
  void main(){
    float d = length(vW.xz - vec2(1.0, 0.5));
    float h = smoothstep(7.0, 22.0, d);
    vec2 g = abs(fract(vW.xz * 1.0) - 0.5);
    float lin = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
    vec3 c = mix(uG, uL, lin * 0.55 * (1.0 - h));
    c = mix(c, uBg, h);
    gl_FragColor = vec4(c, 1.0);
  }`;

export function createClaudeStage({canvas, ink = 0.25}) {
  const P = PALETTE;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.bg);
  scene.fog = new THREE.Fog(P.bg, 18, 40);
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.5, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const sueloAO = (v) => () => {
    suelo.visible = v;
    sombra.visible = v;
  };
  composer.addPass(new Toggle(sueloAO(false)));
  let aoOn = true;
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (r, w, rb, ...rest) => {
    if (aoOn) return gtaoRender(r, w, rb, ...rest);
    gtao._overrideVisibility();
    gtao._renderOverride(r, gtao.normalMaterial, gtao.normalRenderTarget, 0x7777ff, 1.0);
    gtao._restoreVisibility();
  };
  composer.addPass(gtao);
  composer.addPass(new Toggle(sueloAO(true)));
  const inkPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: {value: null},
        tDepth: {value: gtao.depthTexture},
        tNormal: {value: gtao.normalTexture},
        uNear: {value: camera.near},
        uFar: {value: camera.far},
        uPx: {value: new THREE.Vector2(1 / 1920, 1 / 1080)},
        uInk: {value: new THREE.Color().setRGB(0.32, 0.33, 0.45, THREE.LinearSRGBColorSpace)},
        uStrength: {value: ink},
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: INK_FRAG,
    }),
  );
  inkPass.enabled = ink > 0;
  composer.addPass(inkPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // entorno: cajas de luz frías y una roja baja, en una sala oscura
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#0b0b14');
    const box = (w, h, pos, k, tint = [1, 1, 1]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 6, new V3(-10, 10, 8), 1.6, [0.86, 0.9, 1.0]);
    box(10, 8, new V3(10, 12, -6), 1.1, [0.9, 0.9, 1.0]);
    box(16, 2, new V3(2, 2, 14), 0.9, [1.0, 0.35, 0.35]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.85;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.45, 0.78, 0.45).normalize();
  const sun = new THREE.DirectionalLight('#dfe4ff', 1.9);
  sun.castShadow = true;
  const EXT = 7.5;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 40});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.003;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#3a3d58', '#0c0c14', 0.9));
  const contra = new THREE.PointLight('#ef4444', 6, 9, 2);
  contra.position.set(0.5, 1.2, -2.4);
  scene.add(contra);

  const sueloMat = new THREE.ShaderMaterial({
    vertexShader: SUELO_VERT,
    fragmentShader: SUELO_FRAG,
    uniforms: {uG: {value: new THREE.Color(P.suelo)}, uBg: {value: new THREE.Color(P.bg)}, uL: {value: new THREE.Color(P.rejilla)}},
    toneMapped: false,
  });
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), sueloMat);
  suelo.rotation.x = -Math.PI / 2;
  scene.add(suelo);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({color: '#000000', opacity: 0.5, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.0004;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const maquina = buildMaquina(P);
  scene.add(maquina.group);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    inkPass.material.uniforms.uPx.value.set(1 / (w * pr), 1 / (h * pr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const tmp = new V3();
  const right = new V3().crossVectors(new V3(0, 1, 0), SUN_DIR).normalize();
  const upL = new V3().crossVectors(SUN_DIR, right);
  let texel = (2 * EXT) / sun.shadow.mapSize.x;

  const frame = (est, t, cam, ops = {}) => {
    maquina.update(est, t, ops);
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.cos(az), ty + d * Math.sin(el), tz - d * Math.cos(el) * Math.sin(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    tmp.set(1, 1.5, 0.5);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 20);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, shadow, blur, radius, ao, pcf, bloom: b}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      texel = (2 * EXT) / shadow;
    }
    if (blur !== undefined) sun.shadow.blurSamples = blur;
    if (radius !== undefined) sun.shadow.radius = radius;
    if (ao !== undefined) {
      aoOn = ao > 0;
      gtao.needsSwap = aoOn;
      if (aoOn) {
        gtao.updateGtaoMaterial({samples: ao});
        gtao.updatePdMaterial({samples: Math.max(4, ao)});
      }
    }
    if (b !== undefined) bloom.enabled = b;
    if (pcf !== undefined) {
      const type = pcf ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
      if (renderer.shadowMap.type !== type) {
        renderer.shadowMap.type = type;
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        scene.traverse((o) => {
          if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
        });
      }
    }
  };
  return {renderer, scene, camera, maquina, composer, gtao, inkPass, sun, resize, frame, size, project, setQuality};
}
