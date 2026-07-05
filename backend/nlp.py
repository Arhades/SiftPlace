"""Free-text intake parsing: "Anything else?" → structured search demands.

Two engines:
  1. `parse_rules` — dependency-free keyword/synonym parser driven by the
     **`nlp_terms.csv`** "bag of words" next to this file. Always available; the
     guaranteed fallback. Edit the vocabulary in the CSV — no code changes needed.
  2. `parse_llm`  — optional LLM extraction via the Anthropic API when
     ANTHROPIC_API_KEY is set (never required; falls back to rules on ANY error).

Both return the same shape so the caller/frontend doesn't care which ran:
{
  amenities:   [wifi|desk|kitchen|laundry|gympool, ...]
  nearby:      [gym|supermarket|transit|mall|flea_market, ...]
  types:       [condo|hostel|hotel, ...]
  vibe:        "quiet" | "lively" | None
  weight_nudges: {cost: int, location: int, living: int}   # -2..+2 soft nudges
  must_haves:  ["pet friendly", ...]   # demands we can't map to a known key
  detected:    ["🛒 supermarket nearby", ...]  # human-readable, shown to user
  engine:      "rules" | "llm"
}

CSV columns (nlp_terms.csv):
  kind,target,value,pattern,label
    kind=synonym  → target=bucket(amenities|nearby|types), value=key, label=human text
    kind=vibe     → value=quiet|lively
    kind=nudge    → target=axis(cost|location|living), value=delta(-2..2)
    kind=musthave → value=the demand label
"""
from __future__ import annotations

import csv
import json
import os
import pathlib
import re

import requests

AMENITY_KEYS = ["wifi", "desk", "kitchen", "laundry", "gympool"]
NEARBY_KEYS = ["gym", "supermarket", "transit", "mall", "flea_market"]
TYPE_KEYS = ["condo", "hostel", "hotel"]

_TERMS_CSV = pathlib.Path(__file__).parent / "nlp_terms.csv"


def _load_terms(path: pathlib.Path = _TERMS_CSV):
    """Load the keyword bag of words from CSV.

    Degrades gracefully to empty lists if the file is missing or a row is
    malformed (the LLM engine still works). Rules matched on lowercased text.
    """
    synonyms: list[tuple[str, str, str]] = []
    vibes: list[tuple[str, str]] = []
    nudges: list[tuple[str, str, int]] = []
    must_haves: list[tuple[str, str]] = []
    labels: dict[str, dict[str, str]] = {"amenities": {}, "nearby": {}, "types": {}}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                kind = (row.get("kind") or "").strip()
                pattern = (row.get("pattern") or "").strip()
                if not kind or not pattern:
                    continue
                target = (row.get("target") or "").strip()
                value = (row.get("value") or "").strip()
                label = (row.get("label") or "").strip()
                try:
                    re.compile(pattern)              # skip a broken regex, don't crash import
                except re.error:
                    continue
                if kind == "synonym":
                    synonyms.append((pattern, target, value))
                    if target in labels:
                        labels[target].setdefault(value, label or value)
                elif kind == "vibe":
                    vibes.append((pattern, value))
                elif kind == "nudge":
                    try:
                        nudges.append((pattern, target, int(value)))
                    except ValueError:
                        pass
                elif kind == "musthave":
                    must_haves.append((pattern, value))
    except FileNotFoundError:
        pass
    return synonyms, vibes, nudges, must_haves, labels


_SYNONYMS, _VIBES, _NUDGES, _MUST_HAVES, _LABELS = _load_terms()


def _empty(engine: str) -> dict:
    return {"amenities": [], "nearby": [], "types": [], "vibe": None,
            "weight_nudges": {"cost": 0, "location": 0, "living": 0},
            "must_haves": [], "detected": [], "engine": engine}


def parse_rules(text: str) -> dict:
    """Keyword/synonym extraction from the CSV bag of words. Deterministic, instant."""
    out = _empty("rules")
    t = (text or "").lower()
    if not t.strip():
        return out

    for pattern, bucket, key in _SYNONYMS:
        if key not in out[bucket] and re.search(pattern, t):
            out[bucket].append(key)
            out["detected"].append(_LABELS.get(bucket, {}).get(key, key))

    for pattern, vibe in _VIBES:
        if re.search(pattern, t):
            out["vibe"] = vibe
            out["detected"].append(f"{vibe} street vibe")
            break

    for pattern, axis, delta in _NUDGES:
        if re.search(pattern, t):
            cur = out["weight_nudges"][axis]
            out["weight_nudges"][axis] = max(-2, min(2, cur + delta))

    for axis, delta in out["weight_nudges"].items():
        if delta:
            out["detected"].append(f"{'more' if delta > 0 else 'less'} weight on {axis}")

    for pattern, label in _MUST_HAVES:
        if label not in out["must_haves"] and re.search(pattern, t):
            out["must_haves"].append(label)
            out["detected"].append(f"must have: {label}")

    return out


# ---- optional LLM engine (Anthropic) ----------------------------------------

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = os.environ.get("SIFTPLACE_NLP_MODEL", "claude-haiku-4-5-20251001")

_LLM_PROMPT = """Extract housing-search demands from a student's free-text note.
Return ONLY a JSON object, no prose, with these keys:
- "amenities": subset of ["wifi","desk","kitchen","laundry","gympool"]
- "nearby": subset of ["gym","supermarket","transit","mall","flea_market"]
- "types": subset of ["condo","hostel","hotel"]
- "vibe": "quiet" or "lively" or null
- "weight_nudges": {"cost": int, "location": int, "living": int} each in -2..2
  (+cost = they care about being cheap; +location = they care about being close;
   +living = they care about room quality/comfort)
- "must_haves": array of short strings for demands not covered above (e.g. "pet friendly")

Note from the student:
"""


def parse_llm(text: str) -> dict | None:
    """LLM extraction; None on any failure so the caller falls back to rules."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not (text or "").strip():
        return None
    try:
        r = requests.post(
            ANTHROPIC_URL,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": ANTHROPIC_MODEL, "max_tokens": 400,
                  "messages": [{"role": "user", "content": _LLM_PROMPT + text[:2000]}]},
            timeout=20,
        )
        r.raise_for_status()
        raw = "".join(b.get("text", "") for b in r.json().get("content", []))
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        data = json.loads(m.group(0))

        out = _empty("llm")
        out["amenities"] = [a for a in data.get("amenities", []) if a in AMENITY_KEYS]
        out["nearby"] = [n for n in data.get("nearby", []) if n in NEARBY_KEYS]
        out["types"] = [ty for ty in data.get("types", []) if ty in TYPE_KEYS]
        out["vibe"] = data.get("vibe") if data.get("vibe") in ("quiet", "lively") else None
        nudges = data.get("weight_nudges") or {}
        for axis in ("cost", "location", "living"):
            try:
                out["weight_nudges"][axis] = max(-2, min(2, int(nudges.get(axis, 0))))
            except (TypeError, ValueError):
                pass
        out["must_haves"] = [str(s)[:60] for s in data.get("must_haves", [])][:8]

        for bucket in ("amenities", "nearby", "types"):
            out["detected"] += [_LABELS.get(bucket, {}).get(k, k) for k in out[bucket]]
        if out["vibe"]:
            out["detected"].append(f"{out['vibe']} street vibe")
        for axis, delta in out["weight_nudges"].items():
            if delta:
                out["detected"].append(f"{'more' if delta > 0 else 'less'} weight on {axis}")
        out["detected"] += [f"must have: {s}" for s in out["must_haves"]]
        return out
    except Exception:
        return None


def parse_notes(text: str) -> dict:
    """Best available engine: LLM when configured, else the rules parser."""
    return parse_llm(text) or parse_rules(text)
