# Signify Client Boundary

This app talks to KERIA through one boundary: `src/signify/client.ts`.
React components, browser smoke tests, and scenario runners should not construct
`SignifyClient` directly or call `ready()` directly.

The rule is deliberate. Signify has process-level WASM readiness, KERIA has a
boot/connect lifecycle, and KERIA operations are long-running resources. Keeping
that lifecycle in one module makes failures inspectable and keeps UI components
focused on rendering state.

## Ownership

- `src/config.ts` owns environment parsing and local defaults.
- `src/signify/client.ts` owns Signify readiness, passcode generation, client
  construction, boot/connect, state normalization, and operation waiting.
- `src/app/runtime.ts` owns app-session connection state for data-router
  loaders/actions and React shell rendering.
- `src/signify/useSignifyClient.ts` is a compatibility hook backed by a local
  `AppRuntime` instance; new routed app code should use the app runtime instead.
- `tests/smoke/clientBoundarySmoke.ts` owns the reusable local KERIA smoke
  scenario.
- `scripts/keria-smoke.ts` and `tests/browser-smoke.mjs` are thin executable
  wrappers around the app behavior.

Do not move KERIA lifecycle calls back into component event handlers. New
scenario code should take a connected client or call the boundary.

## Configuration

The app reads typed runtime config from `src/config.ts`. That module accepts
Vite-style environment variables in the browser and ordinary `process.env`
variables in Node smoke scripts. Defaults target the local KERIA and witness
demo setup. Local browser use requires KERIA to be started with CORS enabled,
for example `KERI_AGENT_CORS=true`, because Signify browser calls send signed
custom headers.

Use [Runtime config](./runtime-config.md) for the complete list of supported
variables, exported config types, parsing behavior, and the split between app
runtime config and test-only fixture config.

## Public Boundary API

`createSignifyClient(config)` initializes Signify WASM readiness and constructs
the raw client. Use this only when the caller intentionally wants to control
boot/connect itself.

`connectSignifyClient(config, options)` is the normal entry point. It creates a
client, attempts `connect()`, and boots only when KERIA reports that the agent
does not exist. Other connection failures are surfaced as errors.

`getSignifyState(client)` reads KERIA state and returns stable summary fields:
controller AID, agent AID, rotation index, passcode index, and the raw Signify
state object.

`waitOperation(client, op, options)` wraps `client.operations().wait(...)`
with app defaults, timeout support, and labels that identify the phase that
failed.

`randomSignifyPasscode()` is the only supported way for app code to generate a
Signify passcode. It waits for Signify readiness before calling
`randomPasscode()`.

## React State Model

The app runtime and `useSignifyClient()` expose a discriminated union:

- `idle`: no client exists.
- `connecting`: a connect attempt is in flight.
- `connected`: a connected client and summarized state are available.
- `error`: the latest connection attempt failed and no client is exposed.

Route loaders/actions should read and mutate Signify state through the injected
`AppRuntime`. Components should branch on `connection.status` or route loader
data. Do not use non-null assertions for connected-only views; render a blocked
or disconnected state instead.

## Smoke Tests

The smoke tests are documented separately in
[Smoke tests](./smoke-tests.md). Use that document for commands, prerequisites,
output shape, environment variables, browser selector contracts, and failure
triage.

## Adding New Flows

Use this sequence for new Signify/KERIA flows:

1. Add direct Vitest scenario tests under `tests/scenarios`.
2. Put repeated KERIA mechanics in `tests/support/keria.ts`.
3. Use `waitOperation`, `role.waitEvent`, or `role.waitOperation` for every KERIA
   operation.
4. Add a CLI or browser wrapper only after the flow can run without React.
5. Keep UI components as thin render/dispatch wrappers.

Avoid reintroducing direct constructors, ad hoc polling loops, or hardcoded
local URLs inside components.
