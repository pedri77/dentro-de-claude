// La máquina «Dentro de Claude», hecha con código. update(estado, t, ops) la posa a partir del estado
// de sesion.js. Escala: un depósito de ALTO_DEP metros es la ventana completa de 1M tokens, igual para
// el agente principal y para cada subagente, así se comparan a simple vista.
import * as THREE from 'three';
import {HECHOS, SUBS, clamp, ss} from './sesion.js';

export const ALTO_DEP = 3.2; // m = 1.000.000 tokens
const VENTANA = HECHOS.ventana_tokens;
export const POS = {
  deposito: new THREE.Vector3(-3.3, 0, 0),
  modelo: new THREE.Vector3(0, 0, 0),
  banco: new THREE.Vector3(0, 0, 2.6),
};
export const ESTACIONES = ['Bash', 'Read', 'Write', 'Agent'];
const ESTACION_DE = {Bash: 'Bash', Read: 'Read', Write: 'Write', Edit: 'Write', Agent: 'Agent', MCP: 'Bash'};
// las herramientas, en fila delante del modelo
export const estacionPos = (n) => {
  const i = ESTACIONES.indexOf(n);
  return new THREE.Vector3(-1.35 + i * 0.9, 0, POS.banco.z);
};
// los subagentes, en un arco detrás y a la derecha
export const subPos = (i) => {
  const a = -0.95 + (i / 4) * 1.9;
  return new THREE.Vector3(3.0 + Math.cos(a) * 2.6, 0, Math.sin(a) * 3.0 - 0.6);
};

export function buildMaquina(P) {
  const group = new THREE.Group();
  const mats = {
    metal: new THREE.MeshStandardMaterial({color: P.metal, roughness: 0.5, metalness: 0.6, envMapIntensity: 0.6}),
    oscuro: new THREE.MeshStandardMaterial({color: P.oscuro, roughness: 0.38, metalness: 0.3, envMapIntensity: 0.5}),
    vidrio: new THREE.MeshStandardMaterial({color: P.vidrio, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.09, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide}),
    rojo: new THREE.MeshStandardMaterial({color: P.rojo, emissive: P.rojo, emissiveIntensity: 0.6, roughness: 0.4}),
    blanco: new THREE.MeshStandardMaterial({color: '#f1f1f1', emissive: '#f1f1f1', emissiveIntensity: 0.5, roughness: 0.4}),
    tubo: new THREE.MeshStandardMaterial({color: P.tubo, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false}),
  };
  const partes = [];
  const add = (m, parent = group) => {
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    partes.push(m);
    return m;
  };
  const capasMat = P.capas.map((c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.45, metalness: 0.05, emissive: c, emissiveIntensity: 0.28}));

  // ------------------------------------------------------------ depósito de contexto
  const dep = new THREE.Group();
  dep.position.copy(POS.deposito);
  group.add(dep);
  const R = 0.78;
  add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.18, 0.22, 48), mats.metal), dep).position.y = 0.11;
  const anillos = [];
  for (const y of [0.22 + ALTO_DEP + 0.04]) {
    const a = add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.12, 48), mats.metal), dep);
    a.position.y = y;
    anillos.push(a);
  }
  // marcas de 100k en 100k (la ventana entera mide ALTO_DEP)
  for (let k = 1; k <= 10; k++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, k % 5 === 0 ? 0.008 : 0.004, 6, 64), mats.metal);
    m.rotation.x = Math.PI / 2;
    m.position.y = 0.22 + (k / 10) * ALTO_DEP;
    dep.add(m);
  }
  const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTO_DEP, 64, 1, true), mats.vidrio);
  vidrio.position.y = 0.22 + ALTO_DEP / 2;
  vidrio.renderOrder = 6;
  dep.add(vidrio);
  // líquido por capas: arranque (sistema, herramientas, proyecto), conversación en caché, escrito ahora
  const capaGeo = new THREE.CylinderGeometry(R - 0.04, R - 0.04, 1, 64);
  const capas = P.capas.map((_, i) => add(new THREE.Mesh(capaGeo, capasMat[i]), dep));
  // lo nuevo en cada llamada son cientos o pocos miles de tokens: a esta escala, un anillo en la superficie
  const escrito = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.022, 10, 72), mats.rojo);
  escrito.rotation.x = Math.PI / 2;
  dep.add(escrito);

  // ------------------------------------------------------------ el modelo: monolito sellado
  const mod = new THREE.Group();
  mod.position.copy(POS.modelo);
  group.add(mod);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, 1.9), mats.metal), mod).position.y = 0.12;
  const cuerpo = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.4), mats.oscuro), mod);
  cuerpo.position.y = 0.24 + 1.3;
  const ranuraMat = new THREE.MeshStandardMaterial({color: P.rojo, emissive: P.rojo, emissiveIntensity: 0.2, roughness: 0.5});
  const ranuras = [];
  for (const [x, z, ry] of [[0, 0.701, 0], [0.701, 0, Math.PI / 2], [0, -0.701, 0], [-0.701, 0, Math.PI / 2]]) {
    for (let k = 0; k < 6; k++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.035), ranuraMat);
      r.position.set(x, 0.62 + k * 0.32, z);
      r.rotation.y = ry;
      if (z < 0 || x < 0) r.rotation.y += Math.PI;
      mod.add(r);
      ranuras.push(r);
    }
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.5), mats.metal), mod).position.y = 0.24 + 2.6 + 0.07;

  // tubo depósito → modelo, con partículas que entran (cada llamada relee todo el contexto)
  const curvaEntrada = new THREE.CatmullRomCurve3([
    new THREE.Vector3(POS.deposito.x + R + 0.05, 1.0, 0),
    new THREE.Vector3(-1.6, 1.0, 0),
    new THREE.Vector3(-0.72, 1.0, 0),
  ]);
  add(new THREE.Mesh(new THREE.TubeGeometry(curvaEntrada, 32, 0.11, 16), mats.tubo));
  const NP = 26;
  const pGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const pEntrada = new THREE.InstancedMesh(pGeo, mats.blanco, NP);
  group.add(pEntrada);

  // salida: fichas que suben desde el monolito mientras escribe tokens
  const NS = 28;
  const pSalida = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), mats.rojo, NS);
  group.add(pSalida);

  // ------------------------------------------------------------ banco de herramientas
  const estaciones = {};
  for (const n of ESTACIONES) {
    const g = new THREE.Group();
    g.position.copy(estacionPos(n));
    g.lookAt(POS.modelo.x, 0, POS.modelo.z);
    group.add(g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.34, 32), mats.oscuro), g).position.y = 0.17;
    const tapa = add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 32), mats.metal), g);
    tapa.position.y = 0.36;
    const luz = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 48), new THREE.MeshStandardMaterial({color: P.rojo, emissive: P.rojo, emissiveIntensity: 0, roughness: 0.4}));
    luz.rotation.x = Math.PI / 2;
    luz.position.y = 0.38;
    g.add(luz);
    estaciones[n] = {g, luz};
  }
  const capsula = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.16, 6, 16), mats.rojo));
  capsula.visible = false;

  // ------------------------------------------------------------ subagentes
  const r = 0.2;
  const subs = SUBS.map((S, i) => {
    const g = new THREE.Group();
    g.position.copy(subPos(i));
    g.lookAt(POS.modelo.x, 0, POS.modelo.z);
    group.add(g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.07, r + 0.1, 0.16, 32), mats.metal), g).position.set(-0.26, 0.08, 0);
    const vid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, ALTO_DEP, 40, 1, true), mats.vidrio);
    vid.position.set(-0.26, 0.16 + ALTO_DEP / 2, 0);
    vid.renderOrder = 6;
    g.add(vid);
    for (const k of [0.25, 0.5, 0.75]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(r + 0.008, 0.006, 6, 40), mats.metal);
      aro.rotation.x = Math.PI / 2;
      aro.position.set(-0.26, 0.16 + k * ALTO_DEP, 0);
      g.add(aro);
    }
    const tapa = add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.08, 32), mats.metal), g);
    tapa.position.set(-0.26, 0.16 + ALTO_DEP + 0.04, 0);
    const liqMat = new THREE.MeshStandardMaterial({color: P.capas[3], roughness: 0.45, emissive: P.capas[3], emissiveIntensity: 0.3});
    const liq = add(new THREE.Mesh(new THREE.CylinderGeometry(r - 0.03, r - 0.03, 1, 32), liqMat), g);
    liq.position.x = -0.26;
    const nucleo = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), mats.oscuro.clone()), g);
    nucleo.position.set(0.22, 0.16 + 0.4, 0);
    const luzMat = new THREE.MeshStandardMaterial({color: P.rojo, emissive: P.rojo, emissiveIntensity: 0, roughness: 0.5});
    const ranura = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.03), luzMat);
    ranura.position.set(0.22, 0.66, 0.201);
    g.add(ranura);
    const ranura2 = ranura.clone();
    ranura2.position.y = 0.48;
    g.add(ranura2);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.5), mats.metal), g).position.set(0, 0.08, 0);
    // tubo desde el monolito
    const desde = new THREE.Vector3(0.72, 2.0, 0);
    const hasta = g.position.clone().add(new THREE.Vector3(0, 0.95, 0));
    const medio = desde.clone().lerp(hasta, 0.5).add(new THREE.Vector3(0, 1.1, 0));
    const curva = new THREE.CatmullRomCurve3([desde, medio, hasta]);
    add(new THREE.Mesh(new THREE.TubeGeometry(curva, 48, 0.03, 10), mats.tubo));
    const encargo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), mats.rojo);
    const aviso = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mats.blanco);
    group.add(encargo, aviso);
    return {g, liq, nucleo, luzMat, curva, encargo, aviso, vid};
  });

  // ------------------------------------------------------------ pose
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const S1 = new THREE.Vector3(1, 1, 1);
  const V = new THREE.Vector3();
  const nivel = (tokens) => (Math.max(0, tokens) / VENTANA) * ALTO_DEP;
  const ARR = HECHOS.arranque;
  const arranque = [ARR.sistema_tokens_aprox, ARR.herramientas_tokens_aprox, ARR.proyecto_y_mensaje_tokens_aprox];

  const update = (e, t, ops = {}) => {
    const abrir = ops.abrir ?? 0;
    // depósito principal: capas de arranque + conversación + franja escrita en esta llamada
    const p = e.principal;
    const total = p.ctx;
    const escritoT = Math.min(total, p.cache.escrita + p.cache.nueva);
    const partesTok = [...arranque, Math.max(0, total - escritoT - arranque.reduce((a, b) => a + b, 0))];
    // abrir: el vidrio se desvanece y las capas se separan para leerlas una a una
    const hueco = abrir * 0.14;
    let y = 0.22;
    partesTok.forEach((tok, i) => {
      const h = Math.max(0.006, nivel(tok));
      capas[i].scale.set(1, h, 1);
      capas[i].position.y = y + h / 2;
      y += h + hueco;
    });
    escrito.position.y = y - hueco + 0.01;
    escrito.scale.setScalar(1);
    escrito.scale.z = 1 + Math.min(4, escritoT / 2500);
    mats.rojo.emissiveIntensity = 0.6 + 0.4 * p.pulso;
    vidrio.material.opacity = 0.09 * (1 - 0.8 * abrir);
    for (const a of anillos) a.position.y = 0.22 + ALTO_DEP + 0.04;

    // modelo: las ranuras laten mientras piensa
    ranuraMat.emissiveIntensity = 0.12 + 1.1 * p.pulso * (0.75 + 0.25 * Math.sin(t * 9));

    // partículas de entrada: solo mientras se procesa una petición
    const flujo = p.fase === 'piensa' ? 1 : 0;
    for (let k = 0; k < NP; k++) {
      const u = (k / NP + t * 0.55) % 1;
      curvaEntrada.getPointAt(u, V);
      const s = flujo * (0.6 + 0.4 * Math.sin(k * 3.1));
      M.compose(V, Q, S1.clone().setScalar(Math.max(0.001, s)));
      pEntrada.setMatrixAt(k, M);
    }
    pEntrada.instanceMatrix.needsUpdate = true;
    // salida: fichas que suben y se apagan
    for (let k = 0; k < NS; k++) {
      const u = (k / NS + t * 0.35) % 1;
      const a = k * 2.399;
      V.set(Math.cos(a) * 0.3 * u, 2.95 + u * 1.1, Math.sin(a) * 0.3 * u);
      const s = flujo * (1 - u) * 1.0;
      M.compose(V, Q, S1.clone().setScalar(Math.max(0.001, s)));
      pSalida.setMatrixAt(k, M);
    }
    pSalida.instanceMatrix.needsUpdate = true;

    // herramientas: cápsula hacia la estación activa, luz encendida
    // ida (petición) en la primera mitad, vuelta (resultado) en la segunda
    const rec = p.reciente;
    const activa = rec ? ESTACION_DE[rec.herr] || 'Bash' : null;
    for (const n of ESTACIONES) estaciones[n].luz.material.emissiveIntensity = n === activa ? 0.4 + 1.0 * Math.sin(Math.PI * rec.k) : 0.05;
    capsula.visible = !!activa;
    if (activa) {
      const dest = estacionPos(activa);
      const k = rec.k < 0.5 ? ss(0, 0.45, rec.k) : 1 - ss(0.55, 1, rec.k);
      capsula.position.set(dest.x * k, 0.5 + Math.sin(Math.PI * k) * 0.6 + (rec.k > 0.45 && rec.k < 0.55 ? 0 : 0), 0.75 + (dest.z - 0.75) * k);
      capsula.material = rec.k < 0.5 ? mats.rojo : mats.blanco;
    }

    // subagentes
    subs.forEach((S, i) => {
      const s = e.subs[i];
      const h = Math.max(0.002, nivel(s.ctx));
      S.liq.scale.set(1, h, 1);
      S.liq.position.y = 0.16 + h / 2;
      S.liq.visible = s.estado !== 'apagado';
      const vivo = s.estado === 'trabaja' ? 1 : 0;
      S.luzMat.emissiveIntensity = vivo * (0.15 + 1.0 * s.pulso * (0.7 + 0.3 * Math.sin(t * 8 + i)));
      S.nucleo.material.color.set(s.estado === 'apagado' ? P.apagado : P.oscuro);
      S.liq.material.color.set(s.estado === 'terminado' ? P.capas[2] : P.capas[3]);
      // encargo (rojo) del monolito al subagente; aviso (blanco) de vuelta
      S.encargo.visible = s.encargo > 0 && s.encargo < 1;
      if (S.encargo.visible) S.curva.getPointAt(clamp(s.encargo, 0, 1), S.encargo.position);
      S.aviso.visible = s.aviso > 0 && s.aviso < 1;
      if (S.aviso.visible) S.curva.getPointAt(1 - clamp(s.aviso, 0, 1), S.aviso.position);
    });
    void ss;
  };

  // puntos de anclaje para las etiquetas de la consola
  const anclas = {
    deposito: () => [POS.deposito.x, 0.22 + nivel(0) + 2.4, POS.deposito.z + 0.8],
    nivel: (e) => [POS.deposito.x + 0.8, 0.22 + nivel(e.principal.ctx), POS.deposito.z],
    modelo: () => [0.7, 2.2, 0.7],
    capa: (i, e) => [POS.deposito.x + 0.78, 0.3 + i * 0.2, POS.deposito.z],
    banco: () => [estacionPos('Read').x, 0.6, estacionPos('Read').z],
    estacion: (n) => {
      const q = estacionPos(n);
      return [q.x, 0.42, q.z];
    },
    sub: (i) => {
      const q = subPos(i);
      return [q.x, 1.0, q.z];
    },
  };
  return {group, mats, partes, update, anclas, subs, estaciones};
}
