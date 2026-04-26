#!/bin/sh
set -eu

python scripts/ensureVisionAssets.py

exec "$@"
