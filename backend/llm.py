"""The Sift mascot's brain: conversation + free-text -> structured demands.

Fallback chain, all SERVER-SIDE (keys never reach the browser), never raises:

  1. **Agnes AI** (primary — the competition's "creative use of Agnes AI"
     criterion; free tier). Spoken to over an OpenAI-compatible
     chat-completions endpoint; base URL / model / key all come from env so
     the integration survives API-shape changes without a code change.
  2. **OpenAI** (fallback when Agnes is down or rate-limited).
  3. **nlp.py rules + trained model** (final offline fallback — free,
     deterministic, cannot fail).

Every engine returns the SAME parsed shape nlp.parse_notes returns
(amenities / nearby / types / vibe / weight_nudges / must_haves / detected /
engine) so the caller never cares which one answered. LLM output is treated
as untrusted: strict JSON extraction + whitelist validation against the same
keys nlp.py knows.
"""
from __future__ import annotations

import json
import os
import re

import requests

from nlp import AMENITY_KEYS, NEARBY_KEYS, TYPE_KEYS, parse_notes
from usage import count_api_call

TIMEOUT_S = 18

# Human-readable chip labels for "detected" (mirrors nlp_terms.csv labels)
_PRETTY = {
    "wifi": "fast wifi", "desk": "study desk", "kitchen": "kitchen",
    "laundry": "laundry", "gympool": "building gym/pool",
    "gym": "🥊 gym nearby", "supermarket": "🛒 supermarket nearby",
    "transit": "🚆 transit nearby", "mall": "🛍️ mall nearby",
    "flea_market": "🎏 flea market nearby",
    "condo": "condo / apartment", "hostel": "hostel", "hotel": "serviced hotel",
}

SYSTEM_PROMPT = """You are Sift, SiftPlace's friendly mascot — a warm, student-savvy guide who helps
international students find a home in Bangkok (or any city). You chat naturally, keep replies to 1-3
short sentences, and gently guide first-timers ("Tell me about your ideal place and I'll set the
filters for you"). Never invent listings or prices.

Besides replying, you extract the user's housing demands into structured filters.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{
  "reply": "<your short conversational reply>",
  "demands": {
    "amenities": [],        // subset of: wifi, desk, kitchen, laundry, gympool
    "nearby": [],           // subset of: gym, supermarket, transit, mall, flea_market
    "types": [],            // subset of: condo, hostel, hotel
    "vibe": null,           // "quiet" | "lively" | null
    "weight_nudges": {"cost": 0, "location": 0, "living": 0},   // each -2..2
    "must_haves": []        // short strings for demands that fit no key above, e.g. "pet friendly"
  }
}

Extraction rules: only include demands from THIS conversation; "cheap"/"tight budget" -> cost nudge +1
or +2; "hate long commutes"/"close to campus" -> location nudge; "near a Muay Thai gym" -> nearby gym;
a real desk -> desk; quiet street -> vibe quiet. When the user asks a question, answer it in reply and
extract nothing new. Acknowledge in reply what you extracted ("Got it — quiet street + near a gym")."""


# --- engine configs (env only; every one optional) --------------------------------

def _agnes_config() -> dict | None:
    key = os.environ.get("AGNES_API_KEY", "").strip()
    if not key:
        return None
    return {
        "name": "agnes",
        "url": os.environ.get("AGNES_API_URL",
                              "https://api.agnes-ai.com/v1/chat/completions").strip(),
        "key": key,
        "model": os.environ.get("AGNES_MODEL", "agnes-chat").strip(),
    }


def _openai_config() -> dict | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    return {
        "name": "openai",
        "url": os.environ.get("OPENAI_API_URL",
                              "https://api.openai.com/v1/chat/completions").strip(),
        "key": key,
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip(),
    }


def llm_available() -> bool:
    return _agnes_config() is not None or _openai_config() is not None


def _post_chat(config: dict, messages: list[dict]) -> str | None:
    """One OpenAI-compatible chat-completions call. None on any failure."""
    try:
        count_api_call(config["name"])
        resp = requests.post(
            config["url"],
            headers={"Authorization": f"Bearer {config['key']}",
                     "Content-Type": "application/json"},
            json={"model": config["model"], "messages": messages,
                  "temperature": 0.4, "max_tokens": 500},
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


# --- untrusted-output hygiene -------------------------------------------------------

def _extract_json(text: str) -> dict | None:
    """Pull the first JSON object out of an LLM reply (tolerates code fences
    and prose around it). None when nothing parses."""
    if not text:
        return None
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start:end + 1])
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _clean_demands(raw) -> dict:
    """Whitelist-validate LLM 'demands' into the exact nlp.parse_notes shape."""
    out = {"amenities": [], "nearby": [], "types": [], "vibe": None,
           "weight_nudges": {"cost": 0, "location": 0, "living": 0},
           "must_haves": [], "detected": [], "engine": "llm"}
    if not isinstance(raw, dict):
        return out
    for bucket, allowed in (("amenities", AMENITY_KEYS),
                            ("nearby", NEARBY_KEYS),
                            ("types", TYPE_KEYS)):
        values = raw.get(bucket)
        if isinstance(values, list):
            for value in values:
                key = str(value).strip().lower()
                if key in allowed and key not in out[bucket]:
                    out[bucket].append(key)
                    out["detected"].append(_PRETTY.get(key, key))
    vibe = raw.get("vibe")
    if isinstance(vibe, str) and vibe.strip().lower() in ("quiet", "lively"):
        out["vibe"] = vibe.strip().lower()
        out["detected"].append(f"{out['vibe']} street vibe")
    nudges = raw.get("weight_nudges")
    if isinstance(nudges, dict):
        for axis in ("cost", "location", "living"):
            try:
                delta = int(nudges.get(axis, 0))
            except (TypeError, ValueError):
                delta = 0
            out["weight_nudges"][axis] = max(-2, min(2, delta))
            if out["weight_nudges"][axis]:
                out["detected"].append(
                    f"{'more' if out['weight_nudges'][axis] > 0 else 'less'} weight on {axis}")
    must = raw.get("must_haves")
    if isinstance(must, list):
        for item in must[:5]:
            label = str(item).strip()[:60]
            if label and label not in out["must_haves"]:
                out["must_haves"].append(label)
                out["detected"].append(f"must have: {label}")
    return out


# --- public entry points --------------------------------------------------------------

def _fallback_reply(user_text: str) -> dict:
    """Engine 3: nlp.py rules + trained model, with a templated reply. The
    guaranteed floor — instant, offline, deterministic."""
    parsed = parse_notes(user_text)
    parsed["engine"] = f"rules-fallback({parsed.get('engine', 'rules')})"
    if parsed["detected"]:
        got = ", ".join(parsed["detected"][:4])
        reply = (f"Got it — I've set: {got}. Anything else that matters — "
                 "budget, area, or how you'll commute?")
    else:
        reply = ("Tell me about your ideal place in your own words — e.g. "
                 "\"quiet street near Chula, under ฿15k, with a real desk\" — "
                 "and I'll set the filters for you.")
    return {"reply": reply, "parsed": parsed, "engine": parsed["engine"]}


def chat_reply(messages: list[dict], filters_summary: str | None = None) -> dict:
    """One mascot turn: {reply, parsed, engine}. Chain Agnes -> OpenAI ->
    nlp.py rules. Never raises, always returns the full parsed shape."""
    user_text = next((m["content"] for m in reversed(messages)
                      if m.get("role") == "user"), "")

    system = SYSTEM_PROMPT
    if filters_summary:
        system += f"\n\nFilters already set (don't re-ask about these): {filters_summary}"
    llm_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]} for m in messages][-12:]

    for config in filter(None, (_agnes_config(), _openai_config())):
        content = _post_chat(config, llm_messages)
        if content is None:
            continue
        payload = _extract_json(content)
        if payload is None:
            # the model answered but off-contract — still usable as a reply;
            # extract demands with the offline parser so filters keep working
            parsed = parse_notes(user_text)
            parsed["engine"] = f"{config['name']}+rules"
            return {"reply": content.strip()[:600], "parsed": parsed,
                    "engine": parsed["engine"]}
        parsed = _clean_demands(payload.get("demands"))
        parsed["engine"] = config["name"]
        reply = str(payload.get("reply") or "").strip()[:600]
        if not reply:
            reply = "Noted! Anything else that matters for your place?"
        return {"reply": reply, "parsed": parsed, "engine": config["name"]}

    return _fallback_reply(user_text)


def explain_listings(query: str, listings: list[dict]) -> dict[str, str]:
    """Optional LLM re-rank companion: one short 'why this matches' line per
    listing name, in the user's own terms. {} on any failure (callers skip)."""
    config = _agnes_config() or _openai_config()
    if config is None or not listings or not (query or "").strip():
        return {}
    summary = "\n".join(
        f"- {r.get('name')}: type={r.get('type')}, score={r.get('score')}, "
        f"rent_thb={r.get('rent')}, commute_min={r.get('commute_min')}, "
        f"near={','.join(r.get('met_nearby', [])) or 'n/a'}"
        for r in listings[:8])
    prompt = (
        "A student wants: \"" + query.strip()[:400] + "\"\n"
        "Candidate places:\n" + summary + "\n\n"
        "For each place, one warm sentence (max 15 words) on why it fits (or the honest "
        "trade-off), in the student's terms. Respond with ONLY JSON: "
        "{\"reasons\": {\"<name>\": \"<sentence>\"}}")
    content = _post_chat(config, [{"role": "user", "content": prompt}])
    payload = _extract_json(content or "")
    reasons = payload.get("reasons") if isinstance(payload, dict) else None
    if not isinstance(reasons, dict):
        return {}
    return {str(k): str(v).strip()[:200] for k, v in reasons.items()
            if isinstance(v, str) and v.strip()}
