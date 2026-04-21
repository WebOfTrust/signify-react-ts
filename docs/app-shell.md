# App Shell And Data Router

The app shell uses React Router's data-router API. `src/App.tsx` creates one
`AppRuntime`, builds a router with `createAppRouter(runtime)`, and renders
`RouterProvider`. The route tree, navigation metadata, loaders, actions, and
error boundaries live under `src/app`.

Feature UI remains under `src/features/*`. Feature components render loader and
action state; they do not construct Signify clients or own route registration.

## Runtime Boundary

Maintainer rule: every exported component, hook, function, class, type,
constant, and significant internal helper in this layer needs an intent comment.
This is not decorative API prose; it records why the router/runtime boundary
exists and which future changes must not bypass it.

`src/app/runtime.ts`

: Data-router-safe Signify session store. It owns the connected client/state
snapshot, exposes subscribe/getSnapshot for React, and provides command methods
used by loaders and actions:

- `connect(config)`
- `disconnect()`
- `refreshState()`
- `listIdentifiers()`
- `createIdentifier(name, algo, fields)`
- `rotateIdentifier(aid)`

`src/app/runtimeContext.tsx`

: React provider for the runtime instance created by `App.tsx`.

`src/app/runtimeHooks.ts`

: React hooks for reading the runtime and subscribing to runtime session state.

Route loaders and actions must use the injected runtime. They must not call
React hooks and must not construct `SignifyClient` directly.

### Runtime State

`SignifyConnectionState`

: Discriminated connection state for the shell: `idle`, `connecting`,
`connected`, or `error`. Connected state carries the raw Signify client, the
normalized state summary, and whether boot happened during connect.

`AppRuntimeSnapshot`

: Immutable snapshot shape consumed by React. It currently contains only
`connection`; add fields here only when multiple shell components and route
functions need the same durable runtime state.

`AppRuntime`

: The non-React session and command boundary. It is deliberately stateful
because browser data-router loaders/actions need a shared client outside React
hooks. Use its command methods from route functions; do not pass raw Signify
clients into feature components.

`createAppRuntime()`

: Factory used by `src/App.tsx` to create the one browser runtime instance.

### Runtime React Bridge

`AppRuntimeProvider`

: Provides the injected runtime to shell and route elements. It does not create
the runtime; `App.tsx` does that so the same instance can be passed to the
router factory.

`AppRuntimeContext`

: Context value split into its own file for React Fast Refresh. Import it only
from provider/hook plumbing, not from feature components.

`useAppRuntime()`

: Hook for rare components that need the runtime command surface directly.
Prefer route actions for mutations.

`useAppSession()`

: Hook for shell components that need live connection state. It uses
`useSyncExternalStore`, so route actions update the app bar and connect dialog
without duplicating session state in React.

## Route API

`src/app/router.tsx` exports the public app-route boundary:

`createAppRouter(runtime)`

: Builds the browser data router.

`createAppRoutes(runtime)`

: Builds route objects for tests and future router composition.

`APP_NAV_ITEMS`

: Drawer items derived from route descriptors and route handles.

`AppRouteHandle`

: Route metadata attached through React Router's native `handle` field. Current
fields are `routeId`, `label`, `gate`, `nav`, and `testId`.

`DEFAULT_APP_PATH`

: Startup, unknown-route, and post-connect target. It is currently
`/identifiers`.

`AppRouteId`

: Closed set of current feature route IDs: `identifiers`, `credentials`, and
`client`.

`AppRouteGate`

: Route gating policy. Current values are `client` for routes that need a
connected client and `state` for routes that need a refreshed state summary.

Do not recreate `ViewDefinition` or another parallel view registry. Paths,
labels, selectors, and route gating policy belong to the route descriptors and
their handles.

## Current Routes

| Path           | Route behavior                 | Loader/action owner        | Gating                            |
| -------------- | ------------------------------ | -------------------------- | --------------------------------- |
| `/`            | redirects to `/identifiers`    | root child index loader    | none                              |
| `/identifiers` | identifier list/detail/create  | identifiers loader/action  | connected Signify client required |
| `/credentials` | connected placeholder          | credentials loader         | connected Signify client required |
| `/client`      | client/controller/agent state  | client loader              | connected Signify state required  |
| `*`            | redirects to `/identifiers`    | catch-all loader           | none                              |

Direct navigation to a gated route renders `ConnectionRequired` until the user
connects. Routes do not auto-open the connect dialog.

## Loaders And Actions

`src/app/routeData.ts` contains the testable loader/action functions:

- `loadIdentifiers(runtime)` returns blocked, ready identifiers, or an
  actionable load error without throwing.
- `loadClient(runtime)` refreshes and returns the current client summary.
- `loadCredentials(runtime)` currently gates the placeholder route.
- `rootAction(runtime, request)` handles connect form submissions and redirects
  successful connections to `DEFAULT_APP_PATH`.
- `identifiersAction(runtime, request)` handles create and rotate intents.

Use typed action data for expected, recoverable failures. Throw only unexpected
route failures that should land in a route error boundary.

### Route Data Types

`BlockedRouteData`

: Shared blocked result for routes that require a connected Signify session.
Route components render `ConnectionRequired` for this state.

`IdentifiersLoaderData`

: `ready` with normalized identifiers, `error` with actionable list-load
diagnostics, or `blocked`. Identifier list errors do not throw because the user
can often fix CORS/network setup without leaving the route.

`ClientLoaderData`

: `ready` with a refreshed `SignifyStateSummary`, or `blocked`.

`CredentialsLoaderData`

: `ready` or `blocked` for the current placeholder route. Future credential
inventory data should extend this union instead of bypassing the loader.

`RootActionData`

: Recoverable root action failures. Successful connect actions return a router
redirect and are therefore not represented by this type.

`IdentifierActionData`

: Create/rotate mutation result. This is intentionally intent-based because
both actions mutate and revalidate the same identifiers route.

`RouteDataRuntime`

: Narrow runtime interface used by loaders/actions and unit tests. Keep it
smaller than `AppRuntime` so route-data code only depends on behavior it truly
needs.

### Loader/Action Rules

- Loaders return `blocked` for missing connection state; they do not redirect
  gated routes and do not open dialogs.
- Recoverable operational failures return typed route data or action data with
  messages that can be shown in-place.
- Throw only unexpected programming or infrastructure failures that should be
  handled by `RouteErrorBoundary`.
- Mutations that affect a route's loader data should live in that route's
  action so React Router revalidation stays predictable.
- Future credential actions should use explicit intents such as `issue`,
  `grant`, `admit`, and `present`, not a generic command string.

## Error Boundaries

`RouteErrorBoundary` is attached at the root and feature routes. Root errors are
for app-shell failures; feature errors are for route-specific loader/action
failures that were not recoverable enough to return as typed route data.

When adding a new feature route, add an error boundary at the nearest route
where the user can understand and recover from the failure.

`RouteErrorBoundary`

: Shared route error presentation. It normalizes React Router response errors
and unknown thrown values into a short route-specific error message.

`RootLayout`

: Root route element. It owns only shell state that should survive route
changes: drawer open state and connect-dialog open state. The visible
connection status comes from `AppRuntime` through `useAppSession`.

`NavigationDrawer`

: Drawer generated from `APP_NAV_ITEMS`. Adding a drawer item means adding a
route descriptor and handle, not editing a second navigation registry.

`ConnectDialog`

: KERIA target/passcode form. It submits to the root route action with
`useFetcher`; it does not call Signify connect helpers directly.

`ConnectionRequired`

: Passive blocked-state component for direct navigation to gated routes.

`TopBar`

: Shell-only app bar with the stable `nav-open` and `connect-open` smoke-test
selectors.

## Adding A Route

1. Add a route descriptor in `src/app/router.tsx` with a stable route ID,
   relative path, `handle`, and `data-testid` when it appears in navigation.
2. Add a loader in `src/app/routeData.ts` when the route reads app, config, or
   Signify state.
3. Add an action when the route performs a mutation or long-running KERIA
   command.
4. Render a feature component under `src/features/<feature>`.
5. Add unit coverage for route metadata and loader/action behavior with a fake
   runtime.
6. Preserve existing browser-smoke selectors unless the smoke test changes in
   the same commit.

For credential work, prefer nested explicit routes such as
`/credentials/issue`, `/credentials/:said`, and `/credentials/present` over a
generic command router. The route tree should make issuer, holder, and verifier
responsibilities easy to inspect.

## Feature Component Responsibilities

`IdentifiersView`

: Reads `IdentifiersLoaderData`, submits create/rotate actions through
`useFetcher`, and owns only local UI state such as the selected identifier,
dialog visibility, and transient pending messages.

`IdentifierTable`, `IdentifierDetailsModal`, `IdentifierCreateDialog`

: Presentational identifier components. They receive data/callbacks and should
not import router or Signify clients unless the feature ownership changes.

`ClientView`

: Reads `ClientLoaderData` and renders the normalized client summary. Refreshing
state belongs to the client route loader.

`CredentialsView`

: Connected placeholder route. Replace it with nested credential UI as issuer,
holder, and verifier flows are added, but keep route gating in loaders.
