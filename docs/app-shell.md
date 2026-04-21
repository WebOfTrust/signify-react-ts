# App shell and views

`MainComponent` is still a transitional app shell, but navigation is no longer
driven by display strings. The app shell view registry lives in `src/views.ts`.

## View API

`ViewId`

: Closed union of valid app shell views:
`identifiers | credentials | client`. Use this instead of arbitrary strings
in navigation state.

`DEFAULT_VIEW`

: Startup and post-connect view. It is currently `identifiers` so a successful
KERIA connection lands on the identifier table, preserving browser smoke
behavior.

`ViewDefinition`

: Metadata for one drawer item and its gating behavior.

- `id`: typed view identifier.
- `label`: drawer label.
- `requiresConnection`: whether the app shell should show the
  connection-required state before rendering the view.
- `testId`: stable browser-smoke selector.

`VIEW_DEFINITIONS`

: Ordered drawer/view registry. This is the source of truth for navigation
labels and selectors.

## Adding a view

1. Add the new id to `ViewId`.
2. Add an entry to `VIEW_DEFINITIONS`.
3. Add a render branch in `MainComponent.renderActiveView`.
4. Preserve selector stability for existing `data-testid` values unless the
   browser smoke test is updated in the same change.
5. If the view needs KERIA state, set `requiresConnection: true` and render a
   blocked state until the Signify hook exposes a connected client or state.

Do not reintroduce display-label comparisons such as
`selectedComponent === "Client"`. That was the original invalid-state problem
this boundary removes.
