#!/bin/sh
set -eu

if [ -z "${API_UPSTREAM:-}" ]; then
  echo "API_UPSTREAM is not set; skipping upstream DNS wait."
  exit 0
fi

upstream="${API_UPSTREAM#http://}"
upstream="${upstream#https://}"
upstream="${upstream%%/*}"
host="${upstream%%:*}"

if [ -z "$host" ]; then
  echo "API_UPSTREAM does not contain a hostname: $API_UPSTREAM"
  exit 1
fi

echo "Waiting for API upstream DNS: $host ..."

attempt=1
while [ "$attempt" -le 60 ]; do
  if getent hosts "$host" >/dev/null 2>&1; then
    echo "API upstream resolved: $host"
    exit 0
  fi

  echo "API upstream not resolvable yet: $host (attempt $attempt/60)"
  attempt=$((attempt + 1))
  sleep 1
done

echo "API upstream did not resolve after 60 seconds: $host"
exit 1
