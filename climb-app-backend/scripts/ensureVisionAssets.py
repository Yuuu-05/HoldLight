import os
import time
import urllib.request
from pathlib import Path
from typing import Dict, Optional


BASE_DIR = Path(__file__).resolve().parents[1]
LFS_SIGNATURE = b"version https://git-lfs.github.com/spec/v1"
DOWNLOAD_TIMEOUT_SECONDS = int(os.environ.get("VISION_MODEL_DOWNLOAD_TIMEOUT_SECONDS", "600"))
DOWNLOAD_RETRIES = int(os.environ.get("VISION_MODEL_DOWNLOAD_RETRIES", "3"))

DOWNLOADABLE_ASSETS = (
    {
        "path": "vision_service/models/xiaoxiae/hold_detector/model_final.pth",
        "minimum_size": 300 * 1024 * 1024,
        "url_env": "VISION_XIAOXIAE_HOLD_WEIGHTS_URL",
    },
    {
        "path": "vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt",
        "minimum_size": 90 * 1024 * 1024,
        "url_env": "VISION_XIAOXIAE_ROUTE_WEIGHTS_URL",
    },
)

OPTIONAL_DOWNLOADABLE_ASSETS = (
    {
        "path": "vision_service/models/xiaoxiae/color_classifier/neutral_hold_classifier.pt",
        "minimum_size": 64 * 1024,
        "url_env": "VISION_NEUTRAL_COLOR_MODEL_URL",
        "fallback": "HSV color fallback",
    },
)


def validate_asset(path: Path, minimum_size: int) -> Optional[str]:
    if not path.exists():
        return "is missing."

    size = path.stat().st_size
    if size < minimum_size:
        return f"is unexpectedly small ({size} bytes)."

    with path.open("rb") as handle:
        header = handle.read(256)
    if LFS_SIGNATURE in header:
        return "is still a Git LFS pointer."

    return None


def build_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {}

    auth_header = os.environ.get("VISION_MODEL_DOWNLOAD_AUTH_HEADER", "").strip()
    if auth_header:
        if ":" not in auth_header:
            raise SystemExit(
                "VISION_MODEL_DOWNLOAD_AUTH_HEADER must use 'Header-Name: value' format."
            )
        name, value = auth_header.split(":", 1)
        headers[name.strip()] = value.strip()

    bearer_token = os.environ.get("VISION_MODEL_DOWNLOAD_BEARER_TOKEN", "").strip()
    if bearer_token and "Authorization" not in headers:
        headers["Authorization"] = f"Bearer {bearer_token}"

    return headers


def download_asset(url: str, destination: Path, headers: Dict[str, str]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination.with_suffix(destination.suffix + ".part")

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        with temp_path.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

    temp_path.replace(destination)


def ensure_downloaded_asset(asset, headers: Dict[str, str]) -> None:
    destination = BASE_DIR / str(asset["path"])
    minimum_size = int(asset["minimum_size"])
    current_problem = validate_asset(destination, minimum_size)
    if current_problem is None:
        print(f"{asset['path']} is already present.")
        return

    url_env = str(asset["url_env"])
    url = os.environ.get(url_env, "").strip()
    if not url:
        raise SystemExit(
            f"{asset['path']} {current_problem} Set {url_env} so the container can download it at startup."
        )

    last_error = None
    for attempt in range(1, DOWNLOAD_RETRIES + 1):
        try:
            print(f"Downloading {asset['path']} from {url_env} (attempt {attempt}/{DOWNLOAD_RETRIES})...")
            download_asset(url, destination, headers)
            refreshed_problem = validate_asset(destination, minimum_size)
            if refreshed_problem is not None:
                raise RuntimeError(f"Downloaded file {refreshed_problem}")
            print(f"Prepared {asset['path']}.")
            return
        except Exception as error:  # pragma: no cover - defensive container boot path
            last_error = error
            if attempt == DOWNLOAD_RETRIES:
                break
            time.sleep(min(2 ** attempt, 10))

    raise SystemExit(f"Failed to prepare {asset['path']}: {last_error}")


def ensure_optional_downloaded_asset(asset, headers: Dict[str, str]) -> None:
    destination = BASE_DIR / str(asset["path"])
    minimum_size = int(asset["minimum_size"])
    current_problem = validate_asset(destination, minimum_size)
    if current_problem is None:
        print(f"{asset['path']} is already present.")
        return

    url_env = str(asset["url_env"])
    fallback = str(asset["fallback"])
    url = os.environ.get(url_env, "").strip()
    if not url:
        print(f"{asset['path']} {current_problem} Continuing with {fallback}.")
        return

    last_error = None
    for attempt in range(1, DOWNLOAD_RETRIES + 1):
        try:
            print(f"Downloading optional {asset['path']} from {url_env} (attempt {attempt}/{DOWNLOAD_RETRIES})...")
            download_asset(url, destination, headers)
            refreshed_problem = validate_asset(destination, minimum_size)
            if refreshed_problem is not None:
                raise RuntimeError(f"Downloaded file {refreshed_problem}")
            print(f"Prepared optional {asset['path']}.")
            return
        except Exception as error:  # pragma: no cover - defensive container boot path
            last_error = error
            if attempt == DOWNLOAD_RETRIES:
                break
            time.sleep(min(2 ** attempt, 10))

    print(f"Failed to prepare optional {asset['path']}: {last_error}. Continuing with {fallback}.")


def main() -> None:
    headers = build_headers()

    for asset in DOWNLOADABLE_ASSETS:
        ensure_downloaded_asset(asset, headers)

    for asset in OPTIONAL_DOWNLOADABLE_ASSETS:
        ensure_optional_downloaded_asset(asset, headers)

    print("Vision assets are ready.")


if __name__ == "__main__":
    main()
