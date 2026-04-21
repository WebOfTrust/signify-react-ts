# CI

The repository uses GitHub Actions to run the Signify boundary smoke tests
against a real local KERIA stack.

Workflow: `.github/workflows/ci.yml`

## What CI Runs

The main CI job:

1. installs system dependencies needed by KERIpy, currently `libsodium-dev`,
2. sets up Python 3.12.8,
3. sets up Node.js and pnpm,
4. installs Node dependencies from `pnpm-lock.yaml`,
5. installs a Puppeteer browser,
6. installs pinned KERIpy and KERIA from GitHub commits,
7. starts local KERI demo witnesses,
8. starts local KERIA,
9. runs `pnpm test:ci`,
10. uploads KERIA/witness logs on success or failure.

`pnpm test:ci` currently runs:

```bash
pnpm lint
pnpm build
pnpm keria:smoke -- --mode connect
pnpm keria:smoke
pnpm browser:smoke
```

Future tests that require the same local KERIA stack should be added to
`test:ci` or called from that script.

## Pinned Python Stack

CI installs these exact repositories:

| Project | Branch | Commit | Version |
| --- | --- | --- | --- |
| KERIpy | `v1.2.13` | `cbbf700fa8091587b96b5475c5f50d1d8bf3ca40` | `keri==1.2.13` |
| KERIA | `main` | `aba457cab3813078bfedb65a7d819f48d86974b8` | `keria==0.4.0` |

The install script is `scripts/ci/install-keri-stack.sh`.

KERIA `0.4.0` declares `keri==1.2.12`, but this CI intentionally tests the
requested KERIpy `1.2.13` commit. To make that explicit, the script:

1. installs KERIA runtime dependencies from
   `.github/ci/keria-runtime-requirements.txt`,
2. installs KERIpy from the pinned commit,
3. installs KERIA from the pinned commit with `--no-deps`,
4. verifies `keri.__version__ == "1.2.13"` and
   `keria.__version__ == "0.4.0"`.

Do not replace this with an unconstrained `pip install keria`; that would allow
the resolver to choose a different KERIpy version.

## Local Services

The service scripts are:

- `scripts/ci/start-keri-stack.sh`
- `scripts/ci/stop-keri-stack.sh`

The start script runs both services with `INFO` logging by default:

```bash
kli witness demo --loglevel INFO
keria start --config-dir scripts --config-file demo-witness-oobis --loglevel INFO
```

The witness process is started from the cloned KERIpy checkout. That matters:
`kli witness demo` resolves its demo witness configs relative to the KERIpy
tree, including `scripts/keri/cf/main/wan.json`,
`scripts/keri/cf/main/wil.json`, and `scripts/keri/cf/main/wes.json` in the
pinned `v1.2.13` commit. The start script checks for these files before
launching the witnesses.

The KERIA process is started from the cloned KERIA checkout for the same
reason. The pinned KERIA commit carries the demo agent and OOBI configuration
under `scripts/keria.json`, `scripts/keri/cf/demo-witness-oobis.json`, and
`scripts/keri/cf/keria.json`. The start script checks for those files before
launching KERIA and then runs `keria start` from the KERIA repo root.

The log levels can be overridden for a diagnostic run:

```bash
WITNESS_LOGLEVEL=DEBUG KERIA_LOGLEVEL=DEBUG scripts/ci/start-keri-stack.sh
```

Expected ports:

| Service | Port |
| --- | --- |
| Wan witness HTTP | `5642` |
| Wil witness HTTP | `5643` |
| Wes witness HTTP | `5644` |
| KERIA admin API | `3901` |
| KERIA router API | `3902` |
| KERIA boot API | `3903` |

The start script waits for all ports before returning. Logs are written under
`${RUNNER_TEMP}/keri-stack/logs` in GitHub Actions and uploaded as the
`keria-stack-logs` artifact.

## Caching

CI uses these caches:

- pnpm dependency cache via `actions/setup-node`.
- pip cache via `actions/setup-python`.
- pinned KERI repository clones under `.ci/deps`.
- Puppeteer browser cache under `~/.cache/puppeteer`.

The KERI repository cache key includes the pinned KERIpy and KERIA commits, so
changing either commit creates a fresh cache.

## Updating Pinned KERI Versions

To update KERIpy or KERIA:

1. update `KERIPY_BRANCH` / `KERIPY_REF` or `KERIA_BRANCH` / `KERIA_REF` in
   `.github/workflows/ci.yml`,
2. update the version assertions in `scripts/ci/install-keri-stack.sh`,
3. update this document,
4. run the smoke tests locally against the same versions if possible.
