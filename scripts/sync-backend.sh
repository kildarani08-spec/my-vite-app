#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/backend/ecommerce/"
DEST_DIR="/Applications/XAMPP/xamppfiles/htdocs/ecommerce/"

DRY_RUN=false
DELETE_MISSING=false

for arg in "$@"; do
  case "$arg" in
    --dry-run|-n)
      DRY_RUN=true
      ;;
    --delete)
      DELETE_MISSING=true
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      echo "Usage: ./scripts/sync-backend.sh [--dry-run] [--delete]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "Source directory not found: ${SRC_DIR}" >&2
  exit 1
fi

if [[ ! -d "${DEST_DIR}" ]]; then
  echo "Destination directory not found: ${DEST_DIR}" >&2
  exit 1
fi

RSYNC_OPTS=(
  -av
  --itemize-changes
  --include='*/'
  --include='*.php'
  --include='lib/***'
  --include='data/settings_fallback.json'
  --exclude='*'
)

if [[ "${DRY_RUN}" == true ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

if [[ "${DELETE_MISSING}" == true ]]; then
  RSYNC_OPTS+=(--delete)
fi

echo "Syncing backend from ${SRC_DIR} to ${DEST_DIR}"
if [[ "${DRY_RUN}" == true ]]; then
  echo "Mode: dry-run (no files changed)"
fi
if [[ "${DELETE_MISSING}" == true ]]; then
  echo "Mode: delete enabled (removes missing files at destination for included paths)"
fi

rsync "${RSYNC_OPTS[@]}" "${SRC_DIR}" "${DEST_DIR}"

echo "Backend sync complete."
