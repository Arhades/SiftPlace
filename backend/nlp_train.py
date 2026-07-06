<<<<<<< Updated upstream
"""Train the free-text demand classifier from accumulated notes.

    cd backend
    python nlp_train.py            # train, evaluate NB vs MLP, save the winner
    python nlp_train.py --stats    # just show training-data counts

Pipeline (the standard sklearn text-classification recipe):
  clean (letters only) -> lowercase -> drop English stopwords BUT keep "not"
  -> Porter stem -> CountVectorizer bag of words -> train/test split ->
  multi-label classifiers -> confusion matrix + accuracy per label.

Two adaptations from the classic binary-sentiment version of that recipe:
  * our task is MULTI-LABEL (one note can imply several demand keys), so the
    targets are a binary indicator matrix (MultiLabelBinarizer) with a
    OneVsRestClassifier fitting one binary model per label;
  * MultinomialNB instead of GaussianNB — multinomial NB models word COUNTS,
    which is exactly what a bag of words is (Gaussian NB assumes continuous
    features and fits count data poorly). Both an NB and a small neural net
    (MLP) are trained; whichever scores better on the held-out split is saved.
    With little data NB usually wins — the MLP only earns its keep once real
    volume accumulates.

Training data: nlp_training.csv (text,labels). Rows with empty labels are
auto-labelled by the rules parser (weak supervision) at load time, so raw
collected notes are usable immediately. The saved artifact (nlp_model.joblib)
is loaded by nlp.py at startup — training NEVER happens per request.
"""
from __future__ import annotations

import csv
import datetime as dt
import sys

from nlp import (MODEL_PATH, TRAINING_CSV, labels_from_parsed, parse_rules,
                 preprocess)

# raise as the corpus grows; the notebook used 1500 for ~1000 reviews
MAX_VOCABULARY = 3000
TEST_SHARE = 0.2
RANDOM_STATE = 0
MIN_ROWS = 24          # below this a split is meaningless — refuse to train
MLP_HIDDEN = (64,)
MLP_MAX_ITER = 600


def load_training_rows() -> list[tuple[str, list[str]]]:
    """[(text, [label, ...]), ...] from nlp_training.csv; empty-label rows get
    weak labels from the rules parser."""
    rows: list[tuple[str, list[str]]] = []
    seen_texts: set[str] = set()
=======
"""Train the free-text demand classifier used by nlp.py's `parse_model`.

Usage:
    python nlp_train.py            # train, evaluate, save data/nlp_model.joblib
    python nlp_train.py --report   # evaluate only, save nothing

Also reachable as POST /admin/retrain (main.py) — retraining is a BATCH step;
the server only ever loads the saved artifact, never trains per request.

The pipeline mirrors the classic sklearn NLP notebook:
  clean (letters only, lowercase) → drop NLTK stopwords but keep "not" →
  Porter stem → CountVectorizer bag of words → train_test_split →
  classifier → confusion matrices + accuracy.

Two adaptations, because the notebook does binary sentiment and we map a note
to SEVERAL demand keys (multi-label):
  * one binary classifier per label via OneVsRestClassifier;
  * MultinomialNB instead of GaussianNB — multinomial fits word counts better.
A small neural net (MLPClassifier) is trained on the same split and the
better scorer (micro-F1) is kept. With little data NB usually wins; the MLP
only ships if it measurably beats NB.

Cold start / weak supervision: with no real labeled data yet, the corpus is
bootstrapped by (a) expanding the nlp_terms.csv vocabulary into template
sentences and (b) relabeling every accumulated user note in
data/nlp_training.csv with the current parse_rules. Rows marked source=human
keep their stored labels. As real notes pile up, retraining folds them in and
the vectorizer's vocabulary grows automatically.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import pathlib
import random
import re
import sys

from nlp import MODEL_PATH, TRAINING_CSV, _SYNONYMS, _VIBES, parse_rules, preprocess

# Notebook uses max_features=1500; ours is higher for a growing vocabulary.
MAX_FEATURES = 3000
TEST_SIZE = 0.20
RANDOM_STATE = 0
MIN_EXAMPLES_PER_LABEL = 4  # drop labels too rare to learn or evaluate

# Sentence frames the bootstrap phrases get embedded in (how students write).
TEMPLATES = (
    "i want {p}",
    "looking for a place with {p}",
    "{p} would be great",
    "must have {p}",
    "i really need {p}",
    "somewhere with {p} please",
    "ideally {p} nearby",
    "a room with {p} for my stay",
    "{p} is important to me",
    "hoping for {p} close to campus",
)

# Notes that should map to NOTHING — the classifier must learn silence too.
NOISE_SENTENCES = (
    "thanks a lot", "no other requests", "that is all", "see you soon",
    "i arrive in september", "my flight lands at midnight", "first time in bangkok",
    "i am an exchange student", "staying for one semester", "hello there",
    "can you help me", "what do you recommend", "my budget is listed above",
    "i will book as soon as possible", "excited to move", "nothing else matters",
    "just show me the results", "i have no preference", "anything works for me",
    "my university starts in august",
)


# --- bootstrap corpus from the rules vocabulary ---------------------------------

def _split_alternatives(pattern: str) -> list[str]:
    """Split a regex on top-level '|' only (not the '|' inside groups)."""
    parts, depth, current = [], 0, ""
    for ch in pattern:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "|" and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    parts.append(current)
    return parts


def _literalise(alt: str) -> str:
    """Best-effort literal phrase from one regex alternative.

    Good enough for bootstrap sentences — anything that comes out mangled
    simply won't match parse_rules and contributes as unlabeled noise.
    """
    phrase = alt
    phrase = re.sub(r"\[\- \]\??", " ", phrase)         # [- ] / [- ]? -> space
    phrase = phrase.replace(r"\b", "").replace("\\", "")
    while "(" in phrase:                                 # (er|re) -> er
        phrase = re.sub(r"\(([^()|]*)(?:\|[^()]*)?\)\??", r"\1", phrase, count=1)
    phrase = phrase.replace("?", "").replace("+", "").replace("*", "")
    phrase = re.sub(r"\s+", " ", phrase).strip()
    return phrase


def _vocabulary_phrases() -> list[str]:
    phrases = []
    for pattern, _bucket, _key in _SYNONYMS:
        phrases += [_literalise(a) for a in _split_alternatives(pattern)]
    for pattern, _vibe in _VIBES:
        phrases += [_literalise(a) for a in _split_alternatives(pattern)]
    return sorted({p for p in phrases if len(p) >= 3})


def bootstrap_corpus() -> list[str]:
    """Synthetic notes covering the whole vocabulary, single- and multi-demand."""
    rng = random.Random(RANDOM_STATE)
    phrases = _vocabulary_phrases()
    notes = [template.format(p=phrase)
             for phrase in phrases for template in TEMPLATES]
    # multi-demand sentences teach the model that labels co-occur
    for _ in range(len(phrases) * 2):
        a, b = rng.sample(phrases, 2)
        notes.append(f"i want {a} and {b}")
    notes += list(NOISE_SENTENCES) * 3
    return notes


# --- accumulated real notes -------------------------------------------------------

def load_user_notes() -> list[tuple[str, list[str] | None]]:
    """(text, labels) rows from nlp_training.csv. labels=None means 'relabel
    with the current rules' (source=auto); human-labeled rows keep theirs."""
    rows: list[tuple[str, list[str] | None]] = []
>>>>>>> Stashed changes
    try:
        with open(TRAINING_CSV, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                text = (row.get("text") or "").strip()
<<<<<<< Updated upstream
                if not text or text.lower() in seen_texts:
                    continue  # dedupe repeated submissions
                seen_texts.add(text.lower())
                labels = (row.get("labels") or "").split()
                if not labels:
                    labels = labels_from_parsed(parse_rules(text))
                rows.append((text, labels))
=======
                if not text:
                    continue
                if (row.get("source") or "auto") == "human":
                    try:
                        rows.append((text, json.loads(row.get("labels") or "[]")))
                        continue
                    except ValueError:
                        pass
                rows.append((text, None))
>>>>>>> Stashed changes
    except FileNotFoundError:
        pass
    return rows


<<<<<<< Updated upstream
def train_and_save(verbose: bool = True) -> dict:
    """Fit NB + MLP on everything accumulated, keep the better one, save it.

    Returns a result dict (also stored inside the artifact). Raises nothing —
    failure modes come back as {"trained": False, "reason": ...} so the admin
    endpoint can report them.
    """
    def say(*args):
        if verbose:
            print(*args)

    try:
        import joblib
        import numpy as np
        from sklearn.feature_extraction.text import CountVectorizer
        from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                                     precision_score, recall_score)
        from sklearn.model_selection import train_test_split
        from sklearn.multiclass import OneVsRestClassifier
        from sklearn.naive_bayes import MultinomialNB
        from sklearn.neural_network import MLPClassifier
        from sklearn.preprocessing import MultiLabelBinarizer
    except ImportError as exc:
        return {"trained": False, "reason": f"missing dependency: {exc.name}"}

    # notes with NO labels stay in as all-negative examples — they teach the
    # per-label classifiers what an irrelevant note looks like
    labelled = load_training_rows()
    distinct_labels = {label for _, labels in labelled for label in labels}
    if len(labelled) < MIN_ROWS or len(distinct_labels) < 2:
        return {"trained": False,
                "reason": f"only {len(labelled)} rows / "
                          f"{len(distinct_labels)} distinct labels "
                          f"(need >= {MIN_ROWS} rows); collect more notes first"}

    texts = [preprocess(text) for text, _ in labelled]
    label_sets = [labels for _, labels in labelled]

    vectorizer = CountVectorizer(max_features=MAX_VOCABULARY)
    features = vectorizer.fit_transform(texts)
    binarizer = MultiLabelBinarizer()
    targets = binarizer.fit_transform(label_sets)
    say(f"{len(labelled)} notes, vocabulary {len(vectorizer.vocabulary_)}, "
        f"{targets.shape[1]} labels: {list(binarizer.classes_)}")

    features_train, features_test, targets_train, targets_test = train_test_split(
        features, targets, test_size=TEST_SHARE, random_state=RANDOM_STATE)

    candidates = {
        "naive_bayes": OneVsRestClassifier(MultinomialNB()),
        # MLP handles the multi-label indicator matrix natively
        "mlp": MLPClassifier(hidden_layer_sizes=MLP_HIDDEN, max_iter=MLP_MAX_ITER,
                             random_state=RANDOM_STATE),
    }

    results = {}
    for name, classifier in candidates.items():
        try:
            classifier.fit(features_train.toarray() if name == "mlp"
                           else features_train, targets_train)
            predictions = classifier.predict(
                features_test.toarray() if name == "mlp" else features_test)
            predictions = np.asarray(predictions)
            results[name] = {
                "classifier": classifier,
                # subset accuracy: every label of the note must be right
                "accuracy": round(accuracy_score(targets_test, predictions), 3),
                "precision_micro": round(precision_score(
                    targets_test, predictions, average="micro", zero_division=0), 3),
                "recall_micro": round(recall_score(
                    targets_test, predictions, average="micro", zero_division=0), 3),
                "f1_micro": round(f1_score(
                    targets_test, predictions, average="micro", zero_division=0), 3),
            }
            say(f"\n{name}: acc={results[name]['accuracy']} "
                f"P={results[name]['precision_micro']} "
                f"R={results[name]['recall_micro']} "
                f"F1={results[name]['f1_micro']}")
            if verbose:
                # per-label confusion matrices for the most frequent labels
                frequency = targets.sum(axis=0)
                top = np.argsort(-frequency)[:5]
                for label_index in top:
                    matrix = confusion_matrix(targets_test[:, label_index],
                                              predictions[:, label_index],
                                              labels=[0, 1])
                    say(f"  {binarizer.classes_[label_index]:<22} "
                        f"tn={matrix[0][0]} fp={matrix[0][1]} "
                        f"fn={matrix[1][0]} tp={matrix[1][1]}")
        except Exception as exc:
            say(f"\n{name}: FAILED ({exc.__class__.__name__}: {exc})")

    if not results:
        return {"trained": False, "reason": "both candidates failed to train"}

    # keep the better held-out micro-F1; NB wins ties (simpler, better
    # calibrated on small data)
    order = sorted(results, key=lambda n: (results[n]["f1_micro"],
                                           n == "naive_bayes"), reverse=True)
    winner = order[0]
    say(f"\nwinner: {winner}")

    # refit the winner on ALL data before shipping (the split was only for
    # honest evaluation)
    final = candidates[winner]
    final.fit(features.toarray() if winner == "mlp" else features, targets)

    metrics = {name: {k: v for k, v in res.items() if k != "classifier"}
               for name, res in results.items()}
    bundle = {
        "vectorizer": vectorizer,
        "binarizer": binarizer,
        "classifier": final,
        "name": winner,
        "metrics": metrics,
        "n_samples": len(labelled),
        "trained_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    joblib.dump(bundle, MODEL_PATH)
    say(f"saved {MODEL_PATH.name} ({winner}, {len(labelled)} samples)")
    return {"trained": True, "winner": winner, "n_samples": len(labelled),
            "metrics": metrics}


def main() -> int:
    if "--stats" in sys.argv:
        rows = load_training_rows()
        labelled = sum(1 for _, labels in rows if labels)
        print(f"{len(rows)} unique notes ({labelled} with labels) in "
              f"{TRAINING_CSV.name}")
        return 0
    result = train_and_save(verbose=True)
    if not result.get("trained"):
        print(f"not trained: {result.get('reason')}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
=======
def _rule_labels(text: str) -> list[str]:
    parsed = parse_rules(text)
    labels = [f"{bucket}:{key}"
              for bucket in ("amenities", "nearby", "types")
              for key in parsed[bucket]]
    if parsed["vibe"]:
        labels.append(f"vibe:{parsed['vibe']}")
    return labels


# --- training ---------------------------------------------------------------------

def build_dataset() -> tuple[list[str], list[list[str]]]:
    """Deduped (stemmed_texts, label_lists) from bootstrap + accumulated notes."""
    seen: dict[str, list[str]] = {}
    for text in bootstrap_corpus():
        seen.setdefault(text.lower(), _rule_labels(text))
    for text, labels in load_user_notes():
        seen[text.lower()] = labels if labels is not None else _rule_labels(text)

    texts, label_lists = [], []
    for text, labels in seen.items():
        stemmed = preprocess(text)
        if stemmed is None:
            raise RuntimeError("NLTK stopwords unavailable — cannot train.")
        texts.append(stemmed)
        label_lists.append(labels)
    return texts, label_lists


def train(save: bool = True) -> dict:
    """Train NB vs MLP, print the notebook-style report, keep the winner.
    Returns a metrics summary (also what POST /admin/retrain responds with)."""
    from joblib import dump
    from sklearn.feature_extraction.text import CountVectorizer
    from sklearn.metrics import (accuracy_score, f1_score,
                                 multilabel_confusion_matrix,
                                 precision_score, recall_score)
    from sklearn.model_selection import train_test_split
    from sklearn.multiclass import OneVsRestClassifier
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import MultiLabelBinarizer

    texts, label_lists = build_dataset()

    # drop labels with too few positives to learn from
    counts: dict[str, int] = {}
    for labels in label_lists:
        for label in labels:
            counts[label] = counts.get(label, 0) + 1
    keep = {label for label, n in counts.items() if n >= MIN_EXAMPLES_PER_LABEL}
    label_lists = [[l for l in labels if l in keep] for labels in label_lists]

    binarizer = MultiLabelBinarizer(classes=sorted(keep))
    y = binarizer.fit_transform(label_lists)

    vectorizer = CountVectorizer(max_features=MAX_FEATURES)
    x = vectorizer.fit_transform(texts)

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=TEST_SIZE, random_state=RANDOM_STATE)

    candidates = {
        "naive_bayes": OneVsRestClassifier(MultinomialNB()),
        "mlp": MLPClassifier(hidden_layer_sizes=(64,), max_iter=400,
                             random_state=RANDOM_STATE),
    }
    scores: dict[str, dict] = {}
    for name, model in candidates.items():
        model.fit(x_train, y_train)
        predicted = model.predict(x_test)
        scores[name] = {
            "accuracy": round(accuracy_score(y_test, predicted), 3),  # exact-set match
            "precision": round(precision_score(y_test, predicted,
                                               average="micro", zero_division=0), 3),
            "recall": round(recall_score(y_test, predicted,
                                         average="micro", zero_division=0), 3),
            "f1": round(f1_score(y_test, predicted, average="micro", zero_division=0), 3),
        }

    winner = max(scores, key=lambda name: scores[name]["f1"])
    if scores["naive_bayes"]["f1"] == scores["mlp"]["f1"]:
        winner = "naive_bayes"  # ties go to the simpler, faster model

    print(f"dataset: {len(texts)} notes, {len(keep)} labels, "
          f"{x.shape[1]} bag-of-words features")
    for name, metrics in scores.items():
        marker = " <- kept" if name == winner else ""
        print(f"  {name:12s} {metrics}{marker}")

    # notebook-style: confusion matrix per label for the winning model
    predicted = candidates[winner].predict(x_test)
    print("per-label confusion matrices [[tn fp] [fn tp]] (winner):")
    for label, matrix in zip(binarizer.classes_,
                             multilabel_confusion_matrix(y_test, predicted)):
        print(f"  {label:22s} {matrix.tolist()}")

    # refit the winner on ALL data before shipping — the split was only for
    # honest evaluation, the artifact should use every example we have
    final_model = candidates[winner]
    final_model.fit(x, y)

    summary = {
        "winner": winner,
        "scores": scores,
        "labels": list(binarizer.classes_),
        "examples": len(texts),
        "trained_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    if save:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        dump({"vectorizer": vectorizer, "classifier": final_model,
              "labels": list(binarizer.classes_), "meta": summary}, MODEL_PATH)
        print(f"saved -> {MODEL_PATH}")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", action="store_true",
                        help="evaluate only; do not save the model artifact")
    args = parser.parse_args()
    try:
        train(save=not args.report)
    except Exception as exc:
        print(f"training failed: {type(exc).__name__}: {exc}")
        sys.exit(1)
>>>>>>> Stashed changes
