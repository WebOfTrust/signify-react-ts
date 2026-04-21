# Smoke Tests

The smoke tests are fast confidence checks for the Signify client boundary and
the React connection path. They are not full issuer/holder/verifier tests and
they intentionally do not depend on a schema server.

Use them before and after changes that touch:

- Signify readiness or passcode generation.
- KERIA boot/connect behavior.
- KERIA operation waiting.
- local KERIA/witness configuration.
- the React connect dialog or client summary view.

## Quick Run

With KERIA running locally:

```bash
pnpm keria:smoke -- --mode connect
```

With KERIA and the demo witnesses running locally:

```bash
pnpm keria:smoke
pnpm browser:smoke
```

Run `pnpm keria:smoke -- --mode connect` first when debugging. It proves the
admin and boot APIs work without involving witnesses or browser automation.

CI runs all smoke checks through:

```bash
pnpm test:ci
```

See [CI](./ci.md) for the GitHub Actions service setup and pinned KERIpy/KERIA
versions.

Scenario-level KERIA flows run through plain Vitest test files:

```bash
pnpm scenario:test
```

See [Scenario tests](./scenario-runners.md) for the test files and fixture
requirements.

## Infrastructure

The smoke-test stack has one shared smoke module and two executable wrappers.

| Layer           | File                                 | Responsibility                                                                                                      |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Shared smoke    | `tests/smoke/clientBoundarySmoke.ts` | Boots/connects through the Signify boundary, reads client state, and optionally creates a witnessed identifier.     |
| CLI wrapper     | `scripts/keria-smoke.ts`             | Parses process args, calls the shared smoke module, and prints JSON.                                                |
| Browser wrapper | `tests/browser-smoke.mjs`            | Starts or reuses Vite, drives the React UI with Puppeteer, and verifies the client summary.                         |
| Boundary        | `src/signify/client.ts`              | Owns `ready()`, `randomPasscode()`, `SignifyClient` construction, boot/connect, state reads, and operation waiting. |
| Config          | `src/config.ts`                      | Supplies shared defaults and environment overrides for browser and Node execution.                                  |

The important design constraint is that KERIA boundary behavior lives in shared
smoke code and the Signify boundary, not in the CLI or Puppeteer script.
Browser smoke should only prove that the UI can exercise the same boundary
successfully.

## CLI Smoke

### Connect Mode

```bash
pnpm keria:smoke -- --mode connect
```

This mode:

1. waits for Signify readiness,
2. generates a fresh passcode unless one is supplied,
3. creates a Signify client,
4. boots only if KERIA reports that the agent does not exist,
5. connects,
6. reads agent/controller state,
7. lists identifiers,
8. prints a compact JSON summary.

It requires:

- KERIA admin API at `VITE_KERIA_ADMIN_URL`, default
  `http://127.0.0.1:3901`.
- KERIA boot API at `VITE_KERIA_BOOT_URL`, default
  `http://127.0.0.1:3903`.

It does not require witnesses.

### Witness Mode

```bash
pnpm keria:smoke
```

This is the default mode. It does everything connect mode does, then:

1. creates a unique witnessed identifier,
2. waits for the resulting KERIA operation through `waitForOperation`,
3. fetches the created identifier,
4. prints the alias, prefix, and operation name.

It requires the local demo witnesses named in `VITE_WITNESS_AIDS`.

### Reproducing a Run

Use fixed inputs when you need to reproduce local KERIA state:

```bash
pnpm keria:smoke -- --mode connect --passcode 0123456789abcdefghijk
pnpm keria:smoke -- --alias smoke-debug-1 --passcode 0123456789abcdefghijk
```

`--passcode` fixes the controller material. `--alias` fixes the identifier name
used by witness mode.

### Output

Successful CLI smoke output is JSON:

```json
{
    "mode": "witness",
    "adminUrl": "http://127.0.0.1:3901",
    "bootUrl": "http://127.0.0.1:3903",
    "passcode": "DexampleGeneratedPass",
    "booted": true,
    "controllerAID": "E...",
    "agentAID": "E...",
    "identifierCount": 0,
    "identifierAlias": "smoke-20260421182533",
    "identifierPrefix": "E...",
    "operationName": "witness.E..."
}
```

Fields only present in witness mode:

- `identifierAlias`
- `identifierPrefix`
- `operationName`

Failure output is a single error message and a non-zero exit code.

## Browser Smoke

```bash
pnpm browser:smoke
```

The browser smoke:

1. checks whether `http://127.0.0.1:5173` is already serving the app,
2. starts Vite with `pnpm exec vite --host 127.0.0.1` if needed,
3. opens the app with Puppeteer,
4. opens the connect dialog,
5. generates a Signify passcode through the UI,
6. connects to local KERIA,
7. waits for `connection-status-connected`,
8. lands on the routed `/identifiers` view,
9. navigates through the drawer to the routed `/client` view,
10. verifies the controller and agent AIDs render.

The browser test uses stable `data-testid` selectors. If a UI refactor changes
the connect dialog or client summary, update the selectors and the test
together. Do not replace them with generated MUI class selectors.

The app uses React Router, but browser smoke intentionally drives the same UI
controls a user would use instead of asserting implementation-specific router
state.

Set `BROWSER_SMOKE_URL` to point at an already-running app:

```bash
BROWSER_SMOKE_URL=http://127.0.0.1:5174 pnpm browser:smoke
```

If `BROWSER_SMOKE_URL` is not set, the test assumes
`http://127.0.0.1:5173`.

## Configuration

The smoke tests use the same config as the app:

| Variable                      | Default                   | Used by                        |
| ----------------------------- | ------------------------- | ------------------------------ |
| `VITE_KERIA_ADMIN_URL`        | `http://127.0.0.1:3901`   | CLI and browser smoke.         |
| `VITE_KERIA_BOOT_URL`         | `http://127.0.0.1:3903`   | CLI and browser smoke.         |
| `VITE_OPERATION_TIMEOUT_MS`   | `30000`                   | CLI witness operation wait.    |
| `VITE_OPERATION_MIN_SLEEP_MS` | `1000`                    | CLI witness operation polling. |
| `VITE_OPERATION_MAX_SLEEP_MS` | `5000`                    | CLI witness operation polling. |
| `VITE_WITNESS_AIDS`           | local 3-witness demo AIDs | CLI witness mode.              |
| `VITE_WITNESS_TOAD`           | `2`                       | CLI witness mode.              |
| `BROWSER_SMOKE_URL`           | `http://127.0.0.1:5173`   | Browser smoke only.            |

Browser smoke calls local KERIA directly and requires KERIA CORS support to be
enabled, for example `KERI_AGENT_CORS=true`. Without that, browser preflight for
signed Signify resource calls such as `GET /identifiers` can fail even when
KERIA itself is running.

Node smoke scripts read ordinary environment variables. The browser app reads
Vite-exposed variables. Use the `VITE_` prefix for values that must be available
inside React.

## Failure Triage

`agent does not exist`: expected for fresh passcodes. The boundary should boot
and retry connect automatically.

`KERIA boot failed`: the boot API is not reachable or rejected the boot request.
Check `VITE_KERIA_BOOT_URL` and the KERIA boot process.

`HTTP ... /operations/...`: the client connected, but a KERIA operation failed
or could not be fetched. In witness mode, check witness services and witness
AIDs.

`Operation timed out`: KERIA accepted the operation but it did not complete
within `VITE_OPERATION_TIMEOUT_MS`. For witnessed identifiers, check that the
witnesses are reachable and match `VITE_WITNESS_AIDS`.

`No element found for selector`: browser smoke is out of sync with the UI. Keep
the `data-testid` contract stable or update the test with the UI change.

## Extending Smoke Coverage

Add smoke coverage only for narrow, high-signal checks. Full KERIA flows belong
in scenario tests, not in browser smoke.

Rules for new smoke tests:

1. Put reusable smoke behavior in `tests/smoke`.
2. Keep executable scripts thin.
3. Use `connectSignifyClient` and `waitForOperation`.
4. Use fresh passcodes by default.
5. Add fixed `--passcode` or `--alias` style flags only when they help
   reproduce local state.
6. Use stable `data-testid` selectors for browser checks.
7. Document the prerequisites and expected output here.
