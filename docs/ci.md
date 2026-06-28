# CI

The repository uses GitHub Actions to run fast static app checks separately
from the Signify boundary smoke tests that need a real local KERIA stack.

Workflow: `.github/workflows/ci.yml`

## Required Jobs

### Static app checks

The static app job is Node-only and runs:

```bash
pnpm ci:static
```

That script runs lint, production build, and the unit suite. Unit tests use
`vitest.unit.config.ts` so pure unit files can run in parallel without changing
the serial policy used by live KERIA scenarios.

### Live KERIA smoke

The live KERIA job:

1. installs system dependencies needed by KERIpy, currently `libsodium-dev`,
2. sets up Python 3.12.8,
3. sets up Node.js and pnpm,
4. installs Node dependencies from `pnpm-lock.yaml`,
5. installs a Puppeteer browser,
6. installs pinned KERIpy, KERIA, and vLEI from GitHub commits,
7. starts local KERI demo witnesses,
8. starts local KERIA,
9. runs `pnpm ci:live`,
10. uploads KERIA/witness logs on success or failure.

`pnpm ci:live` currently runs:

```bash
pnpm keria:smoke -- --mode connect
pnpm keria:smoke
pnpm scenario:ci
pnpm browser:ci-smoke
```

`pnpm test:ci` remains as a local parity wrapper for developers who want the
same static and live checks in one command:

```bash
pnpm ci:static && pnpm ci:live
```

Future required checks that need the same local KERIA stack should be added to
`ci:live` or a script it calls. Do not append broad/manual suites to required
CI unless they protect an active change.

`pnpm scenario:ci` is the required live scenario subset. It keeps one
two-member multisig canary for invitation, acceptance, interaction, and
rotation, but leaves the full multisig matrix in `pnpm multisig:test`.

`pnpm scenario:test` runs the broader top-level scenario files for manual or
pre-merge confidence. Optional schema and external-fixture scenarios live under
`tests/scenarios/optional` and are available through `pnpm scenario:test:all`,
where they skip unless their required config is present.

The W3C holder presentation smoke is intentionally not part of required PR CI.
It attaches to a pre-seeded live W3C stack with W3C-enabled KERIA and live
verifier services:

```bash
pnpm w3c:holder-presentation:smoke
```

If this smoke becomes automated, pin KERIA and any cross-repo stack inputs by
immutable SHAs, not floating branches.

## Pinned Python Stack

CI installs these exact repositories:

| Project | Branch    | Commit                                     | Version        |
|---------|-----------|--------------------------------------------|----------------|
| KERIpy  | `v1.2.13` | `cbbf700fa8091587b96b5475c5f50d1d8bf3ca40` | `keri==1.2.13` |
| KERIA   | `main`    | `aba457cab3813078bfedb65a7d819f48d86974b8` | `keria==0.4.0` |
| vLEI    | `main`    | `f514b9431c5f965b5f7f64a8693e19df2f181564` | `vlei==1.0.2`  |

The install script is `scripts/ci/install-keri-stack.sh`.

KERIA `0.4.0` declares `keri==1.2.12`, but this CI intentionally tests the
requested KERIpy `1.2.13` commit. To make that explicit, the script:

1. installs KERIA runtime dependencies from
   `.github/ci/keria-runtime-requirements.txt`,
2. restores or builds local wheels for the pinned KERIpy, KERIA, and vLEI
   commits,
3. installs KERIpy from the pinned wheel,
4. installs KERIA and vLEI from pinned wheels with `--no-deps`,
5. verifies `keri.__version__ == "1.2.13"`,
   `keria.__version__ == "0.4.0"`, and `vlei.__version__ == "1.0.2"`.

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

| Service          | Port   |
|------------------|--------|
| Wan witness HTTP | `5642` |
| Wil witness HTTP | `5643` |
| Wes witness HTTP | `5644` |
| KERIA admin API  | `3901` |
| KERIA router API | `3902` |
| KERIA boot API   | `3903` |

The start script waits for all ports before returning. Logs are written under
`${RUNNER_TEMP}/keri-stack/logs` in GitHub Actions and uploaded as the
`keria-stack-logs` artifact.

## Caching

CI uses these caches:

- pnpm dependency cache via `actions/setup-node`.
- pip cache via `actions/setup-python`.
- apt package cache for `libsodium-dev` under `.ci/apt`.
- static tool caches under `.cache/eslint`, `.cache/tsc`, `.cache/vite`, and
  `.cache/vitest-unit`.
- live tool caches under `.cache/vite` and `.cache/vitest`.
- pinned KERI repository clones under `.ci/deps`.
- pinned KERI wheels under `.ci/wheels`.
- Puppeteer browser cache under `~/.cache/puppeteer`.

The KERI repository and wheel cache keys include the pinned KERIpy, KERIA, and
vLEI commits, so changing any pinned commit creates a fresh cache. The wheel key
also includes Python version, the KERIA runtime requirements file, and
`scripts/ci/install-keri-stack.sh`.

## Updating Pinned KERI Versions

To update KERIpy, KERIA, or vLEI:

1. update the corresponding branch/ref environment variables in
   `.github/workflows/ci.yml`,
2. update the version assertions in `scripts/ci/install-keri-stack.sh`,
3. update this document,
4. run the smoke tests locally against the same versions if possible.
