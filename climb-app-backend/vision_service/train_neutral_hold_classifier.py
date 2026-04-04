import argparse
import json
import os
import random
from typing import Dict, List, Sequence, Tuple

import numpy as np

from color_classifier import (
    IMAGE_EXTENSIONS,
    NEUTRAL_COLOR_LABELS,
    build_neutral_classifier,
    extract_mask_color_features,
    is_image_file,
    load_crop_and_mask,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a small white/black/other classifier for masked hold crops.",
    )
    parser.add_argument("--data-dir", required=True, help="Dataset root. Supports train/val splits or flat label dirs.")
    parser.add_argument(
        "--output",
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "models",
            "xiaoxiae",
            "color_classifier",
            "neutral_hold_classifier.pt",
        ),
        help="Checkpoint output path.",
    )
    parser.add_argument("--epochs", type=int, default=45)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--hidden-dims", nargs="*", type=int, default=[64, 32])
    return parser.parse_args()


def list_label_files(root_dir: str, label: str) -> List[str]:
    label_dir = os.path.join(root_dir, label)
    if not os.path.isdir(label_dir):
        return []

    files: List[str] = []
    for current_root, _, filenames in os.walk(label_dir):
        for filename in filenames:
            path = os.path.join(current_root, filename)
            if is_image_file(path):
                files.append(path)
    return sorted(files)


def load_split_paths(data_dir: str, labels: Sequence[str], val_split: float, seed: int):
    train_root = os.path.join(data_dir, "train")
    val_root = os.path.join(data_dir, "val")
    if os.path.isdir(train_root):
        train_paths = {label: list_label_files(train_root, label) for label in labels}
        val_paths = {label: list_label_files(val_root, label) for label in labels}
        return train_paths, val_paths

    rng = random.Random(seed)
    train_paths: Dict[str, List[str]] = {}
    val_paths: Dict[str, List[str]] = {}
    for label in labels:
        paths = list_label_files(data_dir, label)
        rng.shuffle(paths)
        if len(paths) <= 1 or val_split <= 0:
            train_paths[label] = paths
            val_paths[label] = []
            continue

        val_count = min(max(1, int(round(len(paths) * val_split))), max(1, len(paths) - 1))
        val_paths[label] = paths[:val_count]
        train_paths[label] = paths[val_count:]
    return train_paths, val_paths


def build_dataset(paths_by_label: Dict[str, List[str]], labels: Sequence[str]):
    features: List[np.ndarray] = []
    targets: List[int] = []
    records: List[Dict] = []

    for label_index, label in enumerate(labels):
        for path in paths_by_label.get(label, []):
            crop_bgr, crop_mask = load_crop_and_mask(path)
            features.append(extract_mask_color_features(crop_bgr, crop_mask))
            targets.append(label_index)
            records.append({"path": path, "label": label})

    if not features:
        raise ValueError("No labelled crop images were found.")

    return np.stack(features).astype(np.float32), np.asarray(targets, dtype=np.int64), records


def iterate_minibatches(features: np.ndarray, targets: np.ndarray, batch_size: int, seed: int):
    indices = np.arange(len(targets))
    rng = np.random.default_rng(seed)
    rng.shuffle(indices)
    for start in range(0, len(indices), batch_size):
        batch_indices = indices[start:start + batch_size]
        yield features[batch_indices], targets[batch_indices]


def accuracy_for_logits(logits, targets) -> float:
    import torch

    predictions = torch.argmax(logits, dim=1)
    return float((predictions == targets).float().mean().item())


def evaluate(model, features: np.ndarray, targets: np.ndarray, device, batch_size: int):
    import torch

    if features.size == 0 or targets.size == 0:
        return {"loss": 0.0, "accuracy": 0.0}

    criterion = torch.nn.CrossEntropyLoss()
    model.eval()
    losses: List[float] = []
    accuracies: List[float] = []

    with torch.no_grad():
        for start in range(0, len(targets), batch_size):
            batch_features = torch.from_numpy(features[start:start + batch_size]).to(device)
            batch_targets = torch.from_numpy(targets[start:start + batch_size]).to(device)
            logits = model(batch_features)
            losses.append(float(criterion(logits, batch_targets).item()))
            accuracies.append(accuracy_for_logits(logits, batch_targets))

    return {
        "loss": float(np.mean(losses)) if losses else 0.0,
        "accuracy": float(np.mean(accuracies)) if accuracies else 0.0,
    }


def main():
    import torch

    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    labels = list(NEUTRAL_COLOR_LABELS)
    train_paths, val_paths = load_split_paths(args.data_dir, labels, args.val_split, args.seed)
    train_features_raw, train_targets, train_records = build_dataset(train_paths, labels)

    val_features_raw = np.zeros((0, train_features_raw.shape[1]), dtype=np.float32)
    val_targets = np.zeros((0,), dtype=np.int64)
    val_records: List[Dict] = []
    if any(val_paths.get(label) for label in labels):
        val_features_raw, val_targets, val_records = build_dataset(val_paths, labels)

    feature_mean = train_features_raw.mean(axis=0)
    feature_std = train_features_raw.std(axis=0)
    feature_std = np.where(feature_std < 1e-6, 1.0, feature_std).astype(np.float32)
    train_features = ((train_features_raw - feature_mean) / feature_std).astype(np.float32)
    val_features = ((val_features_raw - feature_mean) / feature_std).astype(np.float32)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_neutral_classifier(
        input_dim=train_features.shape[1],
        hidden_dims=args.hidden_dims,
        num_classes=len(labels),
    ).to(device)

    class_counts = np.bincount(train_targets, minlength=len(labels)).astype(np.float32)
    class_weights = len(train_targets) / np.maximum(class_counts, 1.0)
    class_weights = class_weights / np.mean(class_weights)

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = torch.nn.CrossEntropyLoss(
        weight=torch.tensor(class_weights, dtype=torch.float32, device=device),
    )

    best_state = None
    best_metric = -1.0
    history: List[Dict] = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        batch_losses: List[float] = []
        batch_accuracies: List[float] = []

        for batch_features_np, batch_targets_np in iterate_minibatches(
            train_features,
            train_targets,
            args.batch_size,
            args.seed + epoch,
        ):
            batch_features = torch.from_numpy(batch_features_np).to(device)
            batch_targets = torch.from_numpy(batch_targets_np).to(device)

            optimizer.zero_grad(set_to_none=True)
            logits = model(batch_features)
            loss = criterion(logits, batch_targets)
            loss.backward()
            optimizer.step()

            batch_losses.append(float(loss.item()))
            batch_accuracies.append(accuracy_for_logits(logits, batch_targets))

        train_metrics = {
            "loss": float(np.mean(batch_losses)) if batch_losses else 0.0,
            "accuracy": float(np.mean(batch_accuracies)) if batch_accuracies else 0.0,
        }
        val_metrics = evaluate(model, val_features, val_targets, device, args.batch_size)
        selection_metric = val_metrics["accuracy"] if len(val_targets) else train_metrics["accuracy"]

        history.append(
            {
                "epoch": epoch,
                "trainLoss": round(train_metrics["loss"], 4),
                "trainAccuracy": round(train_metrics["accuracy"], 4),
                "valLoss": round(val_metrics["loss"], 4),
                "valAccuracy": round(val_metrics["accuracy"], 4),
            }
        )

        if selection_metric >= best_metric:
            best_metric = selection_metric
            best_state = {key: value.detach().cpu() for key, value in model.state_dict().items()}

        print(
            json.dumps(
                {
                    "epoch": epoch,
                    "trainLoss": round(train_metrics["loss"], 4),
                    "trainAccuracy": round(train_metrics["accuracy"], 4),
                    "valLoss": round(val_metrics["loss"], 4),
                    "valAccuracy": round(val_metrics["accuracy"], 4),
                }
            )
        )

    if best_state is None:
        raise RuntimeError("Training did not produce a checkpoint.")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    checkpoint = {
        "labels": labels,
        "input_dim": int(train_features.shape[1]),
        "hidden_dims": list(args.hidden_dims),
        "feature_mean": feature_mean.astype(np.float32),
        "feature_std": feature_std.astype(np.float32),
        "state_dict": best_state,
        "train_count": int(len(train_targets)),
        "val_count": int(len(val_targets)),
        "train_records": train_records,
        "val_records": val_records,
        "history": history,
    }
    torch.save(checkpoint, args.output)

    summary = {
        "output": args.output,
        "trainCount": int(len(train_targets)),
        "valCount": int(len(val_targets)),
        "labels": labels,
        "bestMetric": round(float(best_metric), 4),
        "featureDim": int(train_features.shape[1]),
    }
    print(json.dumps(summary, ensure_ascii=True))


if __name__ == "__main__":
    main()
