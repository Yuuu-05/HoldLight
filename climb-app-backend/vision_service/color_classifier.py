import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np


NEUTRAL_COLOR_LABELS = ("other", "white", "black")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
NEUTRAL_FEATURE_DIM = 55


@dataclass
class NeutralClassifierBundle:
    model: object
    device: object
    labels: Sequence[str]
    feature_mean: np.ndarray
    feature_std: np.ndarray
    hidden_dims: Sequence[int]
    input_dim: int


def is_image_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in IMAGE_EXTENSIONS


def read_image_unicode(path: str, flags: int = cv2.IMREAD_UNCHANGED) -> Optional[np.ndarray]:
    try:
        image_bytes = np.fromfile(path, dtype=np.uint8)
    except OSError:
        return None

    if image_bytes.size == 0:
        return None
    return cv2.imdecode(image_bytes, flags)


def write_image_unicode(path: str, image: np.ndarray) -> bool:
    extension = os.path.splitext(path)[1] or ".png"
    success, buffer = cv2.imencode(extension, image)
    if not success:
        return False
    try:
        buffer.tofile(path)
    except OSError:
        return False
    return True


def ensure_uint8_mask(mask: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
    if mask.shape != shape:
        mask = cv2.resize(mask.astype(np.uint8), (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST)
    return (mask > 0).astype(np.uint8)


def clamp_bbox(
    bbox: Tuple[int, int, int, int],
    image_shape: Tuple[int, int],
    pad_ratio: float = 0.08,
) -> Tuple[int, int, int, int]:
    height, width = image_shape
    x1, y1, x2, y2 = bbox
    pad_x = max(2, int((x2 - x1) * pad_ratio))
    pad_y = max(2, int((y2 - y1) * pad_ratio))
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(width, x2 + pad_x)
    y2 = min(height, y2 + pad_y)
    x2 = max(x1 + 1, x2)
    y2 = max(y1 + 1, y2)
    return x1, y1, x2, y2


def extract_masked_hold_crop(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    bbox: Tuple[int, int, int, int],
    pad_ratio: float = 0.08,
) -> Tuple[np.ndarray, np.ndarray]:
    x1, y1, x2, y2 = clamp_bbox(bbox, image_bgr.shape[:2], pad_ratio=pad_ratio)
    crop = image_bgr[y1:y2, x1:x2].copy()
    if crop.size == 0:
        return crop, np.zeros((0, 0), dtype=np.uint8)

    crop_mask = ensure_uint8_mask(mask[y1:y2, x1:x2], crop.shape[:2])
    if int(np.count_nonzero(crop_mask)) < 12:
        crop_mask = np.ones(crop.shape[:2], dtype=np.uint8)
    return crop, crop_mask


def make_masked_rgba_crop(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    bbox: Tuple[int, int, int, int],
    pad_ratio: float = 0.08,
) -> np.ndarray:
    crop_bgr, crop_mask = extract_masked_hold_crop(image_bgr, mask, bbox, pad_ratio=pad_ratio)
    if crop_bgr.size == 0:
        return np.zeros((0, 0, 4), dtype=np.uint8)

    crop_bgra = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2BGRA)
    crop_bgra[:, :, 3] = crop_mask * 255
    return crop_bgra


def load_crop_and_mask(image_path: str) -> Tuple[np.ndarray, np.ndarray]:
    image = read_image_unicode(image_path, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"Unable to read image: {image_path}")

    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    if image.ndim == 3 and image.shape[2] == 4:
        alpha = image[:, :, 3]
        mask = (alpha > 0).astype(np.uint8)
        bgr = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
        if int(np.count_nonzero(mask)) >= 12:
            return bgr, mask
        return bgr, np.ones(bgr.shape[:2], dtype=np.uint8)

    if image.ndim == 3 and image.shape[2] == 3:
        return image, np.ones(image.shape[:2], dtype=np.uint8)

    raise ValueError(f"Unsupported image shape for {image_path}: {image.shape}")


def _masked_channel_stats(channel_pixels: np.ndarray, scale: float) -> List[float]:
    if channel_pixels.size == 0:
        return [0.0, 0.0, 0.0, 0.0, 0.0]

    return [
        float(np.mean(channel_pixels) / scale),
        float(np.std(channel_pixels) / scale),
        float(np.median(channel_pixels) / scale),
        float(np.percentile(channel_pixels, 10) / scale),
        float(np.percentile(channel_pixels, 90) / scale),
    ]


def extract_mask_color_features(crop_bgr: np.ndarray, crop_mask: np.ndarray) -> np.ndarray:
    if crop_bgr.size == 0:
        return np.zeros(NEUTRAL_FEATURE_DIM, dtype=np.float32)

    mask_bool = ensure_uint8_mask(crop_mask, crop_bgr.shape[:2]).astype(bool)
    if int(np.count_nonzero(mask_bool)) < 12:
        mask_bool = np.ones(crop_bgr.shape[:2], dtype=bool)

    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)

    pixels_bgr = crop_bgr[mask_bool]
    pixels_hsv = hsv[mask_bool]
    pixels_lab = lab[mask_bool]
    gray_pixels = gray[mask_bool]

    features: List[float] = []
    for channel_index in range(3):
        features.extend(_masked_channel_stats(pixels_bgr[:, channel_index], 255.0))
    features.extend(_masked_channel_stats(pixels_hsv[:, 0], 180.0))
    features.extend(_masked_channel_stats(pixels_hsv[:, 1], 255.0))
    features.extend(_masked_channel_stats(pixels_hsv[:, 2], 255.0))
    features.extend(_masked_channel_stats(pixels_lab[:, 0], 255.0))
    features.extend(_masked_channel_stats(gray_pixels, 255.0))

    sats = pixels_hsv[:, 1].astype(np.float32)
    vals = pixels_hsv[:, 2].astype(np.float32)
    hues = pixels_hsv[:, 0].astype(np.float32)

    neutral_like = np.logical_and(sats <= 45, vals >= 170)
    dark_like = vals <= 70
    white_like = np.logical_and(sats <= 35, vals >= 195)
    black_like = vals <= 50

    extra_features = [
        float(np.mean(sats <= 25)),
        float(np.mean(sats <= 45)),
        float(np.mean(vals >= 170)),
        float(np.mean(vals >= 200)),
        float(np.mean(vals <= 70)),
        float(np.mean(vals <= 50)),
        float(np.mean(neutral_like)),
        float(np.mean(white_like)),
        float(np.mean(black_like)),
        float(np.mean(np.logical_and(sats >= 35, hues >= 8, hues <= 25))),
        float(np.mean(np.logical_and(sats >= 35, hues >= 89, hues <= 130))),
        float(np.mean(np.logical_and(sats >= 35, hues >= 23, hues <= 35))),
        float(np.mean(dark_like)),
        float(np.count_nonzero(mask_bool) / float(mask_bool.size)),
        float(crop_bgr.shape[0] / max(1.0, crop_bgr.shape[1])),
    ]
    features.extend(extra_features)
    feature_array = np.asarray(features, dtype=np.float32)
    if feature_array.shape[0] != NEUTRAL_FEATURE_DIM:
        raise ValueError(f"Unexpected neutral feature dimension: {feature_array.shape[0]}")
    return feature_array


def build_neutral_classifier(input_dim: int, hidden_dims: Sequence[int] = (64, 32), num_classes: int = 3):
    import torch.nn as nn

    layers = []
    current_dim = input_dim
    for hidden_dim in hidden_dims:
        layers.append(nn.Linear(current_dim, hidden_dim))
        layers.append(nn.ReLU(inplace=True))
        layers.append(nn.Dropout(p=0.12))
        current_dim = hidden_dim
    layers.append(nn.Linear(current_dim, num_classes))
    return nn.Sequential(*layers)


def load_neutral_classifier(checkpoint_path: str, device: Optional[str] = None) -> NeutralClassifierBundle:
    import torch

    target_device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
    checkpoint = torch.load(checkpoint_path, map_location=target_device)
    labels = tuple(checkpoint.get("labels", NEUTRAL_COLOR_LABELS))
    input_dim = int(checkpoint["input_dim"])
    hidden_dims = tuple(int(value) for value in checkpoint.get("hidden_dims", [64, 32]))
    model = build_neutral_classifier(input_dim, hidden_dims=hidden_dims, num_classes=len(labels))
    model.load_state_dict(checkpoint["state_dict"])
    model.to(target_device)
    model.eval()

    feature_mean = np.asarray(checkpoint["feature_mean"], dtype=np.float32)
    feature_std = np.asarray(checkpoint["feature_std"], dtype=np.float32)
    feature_std = np.where(feature_std < 1e-6, 1.0, feature_std)

    return NeutralClassifierBundle(
        model=model,
        device=target_device,
        labels=labels,
        feature_mean=feature_mean,
        feature_std=feature_std,
        hidden_dims=hidden_dims,
        input_dim=input_dim,
    )


def predict_neutral_color(
    bundle: NeutralClassifierBundle,
    crop_bgr: np.ndarray,
    crop_mask: np.ndarray,
) -> Optional[Dict]:
    import torch

    if crop_bgr.size == 0:
        return None

    features = extract_mask_color_features(crop_bgr, crop_mask)
    normalized = (features - bundle.feature_mean) / bundle.feature_std
    tensor = torch.from_numpy(normalized).unsqueeze(0).to(bundle.device)

    with torch.no_grad():
        logits = bundle.model(tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    best_index = int(np.argmax(probabilities))
    best_label = str(bundle.labels[best_index])
    confidence = float(probabilities[best_index])
    return {
        "label": best_label,
        "confidence": confidence,
        "probabilities": {
            str(label): float(probabilities[index])
            for index, label in enumerate(bundle.labels)
        },
    }
