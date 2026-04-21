# Scenario Runners

Scenario runners are pure async KERIA flows that run from Vitest and smoke
scripts. They replace the legacy `src/test_components/*` button handlers
without adding test orchestration to the app source tree.

## How To Run

From the repository root:

Run the CI-gated scenarios against local KERIA and witnesses:

```bash
pnpm scenario:test
```

Run the full catalog, including scenarios that may skip without optional
fixtures:

```bash
pnpm scenario:test:all
```

`pnpm test:ci` runs `pnpm scenario:test` after the KERIA smoke tests and before
the browser smoke test.

Prerequisites are the same local KERIA stack used by the smoke tests: KERIA
admin/boot on `3901`/`3903` and the demo witnesses on `5642`-`5644`.

## How To Navigate The Code

The old `TestsComponent.tsx` mental model was simple because it listed each
flow as a component. The replacement keeps that readability, but moves it out
of app source:

1. Start at `tests/scenarios/catalog.ts`.
   This is the scenario list. It is the closest equivalent to the old
   `TestsComponent` import/render list.
2. Open `tests/scenarios/coreScenarios.ts`.
   These are the scenarios that run in CI by default.
3. Open `tests/scenarios/optionalScenarios.ts`.
   These are schema or external-fixture scenarios. They are included in
   `pnpm scenario:test:all` and skip when their config is missing.
4. Open `tests/scenarios/helpers.ts`.
   This contains the shared KERIA mechanics: fresh clients, unique aliases,
   witnessed identifiers, OOBI resolution, and operation waiting.
5. Open `tests/scenarios.test.ts`.
   This is the Vitest harness that executes the catalog sequentially.

There is no app route for these scenarios. That is intentional: the wallet app
should stay focused on runtime UI, while scenario orchestration stays in test
sources.

## Architecture

The scenario catalog lives under `tests/scenarios`.

| Layer | Responsibility |
| --- | --- |
| `types.ts` | Shared scenario result, step, status, context, and requirement types. |
| `helpers.ts` | Fresh client creation, unique aliases, operation waits, witnessed AID helpers, OOBI exchange, and scenario execution. |
| `coreScenarios.ts` | CI-safe scenarios that require only KERIA and local witnesses. |
| `optionalScenarios.ts` | Schema or fixture-dependent scenarios that skip unless configured. |
| `catalog.ts` | Public catalog consumed by Vitest and smoke scripts. |

Vitest uses the catalog through `tests/scenarios.test.ts`. The React app does
not import the scenario catalog.

## CI Scenarios

Default CI currently runs:

- `salty-identifiers`
- `randy-identifiers`
- `witnessed-identifier`
- `challenge-response`

`controller-rotation` is intentionally present but skipped. The implementation
is kept in `runControllerRotationScenario`, but the catalog entry does not call
it because upstream `SignifyClient.rotate` currently returns server errors for
this flow. Re-enable the catalog entry after upstream `SignifyController.rotate`
is fixed.

## Optional Scenarios

Optional scenarios are included in `pnpm scenario:test:all` but skip unless
their config is present.

| Scenario | Required config |
| --- | --- |
| `credential-issue-grant-revoke` | `VITE_CREDENTIAL_SCHEMA_SAID`, `VITE_CREDENTIAL_SCHEMA_OOBI_URL` |
| `delegation-fixture` | `VITE_DELEGATOR_PRE`, `VITE_DELEGATOR_OOBI` |
| `multisig-fixture` | `VITE_MULTISIG_MEMBER_OOBIS` |

The credential scenario is not CI-gated yet because CI does not start the schema
OOBI service. Delegation and multisig are not CI-gated because they depend on
external fixture AIDs/OOBIs.

## Rules For New Scenarios

1. Put KERIA behavior in a pure runner under `tests/scenarios`.
2. Use `createScenarioClient` so every run gets fresh controller material.
3. Use `uniqueAlias` for every managed identifier and registry alias.
4. Use `waitForOperation` through scenario helpers; do not add manual operation
   polling loops.
5. Return structured details that help diagnose failures.
6. Tag requirements accurately and set `ci: true` only when CI starts every
   required service.
7. Keep browser tests focused on UI wiring. Scenario correctness belongs in
   Vitest.
