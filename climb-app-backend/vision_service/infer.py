import base64
import importlib.util
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from color_classifier import (
    extract_mask_color_features,
    extract_masked_hold_crop,
    load_neutral_classifier,
    predict_neutral_color,
)


HEURISTIC_PROVIDER_NAME = "python-opencv-heuristic"
XIAOXIAE_PROVIDER_NAME = "xiaoxiae-detectron2-triplet"
MAX_WIDTH = 1280
TRIPLET_MEDIAN_THRESHOLD = 0.7
TRIPLET_MAX_THRESHOLD = 2.65
DETECTRON_SCORE_THRESHOLD = 0.58
ENHANCED_DETECTRON_SCORE_THRESHOLD = 0.5
UPLOAD_HEURISTIC_CONFIDENCE_FLOOR = 0.54

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
XIAOXIAE_MODEL_DIR = os.path.join(BASE_DIR, "models", "xiaoxiae")
XIAOXIAE_CONFIG_PATH = os.path.join(XIAOXIAE_MODEL_DIR, "experiment_config.yml")
XIAOXIAE_HOLD_WEIGHTS_PATH = os.path.join(XIAOXIAE_MODEL_DIR, "hold_detector", "model_final.pth")
XIAOXIAE_ROUTE_WEIGHTS_PATH = os.path.join(XIAOXIAE_MODEL_DIR, "route_triplet", "triplet_network_final.pt")
NEUTRAL_COLOR_MODEL_PATH = os.environ.get(
    "VISION_NEUTRAL_COLOR_MODEL",
    os.path.join(XIAOXIAE_MODEL_DIR, "color_classifier", "neutral_hold_classifier.pt"),
)

try:
    NEUTRAL_COLOR_CONFIDENCE_THRESHOLD = float(os.environ.get("VISION_NEUTRAL_COLOR_CONFIDENCE", "0.72"))
except ValueError:
    NEUTRAL_COLOR_CONFIDENCE_THRESHOLD = 0.72

COLOR_RANGES = {
    "red": [((0, 90, 55), (10, 255, 255)), ((168, 90, 55), (180, 255, 255))],
    "orange": [((11, 95, 70), (22, 255, 255))],
    "yellow": [((23, 70, 80), (35, 255, 255))],
    "green": [((36, 45, 35), (88, 255, 255))],
    "blue": [((89, 55, 45), (130, 255, 255))],
    "purple": [((131, 40, 35), (155, 255, 255))],
    "pink": [((156, 35, 80), (167, 255, 255))],
    "white": [((0, 0, 180), (180, 45, 255))],
    "black": [((0, 0, 0), (180, 70, 65))],
}

_XIAOXIAE_PREDICTOR = None
_TRIPLET_MODEL = None
_TRIPLET_PREPROCESS = None
_TRIPLET_DEVICE = None
_NEUTRAL_COLOR_BUNDLE = None
_NEUTRAL_COLOR_LOAD_ATTEMPTED = False


def fail(message: str):
    print(json.dumps({"success": False, "message": message}), file=sys.stderr)
    sys.exit(1)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def parse_payload() -> Dict:
    try:
        return json.load(sys.stdin)
    except Exception as exc:  # pragma: no cover - defensive path
        fail(f"Invalid JSON payload: {exc}")


def decode_image(data_url: str) -> np.ndarray:
    if "," not in data_url:
        fail("The image payload must be a data URL.")

    encoded = data_url.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(encoded)
    except Exception as exc:
        fail(f"Image decoding failed: {exc}")

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        fail("The uploaded image could not be decoded.")
    return image


def resize_image(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    if width <= MAX_WIDTH:
        return image

    scale = MAX_WIDTH / width
    new_size = (MAX_WIDTH, max(1, int(height * scale)))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def get_requested_provider_mode(payload: Dict) -> str:
    raw = str(payload.get("providerMode") or os.environ.get("VISION_PROVIDER_MODE") or "auto").strip().lower()
    if raw in {"auto", "python-auto"}:
        return "auto"
    if raw in {"xiaoxiae", "python-xiaoxiae"}:
        return "xiaoxiae"
    if raw in {"python-opencv", "opencv", "heuristic"}:
        return "heuristic"
    return "auto"


def get_xiaoxiae_runtime_status() -> Dict:
    config_exists = os.path.exists(XIAOXIAE_CONFIG_PATH)
    hold_weights_exists = os.path.exists(XIAOXIAE_HOLD_WEIGHTS_PATH)
    route_weights_exists = os.path.exists(XIAOXIAE_ROUTE_WEIGHTS_PATH)
    neutral_color_model_exists = os.path.exists(NEUTRAL_COLOR_MODEL_PATH)
    assets_ready = config_exists and hold_weights_exists and route_weights_exists
    detectron2_ready = module_available("detectron2")
    torch_ready = module_available("torch")
    torchvision_ready = module_available("torchvision")

    reasons: List[str] = []
    if not config_exists:
        reasons.append("experiment_config.yml is missing.")
    if not hold_weights_exists:
        reasons.append("model_final.pth is missing.")
    if not route_weights_exists:
        reasons.append("triplet_network_final.pt is missing.")
    if not detectron2_ready:
        reasons.append("detectron2 is not installed in the current Python environment.")
    if not torch_ready:
        reasons.append("torch is not installed in the current Python environment.")
    if not torchvision_ready:
        reasons.append("torchvision is not installed in the current Python environment.")

    return {
        "assetsReady": assets_ready,
        "detectron2Ready": detectron2_ready,
        "torchReady": torch_ready,
        "torchvisionReady": torchvision_ready,
        "neutralColorModelReady": neutral_color_model_exists,
        "ready": assets_ready and detectron2_ready and torch_ready and torchvision_ready,
        "reasons": reasons,
    }


def get_neutral_color_bundle():
    global _NEUTRAL_COLOR_BUNDLE, _NEUTRAL_COLOR_LOAD_ATTEMPTED
    if _NEUTRAL_COLOR_LOAD_ATTEMPTED:
        return _NEUTRAL_COLOR_BUNDLE

    _NEUTRAL_COLOR_LOAD_ATTEMPTED = True
    if not os.path.exists(NEUTRAL_COLOR_MODEL_PATH):
        return None

    try:
        _NEUTRAL_COLOR_BUNDLE = load_neutral_classifier(NEUTRAL_COLOR_MODEL_PATH)
    except Exception:
        _NEUTRAL_COLOR_BUNDLE = None
    return _NEUTRAL_COLOR_BUNDLE


def classify_neutral_mask_color(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    bbox: Tuple[int, int, int, int],
) -> Optional[str]:
    bundle = get_neutral_color_bundle()
    if bundle is None:
        return None

    crop_bgr, crop_mask = extract_masked_hold_crop(image_bgr, mask, bbox)
    prediction = predict_neutral_color(bundle, crop_bgr, crop_mask)
    if not prediction:
        return None

    features = extract_mask_color_features(crop_bgr, crop_mask)
    mean_sat = float(features[20])
    mean_val = float(features[25])
    low_sat_fraction = float(features[41])
    high_value_fraction = float(features[42])
    low_value_fraction = float(features[44])

    if prediction["label"] not in {"white", "black"}:
        return None
    if float(prediction["confidence"]) < NEUTRAL_COLOR_CONFIDENCE_THRESHOLD:
        return None
    if prediction["label"] == "white":
        if not ((low_sat_fraction >= 0.45 and mean_val >= 0.58) or high_value_fraction >= 0.28):
            return None
        if mean_sat >= 0.32:
            return None
    if prediction["label"] == "black":
        if not (low_value_fraction >= 0.42 or mean_val <= 0.34):
            return None
    return str(prediction["label"])


def make_mask(hsv: np.ndarray, color_name: str) -> np.ndarray:
    masks = []
    for lower, upper in COLOR_RANGES[color_name]:
        masks.append(cv2.inRange(hsv, np.array(lower, dtype=np.uint8), np.array(upper, dtype=np.uint8)))

    combined = masks[0]
    for extra in masks[1:]:
        combined = cv2.bitwise_or(combined, extra)

    kernel = np.ones((5, 5), dtype=np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    return combined


def classify_hsv_pixels(hsv_pixels: np.ndarray, brightness: float) -> str:
    if hsv_pixels.size == 0:
        if brightness < 55:
            return "black"
        if brightness > 190:
            return "white"
        return "unknown"

    sats = hsv_pixels[:, 1]
    vals = hsv_pixels[:, 2]

    saturated = hsv_pixels[(sats >= 35) & (vals >= 35)]
    if saturated.size == 0:
        if float(np.mean(vals)) < 60:
            return "black"
        if float(np.mean(vals)) > 190:
            return "white"
        return "unknown"

    hue = float(np.median(saturated[:, 0]))
    if hue < 10 or hue >= 168:
        return "red"
    if hue < 23:
        return "orange"
    if hue < 36:
        return "yellow"
    if hue < 89:
        return "green"
    if hue < 131:
        return "blue"
    if hue < 156:
        return "purple"
    return "pink"


def classify_roi_color(roi_bgr: np.ndarray) -> str:
    if roi_bgr.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    return classify_hsv_pixels(hsv.reshape(-1, 3), brightness)


def classify_mask_color(image_bgr: np.ndarray, mask: np.ndarray, bbox: Tuple[int, int, int, int]) -> str:
    neutral_color = classify_neutral_mask_color(image_bgr, mask, bbox)
    if neutral_color is not None:
        return neutral_color

    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    working_mask = mask.astype(np.uint8)
    if np.count_nonzero(working_mask) >= 48:
        working_mask = cv2.erode(working_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
        if np.count_nonzero(working_mask) == 0:
            working_mask = mask.astype(np.uint8)

    hsv_pixels = hsv[working_mask > 0]
    brightness_pixels = gray[working_mask > 0]
    brightness = float(np.mean(brightness_pixels)) if brightness_pixels.size else 128.0
    color_name = classify_hsv_pixels(hsv_pixels.reshape(-1, 3), brightness) if hsv_pixels.size else "unknown"

    if color_name != "unknown":
        return color_name

    x1, y1, x2, y2 = bbox
    inner_pad_x = max(1, int((x2 - x1) * 0.14))
    inner_pad_y = max(1, int((y2 - y1) * 0.14))
    inner_x1 = min(max(x1 + inner_pad_x, x1), x2 - 1)
    inner_y1 = min(max(y1 + inner_pad_y, y1), y2 - 1)
    inner_x2 = max(min(x2 - inner_pad_x, x2), inner_x1 + 1)
    inner_y2 = max(min(y2 - inner_pad_y, y2), inner_y1 + 1)
    inner_color = classify_roi_color(image_bgr[inner_y1:inner_y2, inner_x1:inner_x2])
    if inner_color != "unknown":
        return inner_color
    return classify_roi_color(image_bgr[y1:y2, x1:x2])


def classify_bgr_color(mean_bgr: np.ndarray) -> str:
    roi = np.uint8([[mean_bgr.astype(np.uint8)]])
    return classify_roi_color(roi)


def contour_confidence(area: float, bbox_area: float, image_area: float, mean_saturation: float, fallback: bool) -> float:
    fill_ratio = area / max(1.0, bbox_area)
    area_ratio = bbox_area / max(1.0, image_area)
    saturation_boost = clamp(mean_saturation / 255.0, 0.0, 1.0)
    base = 0.3 if fallback else 0.42
    confidence = base + fill_ratio * 0.28 + min(0.18, area_ratio * 18) + saturation_boost * 0.12
    if fallback:
        confidence -= 0.08
    return round(clamp(confidence, 0.18, 0.94), 2)


def make_hold(color: str, x: int, y: int, w: int, h: int, confidence: float, image_width: int, image_height: int) -> Dict:
    x1_pct = round(x / image_width * 100.0, 2)
    y1_pct = round(y / image_height * 100.0, 2)
    x2_pct = round((x + w) / image_width * 100.0, 2)
    y2_pct = round((y + h) / image_height * 100.0, 2)
    x_pct = round((x1_pct + x2_pct) / 2.0, 2)
    y_pct = round((y1_pct + y2_pct) / 2.0, 2)
    area_pct = (x2_pct - x1_pct) * (y2_pct - y1_pct)

    if area_pct >= 45:
        size = "l"
    elif area_pct >= 16:
        size = "m"
    else:
        size = "s"

    return {
        "id": "",
        "label": "",
        "color": color,
        "xPct": x_pct,
        "yPct": y_pct,
        "x1Pct": x1_pct,
        "y1Pct": y1_pct,
        "x2Pct": x2_pct,
        "y2Pct": y2_pct,
        "confidence": confidence,
        "role": "intermediate",
        "size": size,
        "radiusPct": round(clamp(np.sqrt(max(area_pct, 4.0)) * 0.55, 1.6, 4.8), 2),
    }


def detect_color_holds(image_bgr: np.ndarray) -> List[Dict]:
    image_height, image_width = image_bgr.shape[:2]
    image_area = float(image_width * image_height)
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    min_area = max(140.0, image_area * 0.00012)
    max_bbox_area = image_area * 0.14

    holds: List[Dict] = []

    for color_name in COLOR_RANGES:
        mask = make_mask(hsv, color_name)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            bbox_area = float(w * h)
            if bbox_area < min_area or bbox_area > max_bbox_area:
                continue

            aspect_ratio = max(w / max(1.0, h), h / max(1.0, w))
            if aspect_ratio > 5.2:
                continue

            contour_mask = np.zeros(mask.shape, dtype=np.uint8)
            cv2.drawContours(contour_mask, [contour], -1, 255, thickness=-1)
            masked_pixels = hsv[contour_mask == 255]
            mean_saturation = float(np.mean(masked_pixels[:, 1])) if masked_pixels.size else 0.0
            confidence = contour_confidence(area, bbox_area, image_area, mean_saturation, fallback=False)
            holds.append(make_hold(color_name, x, y, w, h, confidence, image_width, image_height))

    return holds


def detect_fallback_holds(image_bgr: np.ndarray, existing_holds: List[Dict]) -> List[Dict]:
    image_height, image_width = image_bgr.shape[:2]
    image_area = float(image_width * image_height)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 110)
    edges = cv2.dilate(edges, np.ones((3, 3), dtype=np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = max(180.0, image_area * 0.00018)
    max_bbox_area = image_area * 0.1
    fallback_holds: List[Dict] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        bbox_area = float(w * h)
        if bbox_area < min_area or bbox_area > max_bbox_area:
            continue

        aspect_ratio = max(w / max(1.0, h), h / max(1.0, w))
        if aspect_ratio > 4.8:
            continue

        roi = image_bgr[y : y + h, x : x + w]
        color_name = classify_roi_color(roi)
        if color_name == "unknown":
            continue

        mean_saturation = float(np.mean(cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[:, :, 1])) if roi.size else 0.0
        confidence = contour_confidence(area, bbox_area, image_area, mean_saturation, fallback=True)
        fallback_holds.append(make_hold(color_name, x, y, w, h, confidence, image_width, image_height))

    return dedupe_holds(existing_holds + fallback_holds)


def compute_iou(left: Dict, right: Dict) -> float:
    x1 = max(left["x1Pct"], right["x1Pct"])
    y1 = max(left["y1Pct"], right["y1Pct"])
    x2 = min(left["x2Pct"], right["x2Pct"])
    y2 = min(left["y2Pct"], right["y2Pct"])

    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    left_area = max(0.0, left["x2Pct"] - left["x1Pct"]) * max(0.0, left["y2Pct"] - left["y1Pct"])
    right_area = max(0.0, right["x2Pct"] - right["x1Pct"]) * max(0.0, right["y2Pct"] - right["y1Pct"])
    union = left_area + right_area - intersection
    if union <= 0:
        return 0.0
    return intersection / union


def dedupe_holds(holds: List[Dict]) -> List[Dict]:
    deduped: List[Dict] = []

    for hold in sorted(holds, key=lambda item: item["confidence"], reverse=True):
        duplicate = None
        for candidate in deduped:
            same_color = hold["color"] == candidate["color"]
            dx = hold["xPct"] - candidate["xPct"]
            dy = hold["yPct"] - candidate["yPct"]
            close = (dx * dx + dy * dy) ** 0.5 < 3.4
            if same_color and (compute_iou(hold, candidate) > 0.34 or close):
                duplicate = candidate
                break

        if duplicate is None:
            deduped.append(hold)

    return deduped


def annotate_detected_holds(holds: List[Dict]) -> Tuple[List[Dict], List[str]]:
    ordered = sorted(holds, key=lambda item: (-item["yPct"], item["xPct"]))
    colors = sorted({hold["color"] for hold in ordered})
    for index, hold in enumerate(ordered, start=1):
        hold["id"] = f"hold-{index}-{int(round(hold['xPct']))}-{int(round(hold['yPct']))}"
        hold["label"] = f"{hold['color'].capitalize()} hold {index}"
        hold["role"] = "intermediate"
    return ordered, colors


def assign_roles_and_labels(holds: List[Dict]) -> Tuple[List[Dict], List[str]]:
    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for hold in holds:
        grouped[hold["color"]].append(hold)

    ordered_holds: List[Dict] = []
    colors: List[str] = []

    for color_name in sorted(grouped.keys()):
        color_holds = sorted(grouped[color_name], key=lambda item: (-item["yPct"], item["xPct"]))
        colors.append(color_name)

        for index, hold in enumerate(color_holds):
            if index == 0:
                role = "start"
            elif index == 1 and len(color_holds) >= 4:
                role = "foot"
            elif index == len(color_holds) - 1:
                role = "finish"
            else:
                role = "intermediate"

            hold["role"] = role
            hold["id"] = f"{color_name}-{index + 1}-{int(round(hold['xPct']))}-{int(round(hold['yPct']))}"
            hold["label"] = f"{color_name.capitalize()} hold {index + 1}"
            ordered_holds.append(hold)

    return ordered_holds, colors


def assign_route_roles(holds: List[Dict], route_candidates: List[Dict]) -> None:
    holds_by_id = {hold["id"]: hold for hold in holds}
    for hold in holds:
        hold["role"] = "intermediate"

    for candidate in route_candidates:
        route_holds = [holds_by_id[hold_id] for hold_id in candidate["holdIds"] if hold_id in holds_by_id]
        route_holds = sorted(route_holds, key=lambda item: (-item["yPct"], item["xPct"]))

        for index, hold in enumerate(route_holds):
            if index == 0:
                hold["role"] = "start"
            elif index == 1 and len(route_holds) >= 4:
                hold["role"] = "foot"
            elif index == len(route_holds) - 1:
                hold["role"] = "finish"


def extract_hold_mean_bgr(image_bgr: np.ndarray, hold: Dict) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    x1 = int(clamp(round(hold["x1Pct"] / 100.0 * width), 0, width - 1))
    y1 = int(clamp(round(hold["y1Pct"] / 100.0 * height), 0, height - 1))
    x2 = int(clamp(round(hold["x2Pct"] / 100.0 * width), x1 + 1, width))
    y2 = int(clamp(round(hold["y2Pct"] / 100.0 * height), y1 + 1, height))
    roi = image_bgr[y1:y2, x1:x2]
    if roi.size == 0:
        return np.array([0.0, 0.0, 0.0], dtype=np.float32)
    return np.mean(roi.reshape(-1, 3), axis=0).astype(np.float32)


def build_named_color_candidates(holds: List[Dict]) -> List[Dict]:
    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for hold in holds:
        grouped[hold["color"]].append(hold)

    candidates: List[Dict] = []
    for color_name, color_holds in grouped.items():
        if len(color_holds) < 3:
            continue

        sorted_holds = sorted(color_holds, key=lambda item: (-item["yPct"], item["xPct"]))
        mean_x = float(np.mean([hold["xPct"] for hold in sorted_holds]))
        if mean_x < 33:
            start_region = "left"
        elif mean_x > 67:
            start_region = "right"
        else:
            start_region = "center"

        confidence = round(float(np.mean([hold["confidence"] for hold in sorted_holds])), 2)
        candidates.append(
            {
                "id": f"candidate-{color_name}-{start_region}",
                "color": color_name,
                "holdIds": [hold["id"] for hold in sorted_holds],
                "confidence": confidence,
                "estimatedMoves": max(0, len(sorted_holds) - 1),
                "startRegion": start_region,
                "summary": f"{color_name.capitalize()} same-colour route, {start_region} section, about {len(sorted_holds)} usable holds.",
            }
        )

    return sorted(candidates, key=lambda item: item["confidence"], reverse=True)


def build_route_candidates(holds: List[Dict], image_bgr: np.ndarray) -> List[Dict]:
    if len(holds) < 3:
        return []

    feature_rows: List[np.ndarray] = []
    for hold in holds:
        mean_bgr = extract_hold_mean_bgr(image_bgr, hold)
        feature_rows.append(
            np.array(
                [
                    mean_bgr[0] / 255.0,
                    mean_bgr[1] / 255.0,
                    mean_bgr[2] / 255.0,
                    hold["xPct"] / 100.0,
                    hold["yPct"] / 100.0,
                ],
                dtype=np.float32,
            )
        )

    features = np.vstack(feature_rows)
    cluster_cap = min(4, max(1, len(holds) // 3))
    if cluster_cap <= 1:
        return build_named_color_candidates(holds)

    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        20,
        0.2,
    )
    compactness, labels, centers = cv2.kmeans(
        features,
        cluster_cap,
        None,
        criteria,
        8,
        cv2.KMEANS_PP_CENTERS,
    )
    del compactness

    grouped: Dict[int, List[Dict]] = defaultdict(list)
    for index, label in enumerate(labels.flatten().tolist()):
        grouped[int(label)].append(holds[index])

    candidates: List[Dict] = []
    for label, cluster_holds in grouped.items():
        if len(cluster_holds) < 3:
            continue

        sorted_holds = sorted(cluster_holds, key=lambda item: (-item["yPct"], item["xPct"]))
        mean_x = float(np.mean([hold["xPct"] for hold in sorted_holds]))
        if mean_x < 33:
            start_region = "left"
        elif mean_x > 67:
            start_region = "right"
        else:
            start_region = "center"

        centroid_bgr = centers[label][:3] * 255.0
        color_name = classify_bgr_color(centroid_bgr)
        if color_name == "unknown":
            color_counts: Dict[str, int] = defaultdict(int)
            for hold in sorted_holds:
                color_counts[hold["color"]] += 1
            color_name = max(color_counts.items(), key=lambda item: item[1])[0]
        confidence = round(float(np.mean([hold["confidence"] for hold in sorted_holds])), 2)
        candidates.append(
            {
                "id": f"candidate-{color_name}-{start_region}-{label}",
                "color": color_name,
                "holdIds": [hold["id"] for hold in sorted_holds],
                "confidence": confidence,
                "estimatedMoves": max(0, len(sorted_holds) - 1),
                "startRegion": start_region,
                "summary": f"{color_name.capitalize()} same-colour route, {start_region} section, about {len(sorted_holds)} usable holds.",
            }
        )

    if not candidates:
        return build_named_color_candidates(holds)

    return sorted(candidates, key=lambda item: item["confidence"], reverse=True)


def hold_center_distance(left: Dict, right: Dict) -> float:
    dx = left["xPct"] - right["xPct"]
    dy = left["yPct"] - right["yPct"]
    return float((dx * dx + dy * dy) ** 0.5)


def merge_detected_holds(holds: List[Dict]) -> List[Dict]:
    merged: List[Dict] = []

    for hold in sorted(holds, key=lambda item: item["confidence"], reverse=True):
        duplicate = None
        for candidate in merged:
            iou = compute_iou(hold, candidate)
            close = hold_center_distance(hold, candidate) < 2.8
            if iou > 0.4 or close or (hold["color"] == candidate["color"] and iou > 0.28):
                duplicate = candidate
                break

        if duplicate is None:
            merged.append(dict(hold))
            continue

        if hold["confidence"] > duplicate["confidence"]:
            duplicate.update(
                {
                    "xPct": hold["xPct"],
                    "yPct": hold["yPct"],
                    "x1Pct": hold["x1Pct"],
                    "y1Pct": hold["y1Pct"],
                    "x2Pct": hold["x2Pct"],
                    "y2Pct": hold["y2Pct"],
                    "confidence": hold["confidence"],
                    "size": hold["size"],
                    "radiusPct": hold["radiusPct"],
                }
            )

        if hold["color"] != "unknown" and (
            duplicate["color"] == "unknown" or hold["confidence"] >= duplicate["confidence"] - 0.03
        ):
            duplicate["color"] = hold["color"]

    return merged


def enhance_detection_image(image_bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)
    enhanced = cv2.merge((enhanced_l, a_channel, b_channel))
    enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    hsv = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.08 + 3.0, 0.0, 255.0)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.03, 0.0, 255.0)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def collect_upload_heuristic_holds(image_bgr: np.ndarray) -> List[Dict]:
    heuristic_holds = detect_color_holds(image_bgr)
    if len(heuristic_holds) < 10:
        heuristic_holds = detect_fallback_holds(image_bgr, heuristic_holds)

    return [
        hold
        for hold in heuristic_holds
        if hold["confidence"] >= UPLOAD_HEURISTIC_CONFIDENCE_FLOOR and hold["color"] != "unknown"
    ]


def get_xiaoxiae_predictor():
    global _XIAOXIAE_PREDICTOR
    if _XIAOXIAE_PREDICTOR is not None:
        return _XIAOXIAE_PREDICTOR

    import torch
    from detectron2.config import get_cfg
    from detectron2.engine import DefaultPredictor

    cfg = get_cfg()
    cfg.merge_from_file(XIAOXIAE_CONFIG_PATH)
    cfg.MODEL.WEIGHTS = XIAOXIAE_HOLD_WEIGHTS_PATH
    cfg.MODEL.DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    _XIAOXIAE_PREDICTOR = DefaultPredictor(cfg)
    return _XIAOXIAE_PREDICTOR


def get_triplet_components():
    global _TRIPLET_MODEL, _TRIPLET_PREPROCESS, _TRIPLET_DEVICE
    if _TRIPLET_MODEL is not None and _TRIPLET_PREPROCESS is not None and _TRIPLET_DEVICE is not None:
        return _TRIPLET_MODEL, _TRIPLET_PREPROCESS, _TRIPLET_DEVICE

    import torch
    import torch.nn as nn
    import torchvision

    class TripletNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.preprocess = torchvision.models.ResNet50_Weights.DEFAULT.transforms()
            backbone = torchvision.models.resnet50(weights=None)
            self.fc_in_features = backbone.fc.in_features
            self.resnet = nn.Sequential(*(list(backbone.children())[:-1]))
            self.fc = nn.Sequential(
                nn.Linear(self.fc_in_features, 256),
                nn.ReLU(inplace=True),
                nn.Linear(256, 256),
            )

        def forward_once(self, x):
            output = self.resnet(x)
            return output.view(output.size(0), -1)

        def forward(self, input_tensor):
            output = self.forward_once(input_tensor)
            output = self.fc(output)
            return nn.functional.normalize(output, p=2)

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model = TripletNet().to(device)
    state_dict = torch.load(XIAOXIAE_ROUTE_WEIGHTS_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()

    _TRIPLET_MODEL = model
    _TRIPLET_PREPROCESS = model.preprocess
    _TRIPLET_DEVICE = device
    return _TRIPLET_MODEL, _TRIPLET_PREPROCESS, _TRIPLET_DEVICE


def detect_xiaoxiae_holds(
    image_bgr: np.ndarray,
    score_threshold: float = DETECTRON_SCORE_THRESHOLD,
) -> Tuple[List[Dict], object]:
    predictor = get_xiaoxiae_predictor()
    outputs = predictor(image_bgr)
    instances = outputs["instances"].to("cpu")
    if not len(instances):
        return [], instances

    keep_indices: List[int] = []
    holds: List[Dict] = []
    image_height, image_width = image_bgr.shape[:2]
    pred_classes = instances.pred_classes.numpy().tolist()
    pred_scores = instances.scores.numpy().tolist()
    pred_boxes = instances.pred_boxes.tensor.numpy()
    pred_masks = instances.pred_masks.numpy().astype(np.uint8)

    for index, pred_class in enumerate(pred_classes):
        score = float(pred_scores[index])
        if pred_class != 0 or score < score_threshold:
            continue

        x1, y1, x2, y2 = pred_boxes[index].astype(int).tolist()
        x1 = int(clamp(x1, 0, image_width - 1))
        y1 = int(clamp(y1, 0, image_height - 1))
        x2 = int(clamp(x2, x1 + 1, image_width))
        y2 = int(clamp(y2, y1 + 1, image_height))
        color_name = classify_mask_color(image_bgr, pred_masks[index], (x1, y1, x2, y2))
        holds.append(make_hold(color_name, x1, y1, x2 - x1, y2 - y1, round(score, 2), image_width, image_height))
        keep_indices.append(index)

    if not keep_indices:
        return [], instances[:0]

    return holds, instances[keep_indices]


def tensor_from_instance(instance, image_bgr: np.ndarray):
    import torch

    img_torch = torch.from_numpy(image_bgr).permute(2, 0, 1)
    pred_mask = instance.pred_masks.cpu().squeeze().int().float()
    box_coords = instance.pred_boxes.tensor.flatten().int()
    x1 = int(box_coords[0].item())
    y1 = int(box_coords[1].item())
    x2 = int(box_coords[2].item())
    y2 = int(box_coords[3].item())
    masked_img = img_torch * pred_mask
    hold = masked_img[:, y1:y2, x1:x2]
    if hold.numel() == 0:
        hold = img_torch[:, y1:y2, x1:x2]
    return hold


def build_triplet_route_candidates(image_bgr: np.ndarray, holds: List[Dict], instances) -> List[Dict]:
    if len(holds) < 2 or len(instances) < 2:
        return []

    import torch

    model, preprocess, device = get_triplet_components()
    embeddings: List[torch.Tensor] = []

    with torch.no_grad():
        for index in range(len(instances)):
            hold_tensor = tensor_from_instance(instances[index], image_bgr)
            processed = preprocess(hold_tensor).unsqueeze(0).to(device)
            embedding = model(processed).squeeze(0).cpu()
            embeddings.append(embedding)

    routes_dict: Dict[int, List[int]] = {0: [0]}
    for hold_index in range(1, len(embeddings)):
        matched = False
        for route_id, member_indices in routes_dict.items():
            dists: List[float] = []
            for member_index in member_indices:
                dist = torch.nn.functional.pairwise_distance(
                    embeddings[hold_index].unsqueeze(0),
                    embeddings[member_index].unsqueeze(0),
                ).square().item()
                dists.append(float(dist))
            if np.median(np.array(dists)) <= TRIPLET_MEDIAN_THRESHOLD and max(dists) <= TRIPLET_MAX_THRESHOLD:
                routes_dict[route_id].append(hold_index)
                matched = True
                break
        if not matched:
            routes_dict[max(routes_dict.keys()) + 1] = [hold_index]

    candidates: List[Dict] = []
    for route_id, member_indices in routes_dict.items():
        if len(member_indices) < 2:
            continue

        route_holds = [holds[index] for index in member_indices]
        color_counts: Dict[str, int] = defaultdict(int)
        for hold in route_holds:
            color_counts[hold["color"]] += 1
        color_name = max(color_counts.items(), key=lambda item: item[1])[0] if color_counts else "unknown"

        if color_name != "unknown":
            filtered_member_indices = [index for index in member_indices if holds[index]["color"] == color_name]
            if len(filtered_member_indices) >= 3:
                member_indices = filtered_member_indices
                route_holds = [holds[index] for index in member_indices]

        sorted_holds = sorted(route_holds, key=lambda item: (-item["yPct"], item["xPct"]))
        mean_x = float(np.mean([hold["xPct"] for hold in sorted_holds]))
        if mean_x < 33:
            start_region = "left"
        elif mean_x > 67:
            start_region = "right"
        else:
            start_region = "center"

        route_distances: List[float] = []
        for left_index in member_indices:
            for right_index in member_indices:
                if left_index >= right_index:
                    continue
                route_distances.append(
                    float(
                        torch.nn.functional.pairwise_distance(
                            embeddings[left_index].unsqueeze(0),
                            embeddings[right_index].unsqueeze(0),
                        ).square().item()
                    )
                )

        average_hold_confidence = float(np.mean([hold["confidence"] for hold in sorted_holds]))
        cohesion = 1.0 if not route_distances else clamp(1.0 - (float(np.median(route_distances)) / TRIPLET_MAX_THRESHOLD), 0.0, 1.0)
        confidence = round(clamp(average_hold_confidence * 0.78 + cohesion * 0.22, 0.0, 0.99), 2)
        candidates.append(
            {
                "id": f"candidate-{color_name}-{start_region}-{route_id}",
                "color": color_name,
                "holdIds": [hold["id"] for hold in sorted_holds],
                "confidence": confidence,
                "estimatedMoves": max(0, len(sorted_holds) - 1),
                "startRegion": start_region,
                "summary": f"{color_name.capitalize()} same-colour route candidate, {start_region} section, about {len(sorted_holds)} usable holds.",
            }
        )

    return sorted(candidates, key=lambda item: item["confidence"], reverse=True)


def run_heuristic_pipeline(image_bgr: np.ndarray) -> Tuple[List[Dict], List[str], List[Dict]]:
    holds = dedupe_holds(detect_color_holds(image_bgr))
    if len(holds) < 8:
        holds = detect_fallback_holds(image_bgr, holds)

    holds, colors = assign_roles_and_labels(holds)
    route_candidates = build_route_candidates(holds, image_bgr)
    return holds, colors, route_candidates


def run_xiaoxiae_pipeline(image_bgr: np.ndarray, source: str) -> Tuple[List[Dict], List[str], List[Dict]]:
    holds, instances = detect_xiaoxiae_holds(image_bgr)

    if source != "camera":
        enhanced_image = enhance_detection_image(image_bgr)
        enhanced_holds, _ = detect_xiaoxiae_holds(
            enhanced_image,
            score_threshold=ENHANCED_DETECTRON_SCORE_THRESHOLD,
        )
        holds = merge_detected_holds(holds + enhanced_holds)

        if len(holds) < 14:
            holds = merge_detected_holds(holds + collect_upload_heuristic_holds(image_bgr))

        holds, colors = assign_roles_and_labels(holds)
        route_candidates = build_named_color_candidates(holds)
        if not route_candidates:
            route_candidates = build_route_candidates(holds, image_bgr)
        assign_route_roles(holds, route_candidates)
        return holds, colors, route_candidates

    holds, colors = annotate_detected_holds(holds)
    route_candidates = build_triplet_route_candidates(image_bgr, holds, instances)
    if not route_candidates:
        route_candidates = build_named_color_candidates(holds)
    assign_route_roles(holds, route_candidates)
    return holds, colors, route_candidates


def image_metrics(image_bgr: np.ndarray) -> Tuple[float, float, float, float]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))

    blur_norm = clamp(blur_score / 140.0, 0.0, 1.0)
    brightness_norm = clamp(1.0 - abs(brightness - 132.0) / 132.0, 0.0, 1.0)
    contrast_norm = clamp(contrast / 72.0, 0.0, 1.0)
    quality_score = round(0.45 * blur_norm + 0.3 * brightness_norm + 0.25 * contrast_norm, 2)
    return round(blur_score, 2), round(brightness, 2), round(contrast, 2), quality_score


def build_capture_guidance(summary: Dict) -> List[str]:
    guidance: List[str] = []

    if summary["blurScore"] < 45:
        guidance.append("Hold the phone steadier or pause movement before taking the photo.")
    if summary["brightness"] < 60:
        guidance.append("Move closer to the wall lighting or avoid underexposed corners.")
    if summary["brightness"] > 210:
        guidance.append("Reduce glare by changing angle or moving away from direct spotlights.")
    if summary["holdCount"] < 6:
        guidance.append("Step back slightly so the full route start and finish are visible together.")
    if summary["routeCount"] == 0:
        guidance.append("Try a straighter front-on angle so route colors separate more clearly.")

    if not guidance:
        guidance.append("Recognition is stable. You can continue with automatic route selection.")

    return guidance


def build_model_notes(provider_name: str, runtime_status: Dict, fallback_reason: Optional[str]) -> List[str]:
    notes = [
        "Autonomous guidance is only enabled when recognition confidence and image quality both clear the accessibility gate.",
    ]

    if provider_name == XIAOXIAE_PROVIDER_NAME:
        notes.insert(0, "This scan used the xiaoxiae Detectron2 hold detector with TripletNet route grouping.")
        notes.append("The local weights came from the Kaggle models bundle and are stored inside the backend vision service.")
        if runtime_status.get("neutralColorModelReady"):
            notes.append("A trainable white/black/other crop classifier is active before the HSV colour fallback.")
        return notes

    notes.insert(0, "This scan used the Python OpenCV fallback provider instead of the xiaoxiae model runtime.")
    if runtime_status["assetsReady"]:
        notes.append("The xiaoxiae config and weight files are present locally, but the current Python runtime is still missing required model dependencies.")
    if fallback_reason:
        notes.append(fallback_reason)
    return notes


def build_analysis(
    holds: List[Dict],
    route_candidates: List[Dict],
    metrics: Tuple[float, float, float, float],
    provider_name: str,
    runtime_status: Dict,
    fallback_reason: Optional[str],
) -> Dict:
    average_confidence = round(float(np.mean([hold["confidence"] for hold in holds])) if holds else 0.0, 2)
    blur_score, brightness, contrast, quality_score = metrics

    summary = {
        "holdCount": len(holds),
        "routeCount": len(route_candidates),
        "averageHoldConfidence": average_confidence,
        "imageQualityScore": quality_score,
        "blurScore": blur_score,
        "brightness": brightness,
        "contrast": contrast,
    }

    confidence_gate = 0.6 if provider_name == XIAOXIAE_PROVIDER_NAME else 0.56
    quality_gate = 0.42 if provider_name == XIAOXIAE_PROVIDER_NAME else 0.46
    companion_gate = 0.48 if provider_name == XIAOXIAE_PROVIDER_NAME else 0.42

    if len(holds) >= 8 and len(route_candidates) >= 1 and average_confidence >= confidence_gate and quality_score >= quality_gate:
        readiness = "ready"
        suggested_action = "proceed"
        should_allow = True
    elif len(holds) >= 5 and len(route_candidates) >= 1 and average_confidence >= companion_gate:
        readiness = "companion_mode_recommended"
        suggested_action = "companion"
        should_allow = False
    else:
        readiness = "retake_required"
        suggested_action = "retake"
        should_allow = False

    overall_confidence = round(clamp(average_confidence * 0.72 + quality_score * 0.28, 0.0, 0.99), 2)
    return {
        "provider": provider_name,
        "confidence": overall_confidence,
        "readiness": readiness,
        "suggestedAction": suggested_action,
        "shouldAllowAutonomousGuidance": should_allow,
        "captureGuidance": build_capture_guidance(summary),
        "routeCandidates": route_candidates,
        "detectionSummary": summary,
        "modelNotes": build_model_notes(provider_name, runtime_status, fallback_reason),
    }


def build_wall_map(payload: Dict, image_bgr: np.ndarray) -> Dict:
    resized = resize_image(image_bgr)
    source = payload.get("source") or "upload"
    requested_provider = get_requested_provider_mode(payload)
    runtime_status = get_xiaoxiae_runtime_status()
    fallback_reason: Optional[str] = None
    provider_name = HEURISTIC_PROVIDER_NAME

    if requested_provider in {"auto", "xiaoxiae"}:
        if runtime_status["ready"]:
            try:
                holds, colors, route_candidates = run_xiaoxiae_pipeline(resized, source)
                provider_name = XIAOXIAE_PROVIDER_NAME
            except Exception as exc:
                if requested_provider == "xiaoxiae":
                    fail(f"Xiaoxiae provider failed during inference: {exc}")
                fallback_reason = f"Automatic xiaoxiae inference failed and fell back to heuristics: {exc}"
                holds, colors, route_candidates = run_heuristic_pipeline(resized)
        elif requested_provider == "xiaoxiae":
            fail("Xiaoxiae provider is not ready: " + " ".join(runtime_status["reasons"]))
        else:
            fallback_reason = "Xiaoxiae assets were detected, but the current runtime is not ready: " + " ".join(runtime_status["reasons"])
            holds, colors, route_candidates = run_heuristic_pipeline(resized)
    else:
        holds, colors, route_candidates = run_heuristic_pipeline(resized)

    metrics = image_metrics(resized)
    analysis = build_analysis(holds, route_candidates, metrics, provider_name, runtime_status, fallback_reason)

    scanned_at = datetime.now(timezone.utc).isoformat()
    return {
        "provider": provider_name,
        "availableColors": colors,
        "routeCandidates": route_candidates,
        "wallMap": {
            "id": f"wall_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "name": "Vision service wall scan",
            "source": source,
            "width": int(resized.shape[1]),
            "height": int(resized.shape[0]),
            "colors": colors,
            "scannedAt": scanned_at,
            "scanNotes": [
                f"Detected {len(holds)} hold candidates using the {provider_name} provider.",
                "Autonomous guidance is gated by recognition confidence instead of manual correction.",
                "If confidence is low, the system should ask for a retake or switch to companion mode.",
            ],
            "holds": holds,
            "analysis": analysis,
        },
    }


def select_mode_payload(mode: str, result: Dict) -> Dict:
    if mode == "holds":
        return {
            "provider": result["provider"],
            "holds": result["wallMap"]["holds"],
            "analysis": result["wallMap"]["analysis"],
        }
    if mode == "routes":
        return {
            "provider": result["provider"],
            "routeCandidates": result["routeCandidates"],
            "analysis": result["wallMap"]["analysis"],
        }
    return result


def main():
    payload = parse_payload()
    image = decode_image(payload.get("imageDataUrl", ""))
    result = build_wall_map(payload, image)
    mode = payload.get("mode") or "full"
    print(json.dumps({"success": True, "result": select_mode_payload(mode, result)}))


if __name__ == "__main__":
    main()
