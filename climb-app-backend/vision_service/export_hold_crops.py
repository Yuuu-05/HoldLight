import argparse
import json
import os
from typing import Dict, Iterable, List

import cv2
import numpy as np

from color_classifier import is_image_file, make_masked_rgba_crop, read_image_unicode, write_image_unicode
from infer import DETECTRON_SCORE_THRESHOLD, clamp, get_xiaoxiae_predictor


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export masked hold crops for manual white/black/other labelling.",
    )
    parser.add_argument("--input-dir", required=True, help="Folder of wall images.")
    parser.add_argument("--output-dir", required=True, help="Where to write unsorted masked hold crops.")
    parser.add_argument("--score-threshold", type=float, default=DETECTRON_SCORE_THRESHOLD)
    parser.add_argument("--pad-ratio", type=float, default=0.08)
    parser.add_argument("--max-detections", type=int, default=80, help="Maximum hold instances to export per image.")
    return parser.parse_args()


def iter_image_paths(root_dir: str) -> Iterable[str]:
    for current_root, _, filenames in os.walk(root_dir):
        for filename in sorted(filenames):
            path = os.path.join(current_root, filename)
            if is_image_file(path):
                yield path


def detect_hold_instances(image_bgr: np.ndarray, score_threshold: float, max_detections: int) -> List[Dict]:
    predictor = get_xiaoxiae_predictor()
    outputs = predictor(image_bgr)
    instances = outputs["instances"].to("cpu")
    if not len(instances):
        return []

    image_height, image_width = image_bgr.shape[:2]
    pred_classes = instances.pred_classes.numpy().tolist()
    pred_scores = instances.scores.numpy().tolist()
    pred_boxes = instances.pred_boxes.tensor.numpy()

    kept_indices = [
        index
        for index, pred_class in enumerate(pred_classes)
        if pred_class == 0 and float(pred_scores[index]) >= score_threshold
    ]
    kept_indices = sorted(kept_indices, key=lambda index: float(pred_scores[index]), reverse=True)
    if max_detections > 0:
        kept_indices = kept_indices[:max_detections]

    records: List[Dict] = []
    for index in kept_indices:
        score = float(pred_scores[index])
        x1, y1, x2, y2 = pred_boxes[index].astype(int).tolist()
        x1 = int(clamp(x1, 0, image_width - 1))
        y1 = int(clamp(y1, 0, image_height - 1))
        x2 = int(clamp(x2, x1 + 1, image_width))
        y2 = int(clamp(y2, y1 + 1, image_height))
        mask = instances.pred_masks[index].numpy().astype(np.uint8)
        records.append(
            {
                "index": index,
                "score": round(score, 4),
                "bbox": [x1, y1, x2, y2],
                "mask": mask,
            }
        )
    return records


def main():
    args = parse_args()
    if not os.path.isdir(args.input_dir):
        raise FileNotFoundError(f"Input directory does not exist: {args.input_dir}")

    unsorted_dir = os.path.join(args.output_dir, "unsorted")
    os.makedirs(unsorted_dir, exist_ok=True)

    manifest_path = os.path.join(args.output_dir, "manifest.jsonl")
    exported = 0
    source_images = 0
    image_paths = list(iter_image_paths(args.input_dir))
    if not image_paths:
        raise ValueError(
            "No input images were found. Supported extensions: "
            + ", ".join(sorted(IMAGE_EXTENSIONS))
        )

    with open(manifest_path, "w", encoding="utf-8") as manifest_file:
        for image_path in image_paths:
            image_bgr = read_image_unicode(image_path, cv2.IMREAD_COLOR)
            if image_bgr is None:
                print(
                    json.dumps(
                        {"warning": f"Unable to read image, skipping: {image_path}"},
                        ensure_ascii=False,
                    )
                )
                continue

            source_images += 1
            image_name = os.path.splitext(os.path.basename(image_path))[0]
            image_out_dir = os.path.join(unsorted_dir, image_name)
            os.makedirs(image_out_dir, exist_ok=True)

            detections = detect_hold_instances(image_bgr, args.score_threshold, args.max_detections)
            for local_index, detection in enumerate(detections, start=1):
                rgba_crop = make_masked_rgba_crop(
                    image_bgr,
                    detection["mask"],
                    tuple(detection["bbox"]),
                    pad_ratio=args.pad_ratio,
                )
                if rgba_crop.size == 0:
                    continue

                output_name = f"{image_name}_hold_{local_index:03d}_s{int(round(detection['score'] * 1000)):03d}.png"
                output_path = os.path.join(image_out_dir, output_name)
                if not write_image_unicode(output_path, rgba_crop):
                    print(
                        json.dumps(
                            {"warning": f"Unable to write crop, skipping: {output_path}"},
                            ensure_ascii=False,
                        )
                    )
                    continue

                manifest_record = {
                    "cropPath": output_path,
                    "sourceImage": image_path,
                    "score": detection["score"],
                    "bbox": detection["bbox"],
                }
                manifest_file.write(json.dumps(manifest_record, ensure_ascii=True) + "\n")
                exported += 1

    print(
        json.dumps(
            {
                "outputDir": args.output_dir,
                "manifest": manifest_path,
                "sourceImages": source_images,
                "exportedCrops": exported,
            },
            ensure_ascii=True,
        )
    )


if __name__ == "__main__":
    main()
