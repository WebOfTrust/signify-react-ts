#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APT_CACHE_DIR="${APT_CACHE_DIR:-${ROOT_DIR}/.ci/apt}"
APT_ARCHIVES_DIR="${APT_CACHE_DIR}/archives"

mkdir -p "${APT_ARCHIVES_DIR}/partial"

install_cached_debs() {
  shopt -s nullglob
  local debs=("${APT_ARCHIVES_DIR}"/*.deb)
  shopt -u nullglob

  if (( ${#debs[@]} == 0 )); then
    return 1
  fi

  sudo apt-get install -y "${debs[@]}"
}

if install_cached_debs; then
  exit 0
fi

sudo apt-get update
sudo apt-get -o Dir::Cache="${APT_CACHE_DIR}" install -y libsodium-dev
