# Scenario Tests

Scenario tests are plain Vitest integration tests for KERIA flows. They replace
the legacy `src/test_components/*` button handlers without adding orchestration
back into the app source tree.

Vitest is the catalog, runner, skipper, timeout owner, and reporter. There is
no custom scenario registry.

## How To Run

From the repository root:

Run CI-core scenarios against local KERIA and witnesses:

```bash
pnpm scenario:test
```

Run every scenario test file, including optional fixture flows that may show as
Vitest-native skips:

```bash
pnpm scenario:test:all
```

`pnpm test:ci` runs `pnpm scenario:test` after the KERIA smoke tests and before
the browser smoke test.

Prerequisites are the same local KERIA stack used by the smoke tests: KERIA
admin/boot on `3901`/`3903` and the demo witnesses on `5642`-`5644`.

## How To Navigate The Code

Open the failing test file first. Each file is a human-readable workflow:

| File | Purpose |
| --- | --- |
| `tests/scenarios/salty.test.ts` | Salty AID creation, rotation, interaction, and event-log checks. |
| `tests/scenarios/randy.test.ts` | Randy AID creation, interaction, rotation, and key-material checks. |
| `tests/scenarios/witnessed.test.ts` | Witnessed AID creation using the configured demo witnesses. |
| `tests/scenarios/challenge.test.ts` | Two-role OOBI exchange and challenge response. |
| `tests/scenarios/controller-rotation.test.ts` | Skipped controller rotation flow kept for the upstream rotate fix. |
| `tests/scenarios/optional/*.test.ts` | Schema or external-fixture scenarios that skip unless configured. |

Shared KERIA mechanics live in `tests/support/keria.ts`. That file should stay
small and boring: fresh roles, unique aliases, operation waits, witnessed AID
helpers, OOBI exchange, challenge polling, and optional environment parsing.

Smoke code lives under `tests/smoke`, not `tests/scenarios`. Smoke tests verify
the Signify boundary and browser wiring; scenario tests verify KERIA flows.

There is no app route for these scenarios. The wallet app should stay focused
on runtime UI, while scenario orchestration stays in test sources.

## Core Scenarios

Default CI currently runs the top-level scenario test files:

- `salty.test.ts`
- `randy.test.ts`
- `witnessed.test.ts`
- `challenge.test.ts`
- `controller-rotation.test.ts`, with its only test skipped

Controller rotation is intentionally present but skipped. The test body is kept
beside the skip so re-enabling is a one-line change after upstream
`SignifyClient.rotate` / `SignifyController.rotate` is fixed.

## Optional Scenarios

Optional scenarios live under `tests/scenarios/optional` and are included only
by `pnpm scenario:test:all`.

| Scenario | Required config |
| --- | --- |
| `credentials.test.ts` | `VITE_CREDENTIAL_SCHEMA_SAID`, `VITE_CREDENTIAL_SCHEMA_OOBI_URL` |
| `delegation.test.ts` | `VITE_DELEGATOR_PRE`, `VITE_DELEGATOR_OOBI` |
| `multisig.test.ts` | `VITE_MULTISIG_MEMBER_OOBIS` |

These tests use `it.skipIf(...)`, so missing fixtures appear as Vitest skipped
tests instead of custom pass/fail result objects.

## Rules For New Scenarios

1. Add a direct Vitest test file under `tests/scenarios`.
2. Use `createRole` so every run gets fresh controller material.
3. Use `uniqueAlias` for every managed identifier and registry alias.
4. Use `role.waitEvent`, `role.waitOperation`, or `waitForOperation`; do not add
   manual operation polling loops.
5. Use `expect(...)` assertions inside the test, not a custom result wrapper.
6. Put optional fixture scenarios under `tests/scenarios/optional` and guard
   them with `it.skipIf(...)`.
7. Keep browser tests focused on UI wiring. Scenario correctness belongs in
   Vitest.
