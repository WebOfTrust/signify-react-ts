# Runtime config

`src/config.ts` is the app/demo runtime configuration boundary. Browser code,
Node smoke scripts, and shared KERIA scenario helpers may import it. Optional
external test fixtures must not be added there; those live in
`tests/support/config.ts`.

The split is intentional:

- `src/config.ts`: values the application or demo runtime can legitimately
  consume.
- `tests/support/config.ts`: optional harness fixtures used only by Vitest
  scenarios, such as external delegator or multisig OOBIs.

Vite exposes every `VITE_*` value to browser code. Treat all values in
`.env.example` as public demo configuration, not production secrets.

## App config API

`RuntimeEnv`

: Plain `Record<string, string | undefined>` accepted by `buildAppConfig`. Tests
pass explicit maps; the exported singleton uses the merged Vite/Node
environment.

`buildAppConfig(env)`

: Pure parser for app runtime config. It trims optional strings, converts blank
values to `null`, parses CSV lists by trimming and dropping empty items, and
throws on malformed numeric values. Unit tests should call this instead of
mutating process env.

`appConfig`

: Process-wide singleton created from `import.meta.env` plus `process.env`.
Browser code and smoke scripts use this value directly.

`ConnectionOption`

: One selectable KERIA target in the connect dialog. `adminUrl` and `bootUrl`
are paired so the app does not boot against one deployment and connect to
another.

`KeriaConfig`

: KERIA endpoints. `adminUrl` is used for authenticated Signify calls,
`bootUrl` is used for agent bootstrapping, and `routerUrl` is reserved for
direct/router flows.

`OperationConfig`

: Shared operation wait policy: timeout, minimum sleep, and maximum sleep.
`waitOperation` consumes this policy so app and scenario waits have one
timeout model.

`WitnessConfig`

: Demo witness AIDs and `toad` threshold used when creating witnessed
identifiers in smoke/scenario code.

`DemoRoleConfig` and `RoleConfig`

: Default aliases and optional passcodes for issuer, holder, and verifier demo
roles. Passcodes configured through `VITE_*` are browser-visible and suitable
only for local scripted demos.

`SchemaConfig` and `SchemaConfigs`

: SEDI voter schema SAID and OOBI URL. `VITE_SEDI_VOTER_ID_SCHEMA_*` is the
canonical name. Legacy `VITE_CREDENTIAL_SCHEMA_*` aliases remain accepted to
avoid breaking older optional scenario invocations.

`VerifierConfig`

: Sally-style verifier direct URL, dashboard URL, optional verifier OOBI URL,
and optional trusted issuer AID.

## Environment variables

Use `.env.example` as the app/runtime reference.

Local defaults are constants inside `src/config.ts`. They are intentionally
local-demo values, not deployment recommendations:

- `VITE_KERIA_ADMIN_URL=http://127.0.0.1:3901`
- `VITE_KERIA_ROUTER_URL=http://127.0.0.1:3902`
- `VITE_KERIA_BOOT_URL=http://127.0.0.1:3903`
- `VITE_VERIFIER_DIRECT_URL=http://127.0.0.1:9723`
- `VITE_VERIFIER_DASHBOARD_URL=http://127.0.0.1:9923`
- `VITE_WITNESS_AIDS=<local 3-witness demo AIDs>`
- `VITE_WITNESS_TOAD=2`

`defaultTier` is currently `Tier.low`. Change that only when the Signify demo
explicitly needs a different key derivation tier, and update config tests in the
same change.

Optional cloud KERIA values must be set as a pair:

- `VITE_CLOUD_KERIA_ADMIN_URL`
- `VITE_CLOUD_KERIA_BOOT_URL`

If only one is present, `buildAppConfig` throws. This is deliberate because a
half-configured connection option is worse than no option.

Numeric variables fail fast when malformed:

- `VITE_OPERATION_TIMEOUT_MS`
- `VITE_OPERATION_MIN_SLEEP_MS`
- `VITE_OPERATION_MAX_SLEEP_MS`
- `VITE_WITNESS_TOAD`

## Test fixture config

`tests/support/config.ts` owns optional external fixture config. It exports:

- `TestRuntimeEnv`
- `DelegationFixtureConfig`
- `MultisigFixtureConfig`
- `TestConfig`
- `buildTestConfig(env)`
- `testConfig`

Use `tests/.env.example` as the test fixture reference. Current test-only
variables:

- `VITE_DELEGATOR_PRE`
- `VITE_DELEGATOR_OOBI`
- `VITE_MULTISIG_MEMBER_OOBIS`

Do not import `tests/support/config.ts` from `src`. If app code needs a value,
promote the value deliberately into `src/config.ts` and document why it is
runtime state rather than fixture state.

## Adding config

1. Decide ownership first: app/demo runtime goes in `src/config.ts`; optional
   external test fixture state goes in `tests/support/config.ts`.
2. Add or update exported interfaces with field comments.
3. Add parsing in `buildAppConfig` or `buildTestConfig`.
4. Document the env variable in `.env.example` or `tests/.env.example`.
5. Add unit coverage in `tests/unit/config.test.ts` or
   `tests/unit/testConfig.test.ts`.
6. Run `pnpm lint`, `pnpm build`, and `pnpm unit:test`.
