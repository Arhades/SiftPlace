"""Free-text intake parsing: "Anything else?" → structured search demands.

Two engines:
  1. `parse_rules` — dependency-free keyword/synonym parser. Always available;
     this is the guaranteed fallback.
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
"""
from __future__ import annotations

import json
import os
import re

import requests

AMENITY_KEYS = ["wifi", "desk", "kitchen", "laundry", "gympool"]
NEARBY_KEYS = ["gym", "supermarket", "transit", "mall", "flea_market"]
TYPE_KEYS = ["condo", "hostel", "hotel"]

# synonym -> (bucket, canonical key). Matched on word boundaries, first-win.
_SYNONYMS: list[tuple[str, str, str]] = [
    # amenities
    (r"wi-?fi|internet|broadband", "amenities", "wifi"),
    (r"desk|study (space|table)|workspace", "amenities", "desk"),
    (r"kitchen|cook(ing)?|stove", "amenities", "kitchen"),
    (r"laundry|washing machine|washer", "amenities", "laundry"),
    (r"pool|swimming|building gym|fitness (room|center|centre)", "amenities", "gympool"),
    # nearby wants
    (r"\bgym\b|muay thai|boxing|martial arts|dojo", "nearby", "gym"),
    (r"supermarket|grocery|groceries", "nearby", "supermarket"),
    (r"\bbts\b|\bmrt\b|train|metro|subway|skytrain|station", "nearby", "transit"),
    (r"\bmall\b|shopping cent(er|re)|department store", "nearby", "mall"),
    (r"(flea|night|street|weekend) market|market\b", "nearby", "flea_market"),
    # place types
    (r"condo(minium)?|apartment|studio\b|\bflat\b", "types", "condo"),
    (r"hostel|dorm(itory)?|shared room", "types", "hostel"),
    (r"hotel|serviced", "types", "hotel"),
]

_VIBES: list[tuple[str, str]] = [
    (r"quiet|peaceful|calm|residential|low-?key", "quiet"),
    (r"lively|nightlife|party|social|vibrant|busy street", "lively"),
]

# phrase -> weight nudge. Soft: ±2 max per axis, folded into the sliders server-side.
_NUDGES: list[tuple[str, str, int]] = [
    (r"cheap(est)?|budget|affordable|save money|as low as possible|tight on money", "cost", 2),
    (r"money('s| is)? (no|not an) (object|issue)|don't care about (price|cost)|price doesn'?t matter", "cost", -2),
    (r"luxur(y|ious)|high[- ]end|comfort(able)?|quality|nic(e|est) (place|room)|modern", "living", 2),
    (r"close to|near (campus|work|university|uni|office)|walking distance|short commute|hate commuting", "location", 2),
    (r"don't mind (commuting|travelling|traveling)|commute is fine|far is (ok|fine)", "location", -2),
]

# demands we recognise but can't map to a scoring key — surfaced as must_haves
_MUST_HAVES: list[tuple[str, str]] = [
    (r"pet|cat|dog", "pet friendly"),
    (r"balcony", "balcony"),
    (r"bathtub|bath tub", "bathtub"),
    (r"(city|river|nice) view", "a view"),
    (r"female[- ]only|women[- ]only", "female-only"),
    (r"non[- ]smoking|no smoking", "non-smoking"),
    (r"parking", "parking"),
    (r"elevator|lift\b", "elevator"),
    (r"air ?con(ditioning)?|a/c|\bac\b", "air conditioning"),
]

_LABELS = {
    "amenities": {"wifi": "fast wifi", "desk": "study desk", "kitchen": "kitchen",
                  "laundry": "laundry", "gympool": "building gym/pool"},
    "nearby": {"gym": "gym nearby", "supermarket": "supermarket nearby",
               "transit": "train/metro nearby", "mall": "mall nearby",
               "flea_market": "market nearby"},
    "types": {"condo": "condo/apartment", "hostel": "hostel", "hotel": "hotel"},
}


def _empty(engine: str) -> dict:
    return {"amenities": [], "nearby": [], "types": [], "vibe": None,
            "weight_nudges": {"cost": 0, "location": 0, "living": 0},
            "must_haves": [], "detected": [], "engine": engine}


def parse_rules(text: str) -> dict:
    """Keyword/synonym extraction. Deterministic, instant, no dependencies."""
    out = _empty("rules")
    t = (text or "").lower()
    if not t.strip():
        return out

    for pattern, bucket, key in _SYNONYMS:
        if re.search(pattern, t) and key not in out[bucket]:
            out[bucket].append(key)
            out["detected"].append(_LABELS[bucket][key])

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
        if re.search(pattern, t) and label not in out["must_haves"]:
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
            out["detected"] += [_LABELS[bucket][k] for k in out[bucket]]
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
