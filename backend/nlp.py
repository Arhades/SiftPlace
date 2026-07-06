"""Free-text intake parsing: "Anything else?" → structured search demands.

Two engines, layered:
  1. `parse_rules` — dependency-free keyword/synonym parser driven by the
     **`nlp_terms.csv`** "bag of words" next to this file. Always available; the
     guaranteed fallback. Edit the vocabulary in the CSV — no code changes needed.
<<<<<<< Updated upstream
  2. `parse_model` — a TRAINED text classifier (Porter-stemmed bag of words →
     multi-label Naive Bayes / MLP, see `nlp_train.py`). Loaded from
     `nlp_model.joblib` at startup when it exists; never retrained per request.

How the model keeps improving ("retrain as users add sentences"):
  * every note that reaches `parse_notes` is appended to **`nlp_training.csv`**,
    auto-labelled by the rules parser (weak supervision — no labelled data is
    needed to start),
  * `python nlp_train.py` (or POST /admin/retrain) re-fits on everything
    accumulated so far and saves the better of Naive Bayes vs MLP,
  * the vectorizer re-fits on the accumulated corpus each time, so new words
    fold into the growing vocabulary automatically.
  Honest note: until real volume accumulates, the model tracks the keyword
  rules it was bootstrapped from — its win is generalising to unseen synonyms
  via stemming. That's why `parse_notes` UNIONS model + rules output: the model
  can add matches the keywords missed, and can never lose the guaranteed ones.

Both engines return the same shape so the caller/frontend doesn't care which ran:
=======
  2. `parse_model` — trained text classifier (Porter-stemmed bag of words →
     per-label Naive Bayes / MLP, see `nlp_train.py`). Loaded from
     `data/nlp_model.joblib` when it exists; it generalises to synonyms the CSV
     doesn't list yet. Never required — on ANY problem the rules result stands.

`parse_notes` runs the rules first (they also handle weight nudges and
must-haves, which the classifier doesn't predict), then lets the model add any
demand keys it is confident about. Every submitted note is appended to
`data/nlp_training.csv`, so the model keeps learning as real usage accumulates
(retrain with `python nlp_train.py` or POST /admin/retrain).

The returned shape is identical whichever engine ran:
>>>>>>> Stashed changes
{
  amenities:   [wifi|desk|kitchen|laundry|gympool, ...]
  nearby:      [gym|supermarket|transit|mall|flea_market, ...]
  types:       [condo|hostel|hotel, ...]
  vibe:        "quiet" | "lively" | None
  weight_nudges: {cost: int, location: int, living: int}   # -2..+2 soft nudges
  must_haves:  ["pet friendly", ...]   # demands we can't map to a known key
  detected:    ["🛒 supermarket nearby", ...]  # human-readable, shown to user
<<<<<<< Updated upstream
  engine:      "rules" | "model+rules"
=======
  engine:      "rules" | "model"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
import datetime as _dt
import json
>>>>>>> Stashed changes
import pathlib
import re
import threading

AMENITY_KEYS = ["wifi", "desk", "kitchen", "laundry", "gympool"]
NEARBY_KEYS = ["gym", "supermarket", "transit", "mall", "flea_market"]
TYPE_KEYS = ["condo", "hostel", "hotel"]

_TERMS_CSV = pathlib.Path(__file__).parent / "nlp_terms.csv"
<<<<<<< Updated upstream
TRAINING_CSV = pathlib.Path(__file__).parent / "nlp_training.csv"
MODEL_PATH = pathlib.Path(__file__).parent / "nlp_model.joblib"

# model predictions below this per-label probability are ignored
MODEL_CONFIDENCE = 0.5
# stop appending training rows beyond this many (plenty before a rethink)
TRAINING_ROW_CAP = 50_000
=======
MODEL_PATH = pathlib.Path(__file__).parent / "data" / "nlp_model.joblib"
TRAINING_CSV = pathlib.Path(__file__).parent / "data" / "nlp_training.csv"

# A label only counts when the classifier is at least this sure. Below the
# threshold we silently keep the rules-only result (the safe default).
MODEL_CONFIDENCE = 0.5
>>>>>>> Stashed changes


def _load_terms(path: pathlib.Path = _TERMS_CSV):
    """Load the keyword bag of words from CSV.

    Degrades gracefully to empty lists if the file is missing or a row is
<<<<<<< Updated upstream
    malformed (the model engine still works). Rules matched on lowercased text.
=======
    malformed. Rules are matched on lowercased text.
>>>>>>> Stashed changes
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


<<<<<<< Updated upstream
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
=======
# ---- shared text preprocessing (used at train AND predict time) ---------------
# The classic sklearn NLP recipe: letters only → lowercase → drop English
# stopwords (but KEEP "not" — negation matters) → Porter stem → re-join.

_stem_tools: tuple | None | bool = None  # lazy: (stemmer, stopword_set) | False


def _stemming_tools():
    global _stem_tools
    if _stem_tools is None:
        try:
            import nltk
            from nltk.stem.porter import PorterStemmer
            try:
                from nltk.corpus import stopwords
                words = stopwords.words("english")
            except LookupError:
                nltk.download("stopwords", quiet=True)
                from nltk.corpus import stopwords
                words = stopwords.words("english")
            stop = set(words)
            stop.discard("not")
            _stem_tools = (PorterStemmer(), stop)
        except Exception:
            _stem_tools = False  # nltk unavailable — model engine stays off
    return _stem_tools or None


def preprocess(text: str) -> str | None:
    """Stemmed, stopword-free version of `text`, or None when NLTK is missing."""
    tools = _stemming_tools()
    if tools is None:
        return None
    stemmer, stop = tools
    tokens = re.sub("[^a-zA-Z]", " ", text or "").lower().split()
    return " ".join(stemmer.stem(word) for word in tokens if word not in stop)


# ---- trained-model engine ------------------------------------------------------
# The artifact is written by nlp_train.py: {vectorizer, classifier, labels, ...}
# where labels look like "amenities:wifi" / "nearby:gym" / "vibe:quiet".

_model_lock = threading.Lock()
_model_cache: dict = {"mtime": None, "bundle": None}


def _load_model() -> dict | None:
    """Load (and cache) the trained model; reload when the file changes so a
    retrain takes effect without a server restart. None when absent/broken."""
    try:
        mtime = MODEL_PATH.stat().st_mtime
    except OSError:
        return None
    with _model_lock:
        if _model_cache["mtime"] != mtime:
            try:
                import joblib
                _model_cache["bundle"] = joblib.load(MODEL_PATH)
                _model_cache["mtime"] = mtime
            except Exception:
                return None
        return _model_cache["bundle"]


def parse_model(text: str) -> dict | None:
    """Classifier extraction; None whenever the model can't run (no artifact,
    missing deps, prediction error) so the caller keeps the rules result."""
    bundle = _load_model()
    if bundle is None or not (text or "").strip():
        return None
    stemmed = preprocess(text)
    if not stemmed:
        return None
    try:
        features = bundle["vectorizer"].transform([stemmed])
        probabilities = bundle["classifier"].predict_proba(features)[0]
        confident = [label for label, p in zip(bundle["labels"], probabilities)
                     if p >= MODEL_CONFIDENCE]
>>>>>>> Stashed changes
    except Exception:
        return None

    out = _empty("model")
    for label in confident:
        bucket, _, key = label.partition(":")
        if bucket in ("amenities", "nearby", "types") and key not in out[bucket]:
            out[bucket].append(key)
            out["detected"].append(_LABELS.get(bucket, {}).get(key, key))
        elif bucket == "vibe" and out["vibe"] is None:
            out["vibe"] = key
            out["detected"].append(f"{key} street vibe")
    return out


# ---- keep-learning log ----------------------------------------------------------
# Every parsed note lands here (text + the labels we assigned + which engine).
# nlp_train.py re-fits on this file, so the model improves with real usage.
# Rows are marked source=auto; hand-corrected rows (source=human) keep their
# labels verbatim at training time.

_training_lock = threading.Lock()


def _labels_of(parsed: dict) -> list[str]:
    labels = [f"{bucket}:{key}"
              for bucket in ("amenities", "nearby", "types")
              for key in parsed[bucket]]
    if parsed["vibe"]:
        labels.append(f"vibe:{parsed['vibe']}")
    return labels


def _append_training_example(text: str, parsed: dict) -> None:
    """Append one (note, labels) row to the training CSV. Never raises."""
    try:
        text = (text or "").strip()[:2000]
        if not text:
            return
        TRAINING_CSV.parent.mkdir(parents=True, exist_ok=True)
        with _training_lock:
            is_new = not TRAINING_CSV.exists()
            with open(TRAINING_CSV, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if is_new:
                    writer.writerow(["ts", "text", "labels", "source"])
                writer.writerow([_dt.datetime.now().isoformat(timespec="seconds"),
                                 text, json.dumps(_labels_of(parsed)), "auto"])
    except Exception:
        pass  # logging must never break a user's search


# ---- training-data accumulation (weak supervision) ------------------------------

_training_lock = threading.Lock()


def record_training_example(text: str, rules_parsed: dict) -> None:
    """Append a submitted note to nlp_training.csv, auto-labelled by the rules
    parser. This is the data every retrain re-fits on. Never raises."""
    try:
        note = (text or "").strip()
        if not 3 <= len(note) <= 500:
            return
        labels = " ".join(labels_from_parsed(rules_parsed))
        with _training_lock:
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
    except Exception:
        pass


# ---- public entry point ----------------------------------------------------------

def parse_notes(text: str) -> dict:
<<<<<<< Updated upstream
    """Best available engine, never raises.

    Model predictions are UNIONED with the rules parser: the model adds
    synonym matches the keywords missed; the rules guarantee the exact-keyword
    baseline and contribute the nudges/must-haves the model doesn't learn.
    Every note is also recorded as (weakly labelled) training data.
    """
    rules = parse_rules(text)
    record_training_example(text, rules)

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
=======
    """Rules first (they also carry nudges + must-haves), then the trained
    model adds any demand keys it is confident about. Never raises."""
    out = parse_rules(text)
    model_out = parse_model(text)
    if model_out is not None:
        for bucket in ("amenities", "nearby", "types"):
            for key in model_out[bucket]:
                if key not in out[bucket]:
                    out[bucket].append(key)
                    out["detected"].append(_LABELS.get(bucket, {}).get(key, key))
        if out["vibe"] is None and model_out["vibe"]:
            out["vibe"] = model_out["vibe"]
            out["detected"].append(f"{model_out['vibe']} street vibe")
        out["engine"] = "model"
    if (text or "").strip():
        _append_training_example(text, out)
    return out
>>>>>>> Stashed changes
