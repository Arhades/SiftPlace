"""Free-text intake parsing: "Anything else?" → structured search demands.

Two engines:
  1. `parse_rules` — dependency-free keyword/synonym parser driven by the
     **`nlp_terms.csv`** "bag of words" next to this file. Always available; the
     guaranteed fallback. Edit the vocabulary in the CSV — no code changes needed.
  2. `parse_model` — a TRAINED text classifier (Porter-stemmed bag of words →
     multi-label Naive Bayes / MLP, see `nlp_train.py`). Loaded from
     `nlp_model.joblib` at startup when it exists; never retrained per request.

How the model keeps improving ("retrain as users add sentences"):
  * every explicitly SUBMITTED "Anything else?" note is appended (once — repeat
    submissions of the same text are deduplicated) to **`nlp_training.csv`**,
    auto-labelled by the rules parser (weak supervision — no labelled data is
    needed to start). Parsing alone never writes: the caller opts in via
    `record_note()`, and users can opt out / request deletion
    (`delete_training_examples`),
  * `python nlp_train.py` (or POST /admin/retrain) re-fits on everything
    accumulated so far and saves the better of Naive Bayes vs MLP,
  * the vectorizer re-fits on the accumulated corpus each time, so new words
    fold into the growing vocabulary automatically.
  Honest note: until real volume accumulates, the model tracks the keyword
  rules it was bootstrapped from — its win is generalising to unseen synonyms
  via stemming. That's why `parse_notes` UNIONS model + rules output: the model
  can add matches the keywords missed, and can never lose the guaranteed ones.

Both engines return the same shape so the caller/frontend doesn't care which ran:
{
  amenities:   [wifi|desk|kitchen|laundry|gympool, ...]
  nearby:      [gym|supermarket|transit|mall|flea_market, ...]
  types:       [condo|hostel|hotel, ...]
  vibe:        "quiet" | "lively" | None
  weight_nudges: {cost: int, location: int, living: int}   # -2..+2 soft nudges
  must_haves:  ["pet friendly", ...]   # demands we can't map to a known key
  detected:    ["🛒 supermarket nearby", ...]  # human-readable, shown to user
  engine:      "rules" | "model+rules"
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
import pathlib
import re
import threading

AMENITY_KEYS = ["wifi", "desk", "kitchen", "laundry", "gympool"]
NEARBY_KEYS = ["gym", "supermarket", "transit", "mall", "flea_market"]
TYPE_KEYS = ["condo", "hostel", "hotel"]

_TERMS_CSV = pathlib.Path(__file__).parent / "nlp_terms.csv"
TRAINING_CSV = pathlib.Path(__file__).parent / "nlp_training.csv"
MODEL_PATH = pathlib.Path(__file__).parent / "nlp_model.joblib"

# model predictions below this per-label probability are ignored
MODEL_CONFIDENCE = 0.5
# stop appending training rows beyond this many (plenty before a rethink)
TRAINING_ROW_CAP = 50_000


def _load_terms(path: pathlib.Path = _TERMS_CSV):
    """Load the keyword bag of words from CSV.

    Degrades gracefully to empty lists if the file is missing or a row is
    malformed (the model engine still works). Rules matched on lowercased text.
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


# ---- shared text preprocessing (the trainer imports these) --------------------
#
# Mirrors the standard sklearn NLP pipeline: strip non-letters, lowercase,
# drop English stopwords BUT KEEP "not" (negation matters: "not quiet"),
# Porter-stem every word.

# minimal fallback so the app still runs when the NLTK corpus was never
# downloaded (offline install); nltk.download('stopwords') gives the full list
_FALLBACK_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "so", "of", "to", "in", "on",
    "at", "by", "for", "with", "about", "as", "is", "are", "was", "were", "be",
    "been", "am", "i", "we", "you", "he", "she", "it", "they", "my", "our",
    "your", "me", "us", "this", "that", "there", "would", "will", "can",
    "could", "should", "have", "has", "had", "do", "does", "did", "want",
    "need", "like", "im", "id", "ill",
}


def _build_stopwords() -> set[str]:
    try:
        from nltk.corpus import stopwords
        try:
            words = set(stopwords.words("english"))
        except LookupError:
            import nltk
            nltk.download("stopwords", quiet=True)
            words = set(stopwords.words("english"))
    except Exception:
        words = set(_FALLBACK_STOPWORDS)
    words.discard("not")  # keep negation
    return words


_STOPWORDS = _build_stopwords()

try:
    from nltk.stem.porter import PorterStemmer
    _STEMMER = PorterStemmer()
except Exception:  # nltk missing: identity "stemmer" keeps rules-only mode alive
    class _IdentityStemmer:
        def stem(self, word: str) -> str:
            return word
    _STEMMER = _IdentityStemmer()


def preprocess(text: str) -> str:
    """letters-only -> lowercase -> drop stopwords (keep 'not') -> Porter stem."""
    letters_only = re.sub("[^a-zA-Z]", " ", text or "")
    words = letters_only.lower().split()
    stemmed = [_STEMMER.stem(word) for word in words if word not in _STOPWORDS]
    return " ".join(stemmed)


# ---- label space shared with the trainer ---------------------------------------
# one flat multi-label space: "amenity:wifi", "nearby:gym", "type:condo",
# "vibe:quiet" ... a note can carry any number of them.

_BUCKET_PREFIX = {"amenities": "amenity", "nearby": "nearby", "types": "type"}


def labels_from_parsed(parsed: dict) -> list[str]:
    """Flatten a parser result into training labels."""
    labels = []
    for bucket, prefix in _BUCKET_PREFIX.items():
        labels += [f"{prefix}:{key}" for key in parsed.get(bucket, [])]
    if parsed.get("vibe"):
        labels.append(f"vibe:{parsed['vibe']}")
    return labels


# ---- the trained model engine ---------------------------------------------------

_model_lock = threading.Lock()
_model_bundle: dict | None = None   # {vectorizer, binarizer, classifier, name, ...}


def _load_model() -> dict | None:
    try:
        import joblib
        bundle = joblib.load(MODEL_PATH)
        # sanity: everything parse_model needs must be present
        if all(k in bundle for k in ("vectorizer", "binarizer", "classifier")):
            return bundle
    except Exception:
        pass
    return None


_model_bundle = _load_model()


def reload_model() -> bool:
    """Pick up a freshly trained nlp_model.joblib without restarting. Returns
    whether a model is now loaded. Called after /admin/retrain."""
    global _model_bundle
    with _model_lock:
        _model_bundle = _load_model()
        return _model_bundle is not None


def model_info() -> dict:
    """For the founder dashboard: which model is live, trained on how much."""
    bundle = _model_bundle
    if not bundle:
        return {"loaded": False}
    return {"loaded": True, "name": bundle.get("name"),
            "trained_at": bundle.get("trained_at"),
            "n_samples": bundle.get("n_samples"),
            "metrics": bundle.get("metrics")}


def parse_model(text: str) -> dict | None:
    """Trained-classifier extraction; None when no model is loaded or anything
    fails (the caller falls back to rules)."""
    bundle = _model_bundle
    if bundle is None or not (text or "").strip():
        return None
    try:
        features = bundle["vectorizer"].transform([preprocess(text)])
        classifier = bundle["classifier"]
        label_names = list(bundle["binarizer"].classes_)

        # per-label probabilities where available (NB/MLP both provide them),
        # hard predictions otherwise
        try:
            probabilities = classifier.predict_proba(features)[0]
            predicted = [label for label, p in zip(label_names, probabilities)
                         if p >= MODEL_CONFIDENCE]
        except Exception:
            flags = classifier.predict(features)[0]
            predicted = [label for label, flag in zip(label_names, flags) if flag]

        out = _empty("model")
        for label in predicted:
            prefix, _, key = label.partition(":")
            if prefix == "amenity" and key in AMENITY_KEYS:
                out["amenities"].append(key)
            elif prefix == "nearby" and key in NEARBY_KEYS:
                out["nearby"].append(key)
            elif prefix == "type" and key in TYPE_KEYS:
                out["types"].append(key)
            elif prefix == "vibe" and key in ("quiet", "lively"):
                out["vibe"] = out["vibe"] or key
        return out
    except Exception:
        return None


# ---- training-data accumulation (weak supervision) ------------------------------
#
# Recording is EXPLICIT: parse_notes never writes (it runs on live previews and
# every filter apply — writing there was I/O on every search and re-recorded
# the same note endlessly). main.py calls record_note() only when a submitted
# search carries a note AND the user hasn't opted out; a seen-hash set keeps
# repeat applies of the same text to one row.

_training_lock = threading.Lock()
_recorded_hashes: set[str] | None = None   # lazy-loaded from the CSV


def _note_hash(note: str) -> str:
    import hashlib
    return hashlib.sha256(note.lower().encode("utf-8")).hexdigest()[:16]


def _load_recorded_hashes() -> set[str]:
    """Hashes of every note already in the CSV, so restarts don't re-record."""
    hashes: set[str] = set()
    try:
        with open(TRAINING_CSV, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                text = (row.get("text") or "").strip()
                if text:
                    hashes.add(_note_hash(text))
    except Exception:
        pass
    return hashes


def record_note(text: str) -> None:
    """Append an explicitly submitted note to nlp_training.csv, auto-labelled
    by the rules parser — once per distinct text. Never raises."""
    try:
        note = (text or "").strip()
        if not 3 <= len(note) <= 500:
            return
        labels = " ".join(labels_from_parsed(parse_rules(note)))
        digest = _note_hash(note)
        global _recorded_hashes
        with _training_lock:
            if _recorded_hashes is None:
                _recorded_hashes = _load_recorded_hashes()
            if digest in _recorded_hashes:
                return
            exists = TRAINING_CSV.exists()
            if exists:
                # cheap row cap: count only when the file is getting big
                if TRAINING_CSV.stat().st_size > 5_000_000:
                    return
            with open(TRAINING_CSV, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if not exists:
                    writer.writerow(["text", "labels"])
                writer.writerow([note, labels])
            _recorded_hashes.add(digest)
    except Exception:
        pass


def delete_training_examples(text: str) -> int:
    """Remove every stored row whose note matches `text` (case-insensitive) —
    the privacy deletion path. Returns how many rows were removed."""
    try:
        needle = (text or "").strip().lower()
        if not needle:
            return 0
        global _recorded_hashes
        with _training_lock:
            if not TRAINING_CSV.exists():
                return 0
            with open(TRAINING_CSV, newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            kept = [r for r in rows if (r.get("text") or "").strip().lower() != needle]
            removed = len(rows) - len(kept)
            if removed:
                with open(TRAINING_CSV, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(["text", "labels"])
                    for r in kept:
                        writer.writerow([r.get("text", ""), r.get("labels", "")])
                _recorded_hashes = None  # force a reload next record
            return removed
    except Exception:
        return 0


# ---- public entry point ----------------------------------------------------------

def parse_notes(text: str) -> dict:
    """Best available engine, never raises. Read-only: recording a note as
    training data is the caller's explicit choice (record_note).

    Model predictions are UNIONED with the rules parser: the model adds
    synonym matches the keywords missed; the rules guarantee the exact-keyword
    baseline and contribute the nudges/must-haves the model doesn't learn.
    """
    rules = parse_rules(text)

    model = parse_model(text)
    if model is None:
        return rules

    merged = rules
    merged["engine"] = "model+rules"
    for bucket in ("amenities", "nearby", "types"):
        for key in model[bucket]:
            if key not in merged[bucket]:
                merged[bucket].append(key)
                merged["detected"].append(_LABELS.get(bucket, {}).get(key, key))
    if model["vibe"] and not merged["vibe"]:
        merged["vibe"] = model["vibe"]
        merged["detected"].append(f"{model['vibe']} street vibe")
    return merged
