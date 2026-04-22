#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPS_DIR="${ROOT_DIR}/.ci/deps"
KERIPY_DIR="${DEPS_DIR}/keripy"
KERIA_DIR="${DEPS_DIR}/keria"
RUN_DIR="${RUNNER_TEMP:-${ROOT_DIR}/.ci/run}/keri-stack"
LOG_DIR="${RUN_DIR}/logs"
PID_DIR="${RUN_DIR}/pids"
SCHEMA_DIR="${ROOT_DIR}/schemas/acdc"
CREDENTIAL_DIR="${ROOT_DIR}/schemas/credentials"
OOBI_DIR="${ROOT_DIR}/schemas/oobis"
WITNESS_LOGLEVEL="${WITNESS_LOGLEVEL:-INFO}"
KERIA_LOGLEVEL="${KERIA_LOGLEVEL:-INFO}"
VLEI_LOGLEVEL="${VLEI_LOGLEVEL:-INFO}"

mkdir -p "$LOG_DIR" "$PID_DIR"

socket_wait() {
  local host="$1"
  local port="$2"
  local label="$3"
  local attempts="${4:-120}"

  python - "$host" "$port" "$label" "$attempts" <<'PY'
import socket
import sys
import time

host, port, label, attempts = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])

for _ in range(attempts):
    try:
        with socket.create_connection((host, port), timeout=1):
            print(f"{label} is listening on {host}:{port}")
            raise SystemExit(0)
    except OSError:
        time.sleep(1)

print(f"Timed out waiting for {label} on {host}:{port}", file=sys.stderr)
raise SystemExit(1)
PY
}

for config_name in wan wil wes; do
  if [[ ! -f "${KERIPY_DIR}/scripts/keri/cf/main/${config_name}.json" ]]; then
    echo "Missing KERIpy witness config: scripts/keri/cf/main/${config_name}.json" >&2
    echo "Run this script from a checkout that matches the pinned KERIpy witness demo layout." >&2
    exit 1
  fi
done

if [[ ! -f "${KERIA_DIR}/scripts/keria.json" ]]; then
  echo "Missing KERIA config: scripts/keria.json" >&2
  echo "Run this script after cloning the pinned KERIA repository." >&2
  exit 1
fi

for config_name in demo-witness-oobis keria; do
  if [[ ! -f "${KERIA_DIR}/scripts/keri/cf/${config_name}.json" ]]; then
    echo "Missing KERIA config: scripts/keri/cf/${config_name}.json" >&2
    echo "Run this script after cloning the pinned KERIA repository." >&2
    exit 1
  fi
done

if [[ ! -f "${SCHEMA_DIR}/sedi-voter-id-credential.json" ]]; then
  echo "Missing SEDI voter credential schema at ${SCHEMA_DIR}/sedi-voter-id-credential.json" >&2
  exit 1
fi

echo "Starting KERI demo witnesses"
(
  cd "$KERIPY_DIR"
  exec kli witness demo --loglevel "$WITNESS_LOGLEVEL"
) >"${LOG_DIR}/witness.log" 2>&1 &
echo "$!" >"${PID_DIR}/witness.pid"

socket_wait 127.0.0.1 5642 "Wan witness"
socket_wait 127.0.0.1 5643 "Wil witness"
socket_wait 127.0.0.1 5644 "Wes witness"

echo "Starting KERIA"
(
  cd "$KERIA_DIR"
  export KERI_AGENT_CORS=1
  exec keria start \
    --config-dir scripts \
    --config-file demo-witness-oobis \
    --loglevel "$KERIA_LOGLEVEL"
) >"${LOG_DIR}/keria.log" 2>&1 &
echo "$!" >"${PID_DIR}/keria.pid"

socket_wait 127.0.0.1 3901 "KERIA admin API"
socket_wait 127.0.0.1 3902 "KERIA router API"
socket_wait 127.0.0.1 3903 "KERIA boot API"

echo "Starting vLEI schema server"
(
  cd "$ROOT_DIR"
  exec vLEI-server \
    --http 7723 \
    --schema-dir "$SCHEMA_DIR" \
    --cred-dir "$CREDENTIAL_DIR" \
    --oobi-dir "$OOBI_DIR" \
    --loglevel "$VLEI_LOGLEVEL"
) >"${LOG_DIR}/vlei.log" 2>&1 &
echo "$!" >"${PID_DIR}/vlei.pid"

socket_wait 127.0.0.1 7723 "vLEI schema server"

echo "KERIA stack logs: ${LOG_DIR}"
