import json
import sys
import traceback

import calibrate
import infer


class VisionServiceError(Exception):
    pass


def _raise_fail(message: str):
    raise VisionServiceError(message)


infer.fail = _raise_fail
calibrate.fail = _raise_fail


def emit(payload):
    print(json.dumps(payload), flush=True)


def build_health_payload(warm: bool):
    runtime_status = infer.get_xiaoxiae_runtime_status()
    model_loaded = bool(infer._XIAOXIAE_PREDICTOR is not None and infer._TRIPLET_MODEL is not None)

    if warm and runtime_status["ready"]:
        infer.get_xiaoxiae_predictor()
        infer.get_triplet_components()
        infer.get_neutral_color_bundle()
        model_loaded = True

    return {
        "provider": infer.XIAOXIAE_PROVIDER_NAME,
        "ready": runtime_status["ready"],
        "modelLoaded": model_loaded,
        "runtime": runtime_status,
    }


def run_inference(message):
    image = infer.decode_image(message.get("imageDataUrl", ""))
    result = infer.build_wall_map(message, image)
    mode = message.get("mode") or "full"
    return infer.select_mode_payload(mode, result)


def run_calibration(message):
    return calibrate.build_planar_calibration(message)


def handle_message(message):
    action = str(message.get("action") or "").strip().lower()

    if action == "health":
        return build_health_payload(bool(message.get("warm")))
    if action == "infer":
        return run_inference(message)
    if action == "calibrate":
        return run_calibration(message)

    raise VisionServiceError(f'Unsupported vision service action "{action}".')


def main():
    for line in sys.stdin:
        if not line.strip():
            continue

        request_id = None
        try:
            message = json.loads(line)
            request_id = message.get("id")
            result = handle_message(message)
            emit({"id": request_id, "success": True, "result": result})
        except Exception as exc:  # pragma: no cover - long-running bridge
            traceback.print_exc(file=sys.stderr)
            emit(
                {
                    "id": request_id,
                    "success": False,
                    "message": str(exc) or "Vision service request failed.",
                }
            )


if __name__ == "__main__":
    main()
