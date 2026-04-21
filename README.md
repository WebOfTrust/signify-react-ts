# Signify React sample app

## Maintainer docs

- [Signify client boundary](./docs/signify-client-boundary.md): ownership,
  configuration, and public boundary API.
- [Runtime config](./docs/runtime-config.md): app/runtime config ownership,
  supported `VITE_*` variables, test fixture config, and how to add new config
  safely.
- [Smoke tests](./docs/smoke-tests.md): how the CLI and browser smoke checks
  work, how to run them, required local services, configuration, outputs, and
  failure triage.
- [Scenario tests](./docs/scenario-runners.md): direct Vitest KERIA flows and
  optional fixture requirements.
- [CI](./docs/ci.md): GitHub Actions setup for installing pinned KERIpy/KERIA,
  starting local services, caching dependencies, and running smoke tests.

### Run locally

The code is built using React, Vite, Typescript and running code locally requires a Mac or Linux OS.

- Install [Node.js](https://nodejs.org)

- To install dependencies of Signify, in the `project root directory` run:
  for NPM:

    ```bash
    npm install
    ```

    for [PNPM](https://pnpm.io/):

    ```bash
    pnpm install
    ```

- Navigate to `examples/signify-react-ts` directory

    ```bash
    cd examples/signify-react-ts
    ```

- Install dependencies:

    ```bash
    npm install
    ```

- Run the development server with Vite live reload / React Fast Refresh:

    ```bash
    pnpm run dev
    ```

- Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) in browser. Source
  edits under `src/` should update the page automatically without a manual
  refresh.

### Smoke tests

Fast KERIA-only check:

```bash
pnpm keria:smoke -- --mode connect
```

Full boundary check with witnessed identifier creation:

```bash
pnpm keria:smoke
```

Browser wiring check for the React connect flow:

```bash
pnpm browser:smoke
```

See [Smoke tests](./docs/smoke-tests.md) for prerequisites, environment
variables, output shape, and failure triage.

### Scenario tests

KERIA scenario runners:

```bash
pnpm scenario:test
```

All scenario test files, including optional flows that may show as skipped:

```bash
pnpm scenario:test:all
```

See [Scenario tests](./docs/scenario-runners.md) for maintainer navigation
through `tests/scenarios/*.test.ts`, optional fixture requirements, and the
shared `tests/support/keria.ts` helper layer.

### CI test suite

The GitHub Actions workflow runs the same checks through:

```bash
pnpm test:ci
```

See [CI](./docs/ci.md) for the pinned KERIpy/KERIA versions and service setup.
