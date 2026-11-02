"""Lista los turnos (una pregunta del usuario y todo lo que desencadena) de una sesión de
Claude Code, con números solamente: duración, llamadas al modelo, herramientas y subagentes.
No imprime contenido de mensajes. Uso: python3 -I turnos.py <sesion.jsonl> [<sesion2.jsonl> …]"""
import json, sys
from datetime import datetime
from pathlib import Path


def ts(e):
    return datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")).timestamp()


def es_pregunta(e):
    if e.get("type") != "user" or e.get("isMeta") or e.get("isSidechain"):
        return False
    c = (e.get("message") or {}).get("content")
    if isinstance(c, str):
        return not c.startswith(("<command", "<local-command", "<bash-", "<task-notification"))
    if isinstance(c, list):
        return any(isinstance(b, dict) and b.get("type") == "text" and not b.get("text", "").startswith("<") for b in c) and not any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in c)
    return False


def turnos(ruta):
    evs = [json.loads(l) for l in open(ruta) if l.strip()]
    evs = [e for e in evs if "timestamp" in e]
    actual = None
    for e in evs:
        if es_pregunta(e):
            if actual:
                yield actual
            actual = {"t0": ts(e), "t1": ts(e), "llamadas": set(), "herr": {}, "agentes": 0}
            continue
        if not actual or e.get("type") != "assistant":
            continue
        m = e.get("message") or {}
        actual["t1"] = ts(e)
        actual["llamadas"].add(m.get("id"))
        for b in m.get("content") or []:
            if isinstance(b, dict) and b.get("type") == "tool_use":
                n = b.get("name")
                actual["herr"][n] = actual["herr"].get(n, 0) + 1
                if n in ("Agent", "Task"):
                    actual["agentes"] += 1
    if actual:
        yield actual


if __name__ == '__main__':
    for ruta in sys.argv[1:]:
        for i, t in enumerate(turnos(ruta)):
            if t["agentes"] < 2:
                continue
            dur = t["t1"] - t["t0"]
            top = sorted(t["herr"].items(), key=lambda x: -x[1])[:5]
            print(f"{Path(ruta).stem[:8]} turno {i:3d}  {dur/60:5.1f} min  llamadas {len(t['llamadas']):3d}  agentes {t['agentes']:2d}  {top}")
