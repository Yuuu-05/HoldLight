from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
LFS_SIGNATURE = b"version https://git-lfs.github.com/spec/v1"

REQUIRED_ASSETS = {
    "vision_service/models/xiaoxiae/hold_detector/model_final.pth": 300 * 1024 * 1024,
    "vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt": 90 * 1024 * 1024,
    "vision_service/models/xiaoxiae/color_classifier/neutral_hold_classifier.pt": 64 * 1024,
}


def main() -> None:
    problems: list[str] = []

    for relative_path, minimum_size in REQUIRED_ASSETS.items():
        asset_path = BASE_DIR / relative_path
        if not asset_path.exists():
            problems.append(f"{relative_path} is missing.")
            continue

        size = asset_path.stat().st_size
        if size < minimum_size:
            problems.append(
                f"{relative_path} is unexpectedly small ({size} bytes). "
                "This usually means Git LFS files were not downloaded."
            )

        with asset_path.open("rb") as handle:
            header = handle.read(256)
        if LFS_SIGNATURE in header:
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
