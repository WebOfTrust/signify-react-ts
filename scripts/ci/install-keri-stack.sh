#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPS_DIR="${ROOT_DIR}/.ci/deps"
KERIPY_DIR="${DEPS_DIR}/keripy"
KERIA_DIR="${DEPS_DIR}/keria"
VLEI_DIR="${DEPS_DIR}/vlei"

KERIPY_REPO="${KERIPY_REPO:-https://github.com/WebOfTrust/keripy.git}"
KERIPY_BRANCH="${KERIPY_BRANCH:-v1.2.13}"
KERIPY_REF="${KERIPY_REF:-cbbf700fa8091587b96b5475c5f50d1d8bf3ca40}"

KERIA_REPO="${KERIA_REPO:-https://github.com/WebOfTrust/keria.git}"
KERIA_BRANCH="${KERIA_BRANCH:-main}"
KERIA_REF="${KERIA_REF:-aba457cab3813078bfedb65a7d819f48d86974b8}"

VLEI_REPO="${VLEI_REPO:-https://github.com/WebOfTrust/vLEI.git}"
VLEI_BRANCH="${VLEI_BRANCH:-main}"
VLEI_REF="${VLEI_REF:-f514b9431c5f965b5f7f64a8693e19df2f181564}"
WHEEL_DIR="${WHEEL_DIR:-${ROOT_DIR}/.ci/wheels/${KERIPY_REF}-${KERIA_REF}-${VLEI_REF}}"

sync_repo() {
  local dir="$1"
  local repo="$2"
  local branch="$3"
  local ref="$4"

  mkdir -p "$(dirname "$dir")"

  if [[ ! -d "${dir}/.git" ]]; then
    rm -rf "$dir"
    git clone --no-checkout "$repo" "$dir"
  else
    local actual
    local remote
    actual="$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)"
    remote="$(git -C "$dir" remote get-url origin 2>/dev/null || true)"
    if [[ "$actual" == "$ref" && "$remote" == "$repo" ]]; then
      git -C "$dir" reset --hard "$ref" >/dev/null
      git -C "$dir" clean -xdf >/dev/null
      echo "Using cached ${dir} at ${ref}"
      return
    fi
  fi

  git -C "$dir" remote set-url origin "$repo"
  git -C "$dir" fetch --depth 1 origin "$branch"

  if ! git -C "$dir" cat-file -e "${ref}^{commit}" 2>/dev/null; then
    git -C "$dir" fetch --depth 1 origin "$ref" || git -C "$dir" fetch origin "$branch"
  fi

  git -C "$dir" checkout --force "$ref"
  git -C "$dir" clean -xdf

  local actual
  actual="$(git -C "$dir" rev-parse HEAD)"
  if [[ "$actual" != "$ref" ]]; then
    echo "Expected ${dir} at ${ref}, got ${actual}" >&2
    exit 1
  fi
}

build_wheel() {
  local dir="$1"
  local distribution="$2"
  local wheel

  if wheel="$(find_wheel "$distribution" 2>/dev/null)"; then
    echo "Using cached wheel ${wheel}"
    return
  fi

  python -m pip wheel --no-deps --wheel-dir "$WHEEL_DIR" "$dir"
}

find_wheel() {
  local distribution="$1"

  python - "$WHEEL_DIR" "$distribution" <<'PY'
from pathlib import Path
import sys

wheel_dir = Path(sys.argv[1])
distribution = sys.argv[2].replace("-", "_").lower()
wheels = sorted(wheel_dir.glob(f"{distribution}-*.whl"))
if not wheels:
    raise SystemExit(f"No wheel found for {distribution} in {wheel_dir}")
print(wheels[-1])
PY
}

python -m pip install --upgrade pip wheel setuptools

sync_repo "$KERIPY_DIR" "$KERIPY_REPO" "$KERIPY_BRANCH" "$KERIPY_REF"
sync_repo "$KERIA_DIR" "$KERIA_REPO" "$KERIA_BRANCH" "$KERIA_REF"
sync_repo "$VLEI_DIR" "$VLEI_REPO" "$VLEI_BRANCH" "$VLEI_REF"

mkdir -p "$WHEEL_DIR"
build_wheel "$KERIPY_DIR" keri
build_wheel "$KERIA_DIR" keria
build_wheel "$VLEI_DIR" vlei

python -m pip install -r "${ROOT_DIR}/.github/ci/keria-runtime-requirements.txt"
python -m pip install "$(find_wheel keri)"
python -m pip install --no-deps "$(find_wheel keria)"
python -m pip install --no-deps "$(find_wheel vlei)"

python - <<'PY'
import keri
import keria
import vlei

assert keri.__version__ == "1.2.13", f"expected keri 1.2.13, got {keri.__version__}"
assert keria.__version__ == "0.4.0", f"expected keria 0.4.0, got {keria.__version__}"
assert vlei.__version__ == "1.0.2", f"expected vlei 1.0.2, got {vlei.__version__}"

print(f"Installed keri {keri.__version__}, keria {keria.__version__}, and vlei {vlei.__version__}")
PY
