import base64
import json
import sys
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


CALIBRATION_PROVIDER_NAME = "python-opencv-planar-calibration"
MAX_FEATURE_IMAGE_WIDTH = 960
MIN_KEYPOINTS = 18
MIN_GOOD_MATCHES = 14
MIN_INLIERS = 8
MIN_INLIER_RATIO = 0.28
HOMOGRAPHY_RANSAC_THRESHOLD = 4.5
MAX_REPROJECTION_ERROR = 12.0
MIN_PROJECTED_AREA_RATIO = 0.1


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def fail(message: str):
    print(json.dumps({"success": False, "message": message}), file=sys.stderr)
    sys.exit(1)


def parse_payload() -> Dict:
    try:
        return json.load(sys.stdin)
    except Exception as exc:  # pragma: no cover - defensive path
        fail(f"Invalid JSON payload: {exc}")


def decode_image(data_url: str) -> np.ndarray:
    if not isinstance(data_url, str) or "," not in data_url:
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


def resize_image(image: np.ndarray, max_width: int = MAX_FEATURE_IMAGE_WIDTH) -> np.ndarray:
    height, width = image.shape[:2]
    if width <= max_width:
        return image

    scale = max_width / width
    next_size = (max_width, max(1, int(round(height * scale))))
    return cv2.resize(image, next_size, interpolation=cv2.INTER_AREA)


def preprocess_for_features(image_bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
    return clahe.apply(gray)


def get_hold_bbox_px(hold: Dict, width: int, height: int) -> Tuple[int, int, int, int]:
    if all(key in hold for key in ("x1Pct", "y1Pct", "x2Pct", "y2Pct")):
        x1 = int(round(float(hold["x1Pct"]) / 100.0 * width))
        y1 = int(round(float(hold["y1Pct"]) / 100.0 * height))
        x2 = int(round(float(hold["x2Pct"]) / 100.0 * width))
        y2 = int(round(float(hold["y2Pct"]) / 100.0 * height))
    else:
        radius_pct = float(hold.get("radiusPct") or 2.8)
        half_w = max(12, int(round(radius_pct / 100.0 * width)))
        half_h = max(12, int(round(radius_pct / 100.0 * height)))
        center_x = int(round(float(hold.get("xPct", 50.0)) / 100.0 * width))
        center_y = int(round(float(hold.get("yPct", 50.0)) / 100.0 * height))
        x1 = center_x - half_w
        y1 = center_y - half_h
        x2 = center_x + half_w
        y2 = center_y + half_h

    x1 = int(clamp(x1, 0, max(0, width - 1)))
    y1 = int(clamp(y1, 0, max(0, height - 1)))
    x2 = int(clamp(max(x1 + 1, x2), 1, width))
    y2 = int(clamp(max(y1 + 1, y2), 1, height))
    return x1, y1, x2, y2


def build_reference_feature_mask(reference_image: np.ndarray, wall_map: Dict) -> Optional[np.ndarray]:
    holds = wall_map.get("holds") if isinstance(wall_map, dict) else None
    if not isinstance(holds, list) or not holds:
        return None

    height, width = reference_image.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    union_x1, union_y1, union_x2, union_y2 = width, height, 0, 0

    for hold in holds:
        if not isinstance(hold, dict):
            continue

        x1, y1, x2, y2 = get_hold_bbox_px(hold, width, height)
        pad_x = max(8, int(round((x2 - x1) * 0.35)))
        pad_y = max(8, int(round((y2 - y1) * 0.35)))
        x1 = int(clamp(x1 - pad_x, 0, max(0, width - 1)))
        y1 = int(clamp(y1 - pad_y, 0, max(0, height - 1)))
        x2 = int(clamp(x2 + pad_x, 1, width))
        y2 = int(clamp(y2 + pad_y, 1, height))

        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, thickness=-1)
        union_x1 = min(union_x1, x1)
        union_y1 = min(union_y1, y1)
        union_x2 = max(union_x2, x2)
        union_y2 = max(union_y2, y2)

    if union_x2 > union_x1 and union_y2 > union_y1:
        union_pad_x = max(14, int(round((union_x2 - union_x1) * 0.18)))
        union_pad_y = max(14, int(round((union_y2 - union_y1) * 0.18)))
        union_x1 = int(clamp(union_x1 - union_pad_x, 0, max(0, width - 1)))
        union_y1 = int(clamp(union_y1 - union_pad_y, 0, max(0, height - 1)))
        union_x2 = int(clamp(union_x2 + union_pad_x, 1, width))
        union_y2 = int(clamp(union_y2 + union_pad_y, 1, height))
        cv2.rectangle(mask, (union_x1, union_y1), (union_x2, union_y2), 255, thickness=-1)

    mask = cv2.dilate(mask, np.ones((17, 17), dtype=np.uint8), iterations=1)
    coverage_ratio = float(np.count_nonzero(mask)) / float(max(1, width * height))
    return mask if coverage_ratio >= 0.04 else None


def match_binary_descriptors(reference_descriptors: np.ndarray, frame_descriptors: np.ndarray) -> List[cv2.DMatch]:
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    knn_matches = matcher.knnMatch(reference_descriptors, frame_descriptors, k=2)

    ratio_matches: List[cv2.DMatch] = []
    for pair in knn_matches:
        if len(pair) < 2:
            continue
        match_a, match_b = pair
        if match_a.distance < 0.78 * match_b.distance:
            ratio_matches.append(match_a)

    if len(ratio_matches) >= MIN_GOOD_MATCHES:
        return sorted(ratio_matches, key=lambda item: item.distance)

    cross_matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    cross_matches = cross_matcher.match(reference_descriptors, frame_descriptors)
    return sorted(cross_matches, key=lambda item: item.distance)


def detect_planar_matches(
    reference_gray: np.ndarray,
    frame_gray: np.ndarray,
    reference_mask: Optional[np.ndarray],
) -> Tuple[Optional[str], List[cv2.KeyPoint], List[cv2.KeyPoint], List[cv2.DMatch]]:
    detectors = [
        (
            "akaze",
            cv2.AKAZE_create(
                threshold=0.0009,
                nOctaves=4,
                nOctaveLayers=4,
            ),
        ),
        (
            "orb",
            cv2.ORB_create(
                nfeatures=2400,
                scaleFactor=1.2,
                nlevels=8,
                edgeThreshold=12,
                firstLevel=0,
                WTA_K=2,
                scoreType=cv2.ORB_HARRIS_SCORE,
                patchSize=31,
                fastThreshold=10,
            ),
        ),
    ]

    best_detector: Optional[str] = None
    best_reference_keypoints: List[cv2.KeyPoint] = []
    best_frame_keypoints: List[cv2.KeyPoint] = []
    best_matches: List[cv2.DMatch] = []

    for detector_name, detector in detectors:
        reference_keypoints, reference_descriptors = detector.detectAndCompute(reference_gray, reference_mask)
        frame_keypoints, frame_descriptors = detector.detectAndCompute(frame_gray, None)

        if (
            reference_descriptors is None
            or frame_descriptors is None
            or len(reference_keypoints) < MIN_KEYPOINTS
            or len(frame_keypoints) < MIN_KEYPOINTS
        ):
            continue

        matches = match_binary_descriptors(reference_descriptors, frame_descriptors)
        if len(matches) > len(best_matches):
            best_detector = detector_name
            best_reference_keypoints = reference_keypoints
            best_frame_keypoints = frame_keypoints
            best_matches = matches

        if len(matches) >= MIN_GOOD_MATCHES:
            return detector_name, reference_keypoints, frame_keypoints, matches

    return best_detector, best_reference_keypoints, best_frame_keypoints, best_matches


def polygon_area(points: np.ndarray) -> float:
    if points.shape[0] < 3:
        return 0.0
    x_coords = points[:, 0]
    y_coords = points[:, 1]
    return float(abs(np.dot(x_coords, np.roll(y_coords, -1)) - np.dot(y_coords, np.roll(x_coords, -1))) * 0.5)


def compute_reprojection_error(
    homography: np.ndarray,
    reference_points: np.ndarray,
    frame_points: np.ndarray,
    inlier_mask: np.ndarray,
) -> float:
    inlier_indices = np.where(inlier_mask.ravel() > 0)[0]
    if inlier_indices.size == 0:
        return 999.0

    reference_inliers = reference_points[inlier_indices].reshape(-1, 1, 2)
    frame_inliers = frame_points[inlier_indices].reshape(-1, 2)
    projected_points = cv2.perspectiveTransform(reference_inliers, homography).reshape(-1, 2)
    deltas = projected_points - frame_inliers
    distances = np.linalg.norm(deltas, axis=1)
    return float(np.median(distances)) if distances.size else 999.0


def to_pct_points(points: np.ndarray, width: int, height: int) -> List[Dict]:
    pct_points: List[Dict] = []
    for x_coord, y_coord in points:
        pct_points.append(
            {
                "xPct": round(clamp(float(x_coord) / max(1.0, width) * 100.0, 0.0, 100.0), 2),
                "yPct": round(clamp(float(y_coord) / max(1.0, height) * 100.0, 0.0, 100.0), 2),
            }
        )
    return pct_points


def project_hold(hold: Dict, homography: np.ndarray, reference_width: int, reference_height: int, frame_width: int, frame_height: int, alignment_confidence: float) -> Dict:
    center_point = np.array(
        [[[float(hold.get("xPct", 50.0)) / 100.0 * reference_width, float(hold.get("yPct", 50.0)) / 100.0 * reference_height]]],
        dtype=np.float32,
    )
    projected_center = cv2.perspectiveTransform(center_point, homography).reshape(-1, 2)[0]

    x1, y1, x2, y2 = get_hold_bbox_px(hold, reference_width, reference_height)
    hold_corners = np.array(
        [
            [[x1, y1]],
            [[x2, y1]],
            [[x2, y2]],
            [[x1, y2]],
        ],
        dtype=np.float32,
    )
    projected_corners = cv2.perspectiveTransform(hold_corners, homography).reshape(-1, 2)

    x_values = projected_corners[:, 0]
    y_values = projected_corners[:, 1]
    next_x1_pct = round(clamp(float(np.min(x_values)) / max(1.0, frame_width) * 100.0, 0.0, 100.0), 2)
    next_y1_pct = round(clamp(float(np.min(y_values)) / max(1.0, frame_height) * 100.0, 0.0, 100.0), 2)
    next_x2_pct = round(clamp(float(np.max(x_values)) / max(1.0, frame_width) * 100.0, 0.0, 100.0), 2)
    next_y2_pct = round(clamp(float(np.max(y_values)) / max(1.0, frame_height) * 100.0, 0.0, 100.0), 2)
    next_radius_pct = round(
        clamp(np.hypot(next_x2_pct - next_x1_pct, next_y2_pct - next_y1_pct) * 0.28, 1.2, 8.0),
        2,
    )

    return {
        **hold,
        "xPct": round(clamp(float(projected_center[0]) / max(1.0, frame_width) * 100.0, 0.0, 100.0), 2),
        "yPct": round(clamp(float(projected_center[1]) / max(1.0, frame_height) * 100.0, 0.0, 100.0), 2),
        "x1Pct": next_x1_pct,
        "y1Pct": next_y1_pct,
        "x2Pct": next_x2_pct,
        "y2Pct": next_y2_pct,
        "radiusPct": next_radius_pct,
        "projectedQuadPct": to_pct_points(projected_corners, frame_width, frame_height),
        "alignmentConfidence": alignment_confidence,
    }


def build_unavailable_result(message: str, detector_name: Optional[str] = None, match_count: int = 0, inlier_count: int = 0, inlier_ratio: float = 0.0, quality_pct: int = 0) -> Dict:
    return {
        "provider": CALIBRATION_PROVIDER_NAME,
        "status": "unavailable",
        "message": message,
        "qualityPct": int(quality_pct),
        "detector": detector_name or "",
        "matchCount": int(match_count),
        "inlierCount": int(inlier_count),
        "inlierRatio": round(float(inlier_ratio), 2),
        "projectedReferenceQuadPct": [],
        "alignedHolds": [],
        "homography": [],
    }


def build_planar_calibration(payload: Dict) -> Dict:
    wall_map = payload.get("wallMap")
    if not isinstance(wall_map, dict) or not isinstance(wall_map.get("holds"), list) or not wall_map.get("holds"):
        return build_unavailable_result("Wall map holds are required for live alignment.")

    reference_image = resize_image(decode_image(payload.get("referenceImageDataUrl", "")))
    frame_image = resize_image(decode_image(payload.get("frameImageDataUrl", "")))

    reference_height, reference_width = reference_image.shape[:2]
    frame_height, frame_width = frame_image.shape[:2]

    reference_gray = preprocess_for_features(reference_image)
    frame_gray = preprocess_for_features(frame_image)
    reference_mask = build_reference_feature_mask(reference_image, wall_map)

    detector_name, reference_keypoints, frame_keypoints, matches = detect_planar_matches(
        reference_gray,
        frame_gray,
        reference_mask,
    )

    if detector_name is None or len(matches) < MIN_GOOD_MATCHES:
        return build_unavailable_result(
            "The live frame does not match the scanned wall strongly enough yet.",
            detector_name=detector_name,
            match_count=len(matches),
        )

    reference_points = np.float32([reference_keypoints[match.queryIdx].pt for match in matches]).reshape(-1, 2)
    frame_points = np.float32([frame_keypoints[match.trainIdx].pt for match in matches]).reshape(-1, 2)
    homography, inlier_mask = cv2.findHomography(
        reference_points.reshape(-1, 1, 2),
        frame_points.reshape(-1, 1, 2),
        cv2.RANSAC,
        HOMOGRAPHY_RANSAC_THRESHOLD,
    )

    if homography is None or inlier_mask is None:
        return build_unavailable_result(
            "Planar wall alignment could not be stabilised from this frame.",
            detector_name=detector_name,
            match_count=len(matches),
        )

    inlier_count = int(np.sum(inlier_mask))
    inlier_ratio = float(inlier_count / max(1, len(matches)))
    reprojection_error = compute_reprojection_error(homography, reference_points, frame_points, inlier_mask)

    reference_corners = np.array(
        [
            [[0.0, 0.0]],
            [[float(reference_width), 0.0]],
            [[float(reference_width), float(reference_height)]],
            [[0.0, float(reference_height)]],
        ],
        dtype=np.float32,
    )
    projected_corners = cv2.perspectiveTransform(reference_corners, homography).reshape(-1, 2)
    projected_area_ratio = polygon_area(projected_corners) / float(max(1, frame_width * frame_height))
    convex_projected = cv2.isContourConvex(projected_corners.astype(np.float32))

    quality_pct = int(
        round(
            clamp(
                inlier_ratio * 52.0
                + min(26.0, inlier_count * 1.6)
                + clamp(projected_area_ratio, 0.0, 0.52) * 34.0
                + max(0.0, 18.0 - reprojection_error * 1.3),
                0.0,
                100.0,
            )
        )
    )

    if (
        inlier_count < MIN_INLIERS
        or inlier_ratio < MIN_INLIER_RATIO
        or reprojection_error > MAX_REPROJECTION_ERROR
        or projected_area_ratio < MIN_PROJECTED_AREA_RATIO
        or not convex_projected
    ):
        return build_unavailable_result(
            "Wall alignment is not reliable yet.",
            detector_name=detector_name,
            match_count=len(matches),
            inlier_count=inlier_count,
            inlier_ratio=inlier_ratio,
            quality_pct=quality_pct,
        )

    status = "locked" if quality_pct >= 68 and inlier_ratio >= 0.4 else "partial"
    alignment_confidence = round(clamp(quality_pct / 100.0, 0.0, 1.0), 2)
    aligned_holds = [
        project_hold(
            hold,
            homography,
            reference_width,
            reference_height,
            frame_width,
            frame_height,
            alignment_confidence,
        )
        for hold in wall_map.get("holds", [])
        if isinstance(hold, dict)
    ]

    return {
        "provider": CALIBRATION_PROVIDER_NAME,
        "status": status,
        "message": "Wall alignment locked to the live camera." if status == "locked" else "Wall alignment is stabilising.",
        "qualityPct": quality_pct,
        "detector": detector_name,
        "matchCount": len(matches),
        "inlierCount": inlier_count,
        "inlierRatio": round(inlier_ratio, 2),
        "projectedReferenceQuadPct": to_pct_points(projected_corners, frame_width, frame_height),
        "alignedHolds": aligned_holds,
        "homography": [round(float(value), 6) for value in homography.reshape(-1).tolist()],
    }


def main():
    payload = parse_payload()
    result = build_planar_calibration(payload)
    print(json.dumps({"success": True, "result": result}))


if __name__ == "__main__":
    main()
