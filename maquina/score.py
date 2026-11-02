"""Banda sonora de «Dentro de Claude»: una cama grave y tranquila (La menor, 72 bpm) y acentos que
salen de la sesión real, nunca de tiempos tecleados:

- un blip por cada llamada del agente principal al modelo (cuando empieza a escribir),
- un tic seco por cada herramienta que usa el principal; los de los subagentes, casi inaudibles,
- un pop ascendente por cada subagente lanzado y una campanita cuando devuelve su resumen,
- un zumbido que crece con cuántas líneas (principal + subagentes) piensan a la vez,
- un clic por cada cambio de vista de la visita.

Los segundos de la traza pasan a segundos de película con claude-film/warp.json (el mismo que usa
film.js). Uso, desde ~/Dev/Claude_proyectos/Claude/teardown:

    python3 ~/.agents/skills/teardown/run_sfx.py claude-shared/score.py
"""

import json
import os

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import blip, chime, click, pop

TIMELINE = "../claude-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "claude-score.wav")
TARGET_LUFS = -14.0
SEED = 23

AQUI = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(AQUI, "../claude-film/warp.json")) as f:
    WARP = json.load(f)["tramos"]
with open(os.path.join(AQUI, "../claude-film/traza.json")) as f:
    TRAZA = json.load(f)

CHORDS = chords("Am9:A1 E2 G2 C3 B3/A0", "Fmaj7#11:F1 C2 E2 A2 B2/F0", "Cmaj9:C2 G2 B2 D3 E3/C1", "Gsus2:G1 D2 A2 D3/G0")
MOTIF = [(0.5, hz("E4")), (1.5, hz("C4")), (2.5, hz("B3"))]
NOTA_SUB = [hz(n) for n in ("A4", "C5", "E5", "G5", "B5")]  # una nota por subagente, misma tonalidad


def film_at(tt):
    """Primer segundo de película que muestra el segundo tt de la traza (inversa de warp.json)."""
    for (a, ta), (b, tb) in zip(WARP, WARP[1:]):
        if tt <= tb and tb > ta:
            return a + (b - a) * max(0.0, (tt - ta) / (tb - ta))
    return WARP[-2][0]


def spans():
    """Tramos [inicio, fin] de traza en que cada línea está pidiendo al modelo."""
    out = [(c["t"] - 1.5, c["fin"]) for c in TRAZA["llamadas"]]
    for s in TRAZA["subagentes"]:
        out += [(c["t"] - 1.5, c["fin"]) for c in s["llamadas"]]
    return out


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, _ = bed(dur, 72, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.45, keys_lp=2600)
    mix.put_stereo(0, left, right, 0.085)
    mix.put(0, low, 0.09)
    mix.put(0, airy(dur, 260, 420, 0.4), 0.012)

    # zumbido de cómputo: un segmento por cada medio segundo de película, más fuerte cuantas más líneas piensan
    sp = spans()
    paso = 0.5
    t = 0.0
    while t < dur - paso:
        a, b = WARP_tt(t), WARP_tt(t + paso)
        vivas = sum(1 for (s0, s1) in sp if s0 < b and s1 > a)
        if vivas:
            mix.put(t, motor(paso + 0.08, f0=hz("A2") * (1 + 0.02 * min(vivas, 6)), grit_hz=900, wobble=6), 0.004 + 0.0035 * min(vivas, 6))
        t += paso

    # el principal: un blip por llamada (en el instante en que empieza a escribir), un tic por herramienta
    for c in TRAZA["llamadas"]:
        tf = film_at(c["t"])
        if tf < dur - 0.3:
            mix.put(tf, blip(hz("E5"), 0.22, 0.07), 0.045)
    for h in TRAZA["herramientas"]:
        tf = film_at(h["t"])
        if h["herr"] == "Agent":
            continue  # el lanzamiento suena como pop del subagente
        mix.put(tf, click(2600, 0.02), 0.05)

    # subagentes: pop al lanzarse, tics muy suaves de sus herramientas, campanita al devolver el resumen
    for i, s in enumerate(TRAZA["subagentes"]):
        mix.put(film_at(s["lanzado"]), pop(hz("A3"), NOTA_SUB[i], 0.18), 0.05)
        for h in s["herramientas"]:
            mix.put(film_at(h["t"]), click(3400, 0.012), 0.012)
        mix.put(film_at(s["termina"]), chime([NOTA_SUB[i], NOTA_SUB[i] * 1.5], 1.4, 0.5), 0.035)

    # la visita: un clic por cambio de vista; abrir el depósito, un golpe suave de cristal
    for k, v in tl.items():
        if k != "duration" and 0 < v < dur:
            mix.put(v, click(2200, 0.025), 0.04)
    mix.put(tl["contexto"] + 0.1, thud(180, 0.04, 0.3), 0.04)
    # la respuesta: un acorde final
    mix.put(tl["final"], chime([hz("A4"), hz("C5"), hz("E5")], 2.6, 0.9), 0.05)


def WARP_tt(tf):
    """Segundo de traza que muestra el segundo tf de película."""
    for (a, ta), (b, tb) in zip(WARP, WARP[1:]):
        if tf <= b:
            return ta + (tb - ta) * max(0.0, (tf - a) / (b - a))
    return WARP[-1][1]
