"""Semantic (embedding) search layer on GMI Cloud — optional, fail-safe.

The competition's GMI (Nvidia GPU) credits host an embedding model (BGE / E5 /
MiniLM class) behind an OpenAI-compatible `/v1/embeddings` endpoint. When the
env keys exist AND the request carries free text (the mascot chat / "anything
else?" note), /search blends vector similarity into the keyword-engine ranking:

  final = (1 - SEMANTIC_WEIGHT) * keyword_score + SEMANTIC_WEIGHT * cosine_sim

then (optionally, SEMANTIC_EXPLAIN=1) an LLM writes a one-line "why this
matches" per top listing in the user's own words (llm.explain_listings).

Honest caveat, engineered around: OSM listings carry thin text (name, type,
area, nearby kinds), so embeddings shine most when affiliate/curated
descriptions are present — the listing text builder folds in whatever exists.

Fail-safe contract: ANY failure (no keys, endpoint down, bad payload) returns
the keyword ranking untouched. Embeddings are cached in apicache (listings
re-embed only when their text changes); every real call is counted for the
founder dashboard.
"""
from __future__ import annotations

import hashlib
import math
import os

import requests

from apicache import cache_get, cache_set
from usage import count_api_call

TIMEOUT_S = 20
EMBED_CACHE_TTL_S = 7 * 24 * 3600
QUERY_CACHE_TTL_S = 24 * 3600
MAX_BATCH = 64


def _config() -> dict | None:
    key = os.environ.get("GMI_API_KEY", "").strip()
    if not key:
        return None
    return {
        "url": os.environ.get("GMI_EMBED_URL",
                              "https://api.gmi-serving.com/v1/embeddings").strip(),
        "key": key,
        "model": os.environ.get("GMI_EMBED_MODEL", "BAAI/bge-m3").strip(),
    }


def enabled() -> bool:
    return _config() is not None


def semantic_weight() -> float:
    try:
        w = float(os.environ.get("SEMANTIC_WEIGHT", "0.3"))
        return max(0.0, min(0.8, w))
    except ValueError:
        return 0.3


def _cache_key(model: str, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]
    return f"embed:{model}:{digest}"


def _fetch_embeddings(config: dict, texts: list[str]) -> list[list[float]] | None:
    """One embeddings call (OpenAI-compatible shape). None on any failure."""
    try:
        count_api_call("gmi-embed")
        resp = requests.post(
            config["url"],
            headers={"Authorization": f"Bearer {config['key']}",
                     "Content-Type": "application/json"},
            json={"model": config["model"], "input": texts},
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json().get("data") or []
        # the API may reorder; index field restores request order
        by_index = {item.get("index", i): item.get("embedding")
                    for i, item in enumerate(data)}
        vectors = [by_index.get(i) for i in range(len(texts))]
        if any(not isinstance(v, list) or not v for v in vectors):
            return None
        return vectors
    except Exception:
        return None


def embed_texts(texts: list[str], ttl_s: float = EMBED_CACHE_TTL_S) -> list[list[float]] | None:
    """Vectors for every text (cache-first, one batched call for the misses).
    None when the layer is unavailable or the call failed."""
    config = _config()
    if config is None or not texts:
        return None
    vectors: list[list[float] | None] = [cache_get(_cache_key(config["model"], t))
                                         for t in texts]
    missing = [i for i, v in enumerate(vectors) if v is None]
    if missing:
        if len(missing) > MAX_BATCH:
            missing = missing[:MAX_BATCH]
        fetched = _fetch_embeddings(config, [texts[i] for i in missing])
        if fetched is None:
            return None
        for i, vector in zip(missing, fetched):
            vectors[i] = vector
            cache_set(_cache_key(config["model"], texts[i]), vector, ttl_s)
    if any(v is None for v in vectors):
        return None
    return vectors  # type: ignore[return-value]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def listing_text(result: dict) -> str:
    """Every scrap of text a listing carries, for embedding. OSM rows are thin
    (name/type/area/nearby); affiliate rows add stars and offer labels."""
    parts = [result.get("name") or "", result.get("type") or "",
             result.get("area") or ""]
    met = result.get("met_nearby") or []
    if met:
        parts.append("near " + ", ".join(str(m).replace("_", " ") for m in met))
    if result.get("vibe"):
        parts.append(f"{result['vibe']} street")
    if result.get("stars"):
        parts.append(f"{result['stars']}-star")
    for review in (result.get("reviews") or [])[:3]:
        text = review.get("text") if isinstance(review, dict) else None
        if text:
            parts.append(str(text))
    return ". ".join(p for p in parts if p)


def semantic_rerank(results: list[dict], query: str) -> list[dict]:
    """Blend vector similarity into the keyword ranking. Returns the SAME list
    object reordered + annotated (`semantic`), or untouched on any failure."""
    if not enabled() or not (query or "").strip() or len(results) < 2:
        return results
    try:
        texts = [listing_text(r) for r in results]
        query_vectors = embed_texts([query.strip()[:600]], ttl_s=QUERY_CACHE_TTL_S)
        listing_vectors = embed_texts(texts)
        if not query_vectors or not listing_vectors:
            return results
        query_vector = query_vectors[0]

        weight = semantic_weight()
        similarities = [_cosine(query_vector, v) for v in listing_vectors]
        # normalise sims to 0..1 across this result set so the blend weight
        # means the same thing regardless of the embedding model's sim range
        lo, hi = min(similarities), max(similarities)
        spread = (hi - lo) or 1.0
        for result, sim in zip(results, similarities):
            norm = (sim - lo) / spread
            result["semantic"] = round(norm, 3)
            result["_blend"] = (1 - weight) * (result.get("score", 0) / 100.0) + weight * norm
        results.sort(key=lambda r: -r.get("_blend", 0))
        for result in results:
            result.pop("_blend", None)
        return results
    except Exception:
        for result in results:
            result.pop("_blend", None)
        return results


def explain_enabled() -> bool:
    return os.environ.get("SEMANTIC_EXPLAIN", "").strip() in ("1", "true", "yes")
