import base64
import json
import os
import sys
import tempfile
import traceback

PROTOCOL_STDOUT = os.fdopen(os.dup(sys.__stdout__.fileno()), "w", encoding="utf-8", buffering=1)
sys.stdout = sys.stderr

for proxy_env_name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(proxy_env_name, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

try:
    from melo.api import TTS
    IMPORT_ERROR = None
except Exception as exc:  # pragma: no cover - runtime dependency check
    TTS = None
    IMPORT_ERROR = exc

SUPPORTED_LANGUAGES = {"ZH", "EN", "ES", "FR", "JP", "KR"}
DEFAULT_DEVICE = (os.getenv("MELO_TTS_DEVICE") or "cpu").strip() or "cpu"
DEFAULT_LANGUAGE = (os.getenv("MELO_TTS_DEFAULT_LANGUAGE") or "ZH").strip().upper() or "ZH"
DEFAULT_SPEED = float(os.getenv("MELO_TTS_DEFAULT_SPEED") or "1.0")
DEFAULT_SPEAKERS = {
    "ZH": "ZH",
    "EN": "EN-Default",
    "ES": "ES",
    "FR": "FR",
    "JP": "JP",
    "KR": "KR",
}


def emit(payload):
    PROTOCOL_STDOUT.write(json.dumps(payload, ensure_ascii=False) + "\n")
    PROTOCOL_STDOUT.flush()


def normalize_language(value):
    language = str(value or DEFAULT_LANGUAGE).strip().upper()
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f'Unsupported TTS language "{value}".')
    return language


def normalize_speed(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = DEFAULT_SPEED

    return max(0.6, min(1.8, parsed))


class MeloRuntime:
    def __init__(self):
        self.models = {}

    def ensure_dependency_ready(self):
        if IMPORT_ERROR is not None:
            raise RuntimeError(
                "MeloTTS is not installed in the configured Python environment. "
                "Install requirements from climb-app-backend/requirements-melo-tts.txt first."
            ) from IMPORT_ERROR

    def get_model_bundle(self, language):
        self.ensure_dependency_ready()
        if language not in self.models:
            model = TTS(language=language, device=DEFAULT_DEVICE, use_hf=False)
            model.hps.data.disable_bert = True
            self.models[language] = {
                "model": model,
                "speaker_ids": dict(model.hps.data.spk2id),
            }
        return self.models[language]

    def get_default_speaker(self, language, speaker_ids):
        preferred = (os.getenv(f"MELO_TTS_{language}_SPEAKER") or "").strip()
        if preferred and preferred in speaker_ids:
            return preferred

        preferred = (os.getenv("MELO_TTS_DEFAULT_SPEAKER") or "").strip()
        if preferred and preferred in speaker_ids:
            return preferred

        fallback = DEFAULT_SPEAKERS.get(language)
        if fallback in speaker_ids:
            return fallback

        return next(iter(speaker_ids.keys()))

    def health(self, language):
        bundle = self.get_model_bundle(language)
        return {
            "ready": True,
            "language": language,
            "speakers": sorted(bundle["speaker_ids"].keys()),
            "device": DEFAULT_DEVICE,
        }

    def synthesize(self, text, language, speaker, speed):
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Text is required for speech synthesis.")

        bundle = self.get_model_bundle(language)
        speaker_ids = bundle["speaker_ids"]
        selected_speaker = (speaker or "").strip() or self.get_default_speaker(language, speaker_ids)
        if selected_speaker not in speaker_ids:
            raise ValueError(
                f'Unknown speaker "{selected_speaker}" for language {language}. '
                f"Available speakers: {', '.join(sorted(speaker_ids.keys()))}."
            )

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_path = temp_file.name

            bundle["model"].tts_to_file(text, speaker_ids[selected_speaker], temp_path, speed=speed)
            with open(temp_path, "rb") as audio_file:
                audio_bytes = audio_file.read()
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

        return {
            "language": language,
            "speaker": selected_speaker,
            "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
            "byteLength": len(audio_bytes),
        }


def main():
    runtime = MeloRuntime()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            action = payload.get("action")
            language = normalize_language(payload.get("language"))

            if action == "health" or action == "warmup":
                result = runtime.health(language)
            elif action == "synthesize":
                result = runtime.synthesize(
                    text=payload.get("text"),
                    language=language,
                    speaker=payload.get("speaker"),
                    speed=normalize_speed(payload.get("speed")),
                )
            else:
                raise ValueError(f'Unsupported action "{action}".')

            emit({
                "id": request_id,
                "success": True,
                **result,
            })
        except Exception as exc:  # pragma: no cover - runtime transport
            emit({
                "id": request_id,
                "success": False,
                "message": str(exc),
                "details": traceback.format_exc(limit=1).strip(),
            })


if __name__ == "__main__":
    main()
