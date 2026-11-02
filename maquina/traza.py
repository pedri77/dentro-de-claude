"""Extrae la traza anonimizada de UN turno de una sesión de Claude Code: solo tiempos, tokens y
nombres de herramientas. Nada de texto, rutas ni argumentos. Los tipos de agente propios se
generalizan («agente propio»); solo se conservan los integrados de Claude Code.

Uso: python3 -I traza.py <sesion.jsonl> <n_turno> > ../claude-film/traza.json
"""
import json, sys
from pathlib import Path
from turnos import es_pregunta, ts

INTEGRADOS = {"general-purpose", "Explore", "Plan", "claude-code-guide", "statusline-setup"}
# Herramientas de MCP: se agrupan por servidor genérico, sin nombre de cuenta ni servicio.
def nombre_herr(n):
    if n.startswith("mcp__"):
        return "MCP"
    return n


def uso(m):
    u = m.get("usage") or {}
    return {
        "entrada": u.get("input_tokens", 0),
        "cache_leida": u.get("cache_read_input_tokens", 0),
        "cache_escrita": u.get("cache_creation_input_tokens", 0),
        "cache_escrita_1h": (u.get("cache_creation") or {}).get("ephemeral_1h_input_tokens", 0),
        "salida": u.get("output_tokens", 0),
    }


def llamadas(evs, t0):
    """Agrupa los eventos assistant por id de mensaje: una entrada por llamada al modelo."""
    por_id, orden = {}, []
    for e in evs:
        if e.get("type") != "assistant":
            continue
        m = e.get("message") or {}
        i = m.get("id")
        if i not in por_id:
            por_id[i] = {"t": round(ts(e) - t0, 2), "modelo": m.get("model"), "uso": uso(m), "herr": [], "ids": []}
            orden.append(i)
        c = por_id[i]
        c["fin"] = round(ts(e) - t0, 2)
        if (m.get("usage") or {}).get("output_tokens"):
            c["uso"] = uso(m)  # el último bloque trae el recuento final
        for b in m.get("content") or []:
            if isinstance(b, dict) and b.get("type") == "tool_use":
                # Claude Code ejecuta cada herramienta al cerrarse su bloque, no al acabar el mensaje.
                c["herr"].append((nombre_herr(b.get("name")), round(ts(e) - t0, 2)))
                c["ids"].append(b.get("id"))
    return [por_id[i] for i in orden]


def resultados(evs, t0):
    r = {}
    for e in evs:
        m = e.get("message") or {}
        if e.get("type") == "user" and isinstance(m.get("content"), list):
            for b in m["content"]:
                if isinstance(b, dict) and b.get("type") == "tool_result":
                    r[b.get("tool_use_id")] = round(ts(e) - t0, 2)
    return r


def main(ruta, n):
    ruta = Path(ruta)
    evs = [json.loads(l) for l in open(ruta) if l.strip()]
    evs = [e for e in evs if "timestamp" in e and not e.get("isSidechain")]
    idx = [i for i, e in enumerate(evs) if es_pregunta(e)]
    a, b = idx[n], (idx[n + 1] if n + 1 < len(idx) else len(evs))
    turno = evs[a:b]
    t0 = ts(turno[0])
    res = resultados(turno, t0)
    calls = llamadas(turno, t0)
    herr = []
    for c in calls:
        for (nombre, t), i in zip(c.pop("herr"), c.pop("ids")):
            herr.append({"herr": nombre, "t": t, "fin": res.get(i), "id": i})

    # subagentes: metadatos que apuntan a un tool_use de este turno
    sub = []
    carpeta = ruta.with_suffix("") / "subagents"
    ids_turno = {h["id"] for h in herr}
    for meta in sorted(carpeta.glob("*.meta.json")):
        mj = json.loads(meta.read_text())
        if mj.get("toolUseId") not in ids_turno:
            continue
        sevs = [json.loads(l) for l in open(meta.with_name(meta.name.replace(".meta.json", ".jsonl"))) if l.strip()]
        sevs = [e for e in sevs if "timestamp" in e]
        scalls = llamadas(sevs, t0)
        sres = resultados(sevs, t0)
        sherr = []
        for c in scalls:
            for (nombre, t), i in zip(c.pop("herr"), c.pop("ids")):
                sherr.append({"herr": nombre, "t": t, "fin": sres.get(i)})
        tipo = mj.get("agentType")
        sub.append({
            "tipo": tipo if tipo in INTEGRADOS else "agente propio",
            "lanzado": next(h["t"] for h in herr if h["id"] == mj["toolUseId"]),
            # en segundo plano, el resultado inmediato es solo el acuse; el final real es su último evento
            "acuse": res.get(mj["toolUseId"]),
            "termina": round(max(ts(e) for e in sevs) - t0, 2),
            "segundo_plano": mj.get("requestShape") == "background",
            "llamadas": scalls,
            "herramientas": sherr,
        })
    for h in herr:
        h.pop("id")
    fin = max([c["fin"] for c in calls] + [s["termina"] for s in sub])
    print(json.dumps({
        "fuente": "Sesión real de Claude Code anonimizada: solo tiempos, tokens y nombres de herramientas.",
        "duracion_s": fin,
        "llamadas": calls,
        "herramientas": herr,
        "subagentes": sorted(sub, key=lambda s: s["lanzado"]),
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
