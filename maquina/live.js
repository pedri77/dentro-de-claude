// La página en vivo de «Dentro de Claude»: la consola sobre el estudio, en tiempo real. La única entrada
// es el segundo de la sesión real: el deslizador, las flechas o un clic en la línea de tiempo lo mueven,
// y todo lo demás sale de estadoAt(). Vistas 1-5, A abre el depósito, ESPACIO pausa; órbita con arrastre
// y zoom con la rueda. Sin tocar, la página se enseña sola con el guion de la película y un cursor;
// cualquier gesto cede el control y 25 s de calma lo devuelven.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, VIEW_NAMES} from './console.js';
import {DURATION, VIEW_FN, abrirAt, filmAt, makeConsoleFrame, makeCursor, rotuloAt, scriptView, trazaAt} from './film.js';
import {DUR_TRAZA, clamp, estadoAt} from './sesion.js';
import {createClaudeStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const VELOCIDAD = 8; // segundos de traza por segundo real cuando el visitante lo maneja
const VIEW_KEYS = Object.keys(VIEW_NAMES);
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = `
html,body{background:#0f0f18;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.vb{pointer-events:auto;cursor:pointer}
.vb:hover{color:#f1f1f1!important;border-color:#ef4444!important}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:48px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 12px;border:1px solid #3a3a50;border-radius:999px;background:rgba(26,26,46,.94);color:#f1f1f1;font:700 8.5px Inter,sans-serif;letter-spacing:1.4px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#ef4444}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#a4a7ba;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.portada{position:fixed;left:0;right:0;top:0;padding:18px 20px 14px;background:rgba(26,26,46,.97);border-bottom:1px solid #3a3a50;color:#f1f1f1;font-family:Inter,system-ui,sans-serif;display:none;z-index:60}
.portada h1{margin:0 0 6px;font:400 26px/1.1 'DM Serif Display',Georgia,serif}
.portada h1 b{color:#ef4444;font-weight:400}
.portada .n{font:700 22px/1.1 'JetBrains Mono',monospace;color:#ef4444;margin:10px 0 2px}
.portada .s{font:600 11px/1.5 Inter,system-ui,sans-serif;letter-spacing:.6px;color:#a4a7ba;text-transform:uppercase}
.portada .f{font:500 11px/1.5 Inter,system-ui,sans-serif;color:#a4a7ba;margin-top:6px}
.portada div{white-space:normal}
@media (orientation:portrait) and (max-width:820px){.portada{display:block}}
`;

// en vertical (móvil) la consola queda pequeña: lo esencial va en una portada legible
function portada(T) {
  const nf = (x) => Math.round(x).toLocaleString('es-ES');
  const el = document.createElement('div');
  el.className = 'portada';
  el.innerHTML = `<h1>Dentro de <b>Claude</b></h1>
    <div class="s">Una pregunta real a Claude Code, por dentro</div>
    <div class="n">${T.llamadas} llamadas · 5 subagentes</div>
    <div class="s">${nf(T.leida)} tokens leídos de caché</div>
    <div class="f">Coste equivalente en API: ${T.coste.toLocaleString('es-ES', {maximumFractionDigits: 2})} $ · sin caché, ${T.sinCache.toLocaleString('es-ES', {maximumFractionDigits: 2})} $</div>`;
  document.body.appendChild(el);
}

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);

  const st = createClaudeStage({canvas});
  const ui = createConsole(app);
  const tourCursorAt = makeCursor();
  portada(estadoAt(DUR_TRAZA));

  const TIERS = [
    {samples: 8, shadow: 4096, blur: 20, radius: 7, ao: 16, pcf: false, bloom: true, pr: 2},
    {samples: 4, shadow: 2048, blur: 10, radius: 5, ao: 8, pcf: false, bloom: true, pr: 1.5},
    {samples: 0, shadow: 1024, blur: 6, radius: 2, ao: 0, pcf: true, bloom: false, pr: 1.1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let fitReady = false;
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    if (fitReady) fit();
  };
  applyTier();

  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  addEventListener('resize', fit);
  fit();
  fitReady = true;
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const turnNote = document.createElement('div');
  turnNote.className = 'turn';
  turnNote.textContent = 'Gira el móvil para ver la consola completa';
  document.body.appendChild(turnNote);
  // zonas para arrastrar el tiempo: el deslizador y la línea de tiempo
  const [kx0, ky] = ui.knobAt(0);
  const [kx1] = ui.knobAt(DUR_TRAZA);
  const sliderHit = document.createElement('div');
  sliderHit.className = 'hit';
  Object.assign(sliderHit.style, {left: `${kx0 - 12}px`, top: `${ky - 13}px`, width: `${kx1 - kx0 + 24}px`, height: '26px'});
  ui.root.appendChild(sliderHit);
  const tlHit = document.createElement('div');
  tlHit.className = 'hit';
  Object.assign(tlHit.style, {left: `${ui.TL.x + 120}px`, top: `${ui.TL.y + 26}px`, width: `${ui.TL.w - 140}px`, height: `${ui.TL.h - 34}px`});
  ui.root.appendChild(tlHit);

  // ------------------------------------------------------------ estado
  let T = 0;
  let tt = 0; // segundo de la traza que se muestra
  let paused = false;
  let abrir = 0;
  let abrirTarget = 0;
  let view = 'general';
  let viewAt0 = 0;
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.general(0)};
  let ring = {t: -9, x: 0, y: 0};
  const frameConsole = makeConsoleFrame(ui, st);
  const pulse = (key) => {
    const r = ui.btn[key].getBoundingClientRect();
    const [x, y] = toStage(r.left + r.width / 2, r.top + r.height / 2);
    ring = {t: T, x, y};
  };
  const setView = (v) => {
    if (v === view) return;
    view = v;
    viewAt0 = T;
  };

  // ------------------------------------------------------------ visita automática
  const AP = {on: true, t0: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    abrirTarget = abrir > 0.5 ? 1 : 0;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', takeOver);
  for (const k of VIEW_KEYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      setView(k);
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  ui.btn.abrir.addEventListener('click', () => {
    takeOver();
    pulse('abrir');
    abrirTarget = abrirTarget > 0.5 ? 0 : 1;
    if (abrirTarget) setView('contexto');
  });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulse('pause');
    paused = !paused;
  });
  const arrastre = (hit, aT) => {
    const onMove = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      tt = clamp(aT(x), 0, DUR_TRAZA);
      lastInput = T;
    };
    hit.addEventListener('pointerdown', (e) => {
      takeOver();
      paused = true;
      hit.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', up);
      onMove(e);
    });
  };
  arrastre(sliderHit, (x) => ((x - kx0) / (kx1 - kx0)) * DUR_TRAZA);
  arrastre(tlHit, (x) => ui.timelineX(x));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'general', 2: 'contexto', 3: 'modelo', 4: 'subagentes', 5: 'herramientas'}[key];
    if (v) ui.btn[v].click();
    else if (key === 'a') ui.btn.abrir.click();
    else if (key === ' ') ui.btn.pause.click();
    else if (key === 'arrowright' || key === 'arrowleft') {
      takeOver();
      tt = clamp(tt + (key === 'arrowright' ? 5 : -5), 0, DUR_TRAZA);
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / scale;
    const dy = (e.clientY - drag.y) / scale;
    drag = {x: e.clientX, y: e.clientY};
    off.az -= dx * 0.3;
    off.el = clamp(off.el + dy * 0.2, -5, 70);
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.45, 2.4);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ el fotograma
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.4) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let since = T - viewAt0;
    let cursor;
    let rotulo;
    if (AP.on) {
      const c = T - AP.t0;
      const cyc = c - Math.floor(c / DURATION) * DURATION;
      const [t0, v] = scriptView(cyc);
      view = v;
      since = cyc - t0;
      viewAt0 = T - since;
      tt = trazaAt(cyc);
      abrirTarget = abrirAt(cyc) > 0.5 ? 1 : 0;
      cursor = tourCursorAt(cyc);
      rotulo = rotuloAt(cyc);
    } else {
      if (T - lastInput > IDLE) startTour();
      if (!paused) tt = Math.min(DUR_TRAZA, tt + dt * VELOCIDAD);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, drag: !!drag, ring: rk, ringX: ring.x, ringY: ring.y};
      // a mano, el rótulo es el del momento de la sesión que se está viendo
      rotulo = {...rotuloAt(filmAt(tt)), desde: 9};
    }
    abrir += (abrirTarget - abrir) * (1 - Math.exp(-dt / 0.25));
    const est = estadoAt(tt);

    const tgt = VIEW_FN[view](since);
    tgt.az += off.az * (Math.PI / 180);
    tgt.el = clamp(tgt.el + off.el * (Math.PI / 180), 0.02, 1.4);
    tgt.d *= off.k;
    const k = 1 - Math.exp(-dt / 0.55);
    const dAz = wrapDeg((tgt.az - cam.az) * (180 / Math.PI)) * (Math.PI / 180);
    cam.az += dAz * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    // el reloj visual (partículas, latidos) sigue corriendo aunque la traza esté en pausa
    st.frame(est, T, cam, {abrir});
    frameConsole(T, {view, since, abrir, est, tt, cursor: {...cursor, drag: !!drag}, rotulo, paused: paused && !AP.on});

    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>VISITA AUTOMÁTICA · TOCA PARA TOMAR EL CONTROL' : '▶ REANUDAR VISITA';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }};
}
