import argparse
from pathlib import Path
from typing import List


BASE_DIR = Path(__file__).resolve().parents[1]
LFS_SIGNATURE = b"version https://git-lfs.github.com/spec/v1"

REQUIRED_ASSETS = {
    "vision_service/models/xiaoxiae/hold_detector/model_final.pth": {
        "minimum_size": 300 * 1024 * 1024,
        "downloadable": True,
    },
    "vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt": {
        "minimum_size": 90 * 1024 * 1024,
        "downloadable": True,
    },
    "vision_service/models/xiaoxiae/color_classifier/neutral_hold_classifier.pt": {
        "minimum_size": 64 * 1024,
        "downloadable": False,
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--allow-missing-downloadable",
        action="store_true",
        help="Permit downloadable model files to be absent. Use this when images fetch large weights at runtime.",
    )
    args = parser.parse_args()

    problems: List[str] = []

    for relative_path, config in REQUIRED_ASSETS.items():
        minimum_size = config["minimum_size"]
        downloadable = config["downloadable"]
        asset_path = BASE_DIR / relative_path
        if not asset_path.exists():
            if args.allow_missing_downloadable and downloadable:
                print(f"{relative_path} is missing in this environment and will be prepared at runtime.")
                continue
            problems.append(f"{relative_path} is missing.")
            continue

        size = asset_path.stat().st_size
        if size < minimum_size:
            if args.allow_missing_downloadable and downloadable:
                print(
                    f"{relative_path} is below the expected size in this environment and will be refreshed at runtime."
                )
                continue
            problems.append(
                f"{relative_path} is unexpectedly small ({size} bytes). "
                "This usually means Git LFS files were not downloaded."
            )

        with asset_path.open("rb") as handle:
            header = handle.read(256)
        if LFS_SIGNATURE in header:
            if args.allow_missing_downloadable and downloadable:
                print(f"{relative_path} is still a Git LFS pointer and will be replaced at runtime.")
                continue
            problems.append(
                f"{relative_path} is still a Git LFS pointer. "
                "Pull LFS assets before building the backend image."
            )

    if problems:
        joined = "\n- ".join(["Vision asset verification failed:"] + problems)
        raise SystemExit(joined)

    print("Vision assets verified.")


if __name__ == "__main__":
    main()
