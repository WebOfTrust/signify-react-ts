# App shell and views

The app shell is routed with React Router. `src/app/AppShell.tsx` owns the
Signify connection hook, connect dialog state, drawer state, and route layout.
Feature views live under `src/features/*`.

The view registry lives in `src/views.ts`. It is the typed bridge between drawer
navigation and route paths.

## View API

`ViewId`

: Closed union of valid app shell views: `identifiers | credentials | client`.
Use this instead of arbitrary strings in navigation metadata.

`DEFAULT_VIEW`

: Startup, root redirect, and post-connect view. It is currently `identifiers`,
so `/` and a successful KERIA connection land on `/identifiers`.

`ViewDefinition`

: Metadata for one drawer item and its gating behavior.

- `id`: typed view identifier.
- `label`: drawer label.
- `path`: canonical React Router path.
- `requiresConnection`: whether the app shell should show the
  connection-required state before rendering the view.
- `testId`: stable browser-smoke selector.

`VIEW_DEFINITIONS`

: Ordered drawer/view registry. This is the source of truth for drawer labels,
route paths, and selectors.

## Routes

Current routes:

| Path           | View                          | Gating                            |
| -------------- | ----------------------------- | --------------------------------- |
| `/`            | redirects to `/identifiers`   | none                              |
| `/identifiers` | `IdentifiersView`             | connected Signify client required |
| `/credentials` | `CredentialsView` placeholder | connected Signify client required |
| `/client`      | `ClientView`                  | connected Signify state required  |
| `*`            | redirects to `/identifiers`   | none                              |

Direct navigation to a gated route renders `ConnectionRequired` until the user
connects. Routes do not auto-open the connect dialog and do not boot clients by
themselves.

## File layout

- `src/app/AppShell.tsx`: route layout and shell state.
- `src/app/TopBar.tsx`: app bar and connection indicator.
- `src/app/NavigationDrawer.tsx`: route navigation generated from
  `VIEW_DEFINITIONS`.
- `src/app/ConnectDialog.tsx`: KERIA target selection and passcode submission.
- `src/app/ConnectionRequired.tsx`: blocked-state view for gated routes.
- `src/features/identifiers/*`: identifier list/detail/create behavior.
- `src/features/client/*`: client/controller/agent summary.
- `src/features/credentials/CredentialsView.tsx`: placeholder credential route.

## Adding a view

1. Add the new id to `ViewId`.
2. Add an entry to `VIEW_DEFINITIONS`.
3. Add a `<Route>` branch in `AppShell`.
4. Preserve selector stability for existing `data-testid` values unless the
   browser smoke test is updated in the same change.
5. If the view needs KERIA state, set `requiresConnection: true` and render a
   blocked state until the Signify hook exposes a connected client or state.

Do not reintroduce display-label comparisons such as
`selectedComponent === "Client"`. That was the original invalid-state problem
this boundary removes.
