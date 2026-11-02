// La película «Dentro de Claude»: visita guiada a una pregunta real. El tiempo de la película se
// deforma sobre el de la traza (252 s reales en 42 s), deteniéndose en lo que hay que explicar y
// acelerando la espera. Todo lo demás sale de estadoAt(segundo de traza): película, página y sonido.
import {runSim} from 'teardown-kit/runtime.js';
import {DUR_TRAZA, estadoAt, ss} from './sesion.js';
import {createConsole, ROTULOS_REF} from './console.js';
import {createClaudeStage} from './stage.js';

import TIMELINE from '../claude-film/timeline.json';
import WARP_JSON from '../claude-film/warp.json';

export const DURATION = TIMELINE.duration;
// [segundo de película, segundo de traza]: tramos lineales y monótonos, compartidos con el sonido
export const WARP = WARP_JSON.tramos;
export const trazaAt = (tf) => {
  for (let i = 1; i < WARP.length; i++) {
    const [a, ta] = WARP[i - 1];
    const [b, tb] = WARP[i];
    if (tf <= b) return ta + (tb - ta) * Math.max(0, (tf - a) / (b - a));
  }
  return DUR_TRAZA;
};

/** Inversa: el primer segundo de película que muestra el segundo tt de la traza. */
export const filmAt = (tt) => {
  for (let i = 1; i < WARP.length; i++) {
    const [a, ta] = WARP[i - 1];
    const [b, tb] = WARP[i];
    if (tt <= tb && tb > ta) return a + (b - a) * Math.max(0, (tt - ta) / (tb - ta));
  }
  return WARP[WARP.length - 2][0];
};

// Guion del operador: vistas, abrir el depósito y los rótulos que explican cada momento.
const TL = TIMELINE;
export const SCRIPT = [
  {t: TL.pregunta, view: 'general', rotulo: 0},
  {t: TL.contexto, view: 'contexto', abrir: 1, rotulo: 1},
  {t: TL.modelo, view: 'modelo', abrir: 0, rotulo: 2},
  {t: TL.subagentes, view: 'subagentes', rotulo: 3},
  {t: TL.paralelo, view: 'general', rotulo: 4},
  {t: TL.resumen, view: 'subagentes', rotulo: 5},
  {t: TL.herramientas, view: 'herramientas', rotulo: 6},
  {t: TL.responder, view: 'general', rotulo: 7},
  {t: TL.final, view: 'general', rotulo: 8},
];
export const ROTULOS = [
  ['Una pregunta', 'llega a una ventana de contexto que ya trae la conversación, las herramientas y las instrucciones.'],
  ['La ventana de contexto', 'mide 1 millón de tokens. Casi todo lo que contiene se lee de caché: más rápido y unas 20 veces más barato.'],
  ['El modelo', 'relee todo el contexto en cada llamada y escribe la siguiente parte de la respuesta. Lo que hay dentro no es público.'],
  ['Subagentes', 'el agente principal encarga 5 tareas. Cada subagente arranca con su propio contexto, más pequeño y limpio.'],
  ['En paralelo', 'los subagentes leen, escriben y ejecutan a la vez. El principal espera sin gastar casi nada.'],
  ['Solo vuelve el resumen', 'cada subagente termina y envía un aviso. Su contexto completo no entra en el del principal.'],
  ['Herramientas', 'el modelo no ejecuta nada: pide una herramienta, Claude Code la ejecuta y le devuelve el resultado.'],
  ['Comprobar y responder', 'el principal revisa el trabajo con sus propias herramientas y escribe la respuesta.'],
  ['Una pregunta, por dentro', ''],
];

ROTULOS_REF.lista = ROTULOS;

const evAt = (key, t, init = 0) => {
  let v = init;
  for (const e of SCRIPT) if (key in e && e.t <= t) v = e[key];
  return v;
};
export const abrirAt = (t) => {
  let v = 0;
  let t0 = -9;
  let prev = 0;
  for (const e of SCRIPT) if ('abrir' in e && e.t <= t) {
    prev = v;
    v = e.abrir;
    t0 = e.t;
  }
  return prev + (v - prev) * ss(t0, t0 + 0.8, t);
};
export const rotuloAt = (t) => {
  const i = evAt('rotulo', t, 0);
  const e = SCRIPT.filter((x) => x.rotulo === i).pop();
  return {i, desde: t - (e ? e.t : 0)};
};
const VIEWS_LIST = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
export const scriptView = (t) => VIEWS_LIST.filter(([t0]) => t0 <= t).pop();

const deg = Math.PI / 180;
export const VIEW_FN = {
  general: (u) => ({tx: 1.5, ty: 1.25, tz: 0, az: (-62 + 0.6 * u) * deg, el: 22 * deg, d: 24.5, sx: -30, sy: -45}),
  contexto: (u) => ({tx: -3.0, ty: 1.35, tz: 0.2, az: (-70 + 0.8 * u) * deg, el: 13 * deg, d: 15.5, sx: 110, sy: -45}),
  modelo: (u) => ({tx: -1.0, ty: 1.45, tz: 0.4, az: (-42 - 0.7 * u) * deg, el: 16 * deg, d: 17.5, sx: 20, sy: -45}),
  subagentes: (u) => ({tx: 3.3, ty: 1.2, tz: -0.4, az: (-40 - 0.6 * u) * deg, el: 26 * deg, d: 21, sx: -20, sy: -40}),
  herramientas: (u) => ({tx: -0.2, ty: 0.9, tz: 1.3, az: (-74 + 0.7 * u) * deg, el: 26 * deg, d: 16.5, sx: 0, sy: -50}),
};
export const VIEW_KEYS = Object.keys(VIEW_FN);
export const viewAt = (t) => {
  const [t0, v] = scriptView(t);
  return VIEW_FN[v](t - t0);
};

// ------------------------------------------------------------ el cursor del operador (visita)
const REST = [[800, 420], [700, 470], [900, 380], [760, 520], [640, 420]];
export function makeCursor() {
  const HOPS = SCRIPT.map((e) => e.t);
  return (t) => {
    let i = 0;
    while (i < HOPS.length - 1 && HOPS[i + 1] <= t) i++;
    const a = REST[i % REST.length];
    const b = REST[(i + 1) % REST.length];
    const k = ss(HOPS[i] + 0.2, HOPS[Math.min(HOPS.length - 1, i + 1)] - 0.4, t);
    return {x: a[0] + (b[0] - a[0]) * k + 14 * Math.sin(t * 0.9), y: a[1] + (b[1] - a[1]) * k + 9 * Math.sin(t * 1.35 + 2), press: Math.abs(Math.sin(t * 0.75)) > 0.985, drag: false, ring: 0, ringX: -99, ringY: -99};
  };
}

/** Un fotograma de consola: estado + rótulo + etiquetas sobre la máquina. */
export function makeConsoleFrame(ui, st) {
  const cursorAt = makeCursor();
  return (tf, ops) => {
    const tt = ops.tt ?? trazaAt(tf);
    const est = ops.est ?? estadoAt(tt);
    ui.update({
      est,
      tt,
      view: ops.view,
      since: ops.since ?? 0,
      abrir: ops.abrir ?? abrirAt(tf),
      rotulo: ops.rotulo ?? rotuloAt(tf),
      viewOn: Object.fromEntries(VIEW_KEYS.map((k) => [k, k === ops.view ? 1 : 0])),
      project: st.project,
      anclas: st.maquina.anclas,
      cursor: ops.cursor ?? cursorAt(tf),
      paused: !!ops.paused,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createClaudeStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const frame = makeConsoleFrame(ui, st);
    window.CLAUDE_ST = st;
    return {
      resize,
      render(t) {
        const tt = trazaAt(t);
        const est = estadoAt(tt);
        const [t0, view] = scriptView(t);
        st.frame(est, tt, viewAt(t), {abrir: abrirAt(t)});
        frame(t, {view, since: t - t0, tt, est});
        return {};
      },
    };
  };
}

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'dark', hud: {enabled: false, title: 'claude', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const run = () => runSim(DEFAULTS, makeFilm());
