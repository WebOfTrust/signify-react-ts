#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPS_DIR="${ROOT_DIR}/.ci/deps"
KERIPY_DIR="${DEPS_DIR}/keripy"
KERIA_DIR="${DEPS_DIR}/keria"

KERIPY_REPO="${KERIPY_REPO:-https://github.com/WebOfTrust/keripy.git}"
KERIPY_BRANCH="${KERIPY_BRANCH:-v1.2.13}"
KERIPY_REF="${KERIPY_REF:-cbbf700fa8091587b96b5475c5f50d1d8bf3ca40}"

KERIA_REPO="${KERIA_REPO:-https://github.com/WebOfTrust/keria.git}"
KERIA_BRANCH="${KERIA_BRANCH:-main}"
KERIA_REF="${KERIA_REF:-aba457cab3813078bfedb65a7d819f48d86974b8}"

sync_repo() {
  local dir="$1"
  local repo="$2"
  local branch="$3"
  local ref="$4"

  mkdir -p "$(dirname "$dir")"

  if [[ ! -d "${dir}/.git" ]]; then
    rm -rf "$dir"
    git clone --no-checkout "$repo" "$dir"
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

python -m pip install --upgrade pip wheel setuptools

sync_repo "$KERIPY_DIR" "$KERIPY_REPO" "$KERIPY_BRANCH" "$KERIPY_REF"
sync_repo "$KERIA_DIR" "$KERIA_REPO" "$KERIA_BRANCH" "$KERIA_REF"

python -m pip install -r "${ROOT_DIR}/.github/ci/keria-runtime-requirements.txt"
python -m pip install "$KERIPY_DIR"
python -m pip install --no-deps "$KERIA_DIR"

python - <<'PY'
import keri
import keria

assert keri.__version__ == "1.2.13", f"expected keri 1.2.13, got {keri.__version__}"
assert keria.__version__ == "0.4.0", f"expected keria 0.4.0, got {keria.__version__}"

print(f"Installed keri {keri.__version__} and keria {keria.__version__}")
PY
