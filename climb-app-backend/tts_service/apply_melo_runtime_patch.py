import importlib.util
import os
from pathlib import Path


PATCH_FILE_NAMES = (
    "__init__.py",
    "cleaner.py",
    "english_light.py",
    "chinese_mix_light.py",
)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text_if_changed(target_path: Path, content: str):
    if target_path.exists():
        try:
            if _read_text(target_path) == content:
                return False
        except UnicodeDecodeError:
            pass

    target_path.write_text(content, encoding="utf-8", newline="\n")
    return True


def find_melo_text_dir() -> Path:
    spec = importlib.util.find_spec("melo")
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError("Unable to locate the installed MeloTTS package.")

    package_dir = Path(next(iter(spec.submodule_search_locations)))
    text_dir = package_dir / "text"
    if not text_dir.exists():
        raise RuntimeError(f"MeloTTS text package not found at {text_dir}.")

    return text_dir


def apply_runtime_patch():
    current_dir = Path(__file__).resolve().parent
    patch_dir = current_dir / "melo_patch"
    text_dir = find_melo_text_dir()
    patched_files = []

    for file_name in PATCH_FILE_NAMES:
        source_path = patch_dir / file_name
        if not source_path.exists():
            raise RuntimeError(f"Required Melo patch file is missing: {source_path}")

        target_path = text_dir / file_name
        if _write_text_if_changed(target_path, _read_text(source_path)):
            patched_files.append(str(target_path))

    return {
        "textDir": str(text_dir),
        "patchedFiles": patched_files,
    }
