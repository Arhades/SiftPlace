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
    try:
        with open(TRAINING_CSV, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                text = (row.get("text") or "").strip()
                if not text or text.lower() in seen_texts:
                    continue  # dedupe repeated submissions
                seen_texts.add(text.lower())
                labels = (row.get("labels") or "").split()
                if not labels:
                    labels = labels_from_parsed(parse_rules(text))
                rows.append((text, labels))
    except FileNotFoundError:
        pass
    return rows


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
