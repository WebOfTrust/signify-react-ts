# Identifier UI

This document explains the identifier list and details UI. Use it when changing
identifier display fields, rotation affordances, or Signify `HabState`
presentation helpers.

## Data Model

The app's identifier display model is `IdentifierSummary`, currently an alias
for Signify's `HabState`.

Important display fields:

| UI field    | Source                                                            | Notes                                                                                                    |
|-------------|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| AID         | `identifier.prefix`                                               | Long values are shortened in the table, full value remains copyable.                                     |
| Current Key | `identifier.state.k[0]`                                           | The first current public key. Multiple keys are indicated in details and fully visible in Advanced JSON. |
| KIDX        | `identifier.salty.kidx`                                           | Exposed by salty identifiers. Do not derive it for other identifier types.                               |
| PIDX        | `identifier.salty.pidx`                                           | Exposed by salty identifiers. Do not derive it for other identifier types.                               |
| Tier        | `identifier.salty.tier`                                           | Exposed by salty identifiers.                                                                            |
| Type        | Tagged `HabState` branch: `salty`, `randy`, `group`, or `extern`. | Use shared helper extraction.                                                                            |

Randy, group, and extern identifiers do not currently expose the same local
key-manager metadata as salty identifiers. The UI should show an unavailable
placeholder for missing KIDX, PIDX, and tier values rather than deriving
misleading values from event sequence numbers.

## Helper Ownership

`src/features/identifiers/identifierHelpers.ts` owns identifier display
extraction:

- `identifierType(...)`
- `identifierCurrentKeys(...)`
- `identifierCurrentKey(...)`
- `identifierKeyIndex(...)`
- `identifierIdentifierIndex(...)`
- `identifierTier(...)`
- `formatIdentifierMetadata(...)`
- `identifierJson(...)`
- `truncateMiddle(...)`

Components should not duplicate Signify shape guessing. If a new identifier
branch exposes new display metadata, add it to the helpers and unit tests first,
then render it from components.

## Details Surface

`IdentifierDetailsModal` is the current identifier detail surface. There is no
dedicated `/identifiers/:id` route in this phase.

The modal shows human-readable fields first:

- Name
- AID
- Type
- Current Key
- Key Index
- Identifier Index
- Tier

Full identifier JSON is hidden behind the `Advanced JSON` accordion. The JSON
highlighter is local and React-rendered. It must not use
`dangerouslySetInnerHTML`.

The details modal keeps a rotate action, but route/runtime ownership remains in
`IdentifiersView`. The modal receives `onRotate`; it never calls Signify or the
runtime directly.

## Identifier Table

The desktop table columns are:

- Name
- AID
- Type
- KIDX
- PIDX
- Actions

Mobile cards mirror the same core fields and rotate action.

The AID display contract:

- use `truncateMiddle(aid)` as first eight characters, `...`, last eight
  characters for long values,
- show the full value in a tooltip,
- copy the full value on click,
- stop click propagation so copying does not open details,
- use the shared `--app-mono-font` CSS variable.

Do not add Current Key back to the table unless the list API can supply it
without per-row `get(...)` hydration. Current key belongs in details so the
identifier list does not grow an N+1 request pattern.

The table rotate button:

- uses the rotate icon,
- stops click propagation so rotating does not open details,
- calls the parent `onRotate`,
- is disabled only for the row whose active operation owns
  `identifier:aid:<name>`.

## Rotation And Fresh State

Identifier rotation is a background operation. `IdentifiersView` submits the
route action, the runtime starts the Effection workflow, and the workflow
refreshes identifier Redux state after KERIA completion.

Successful rotation must refresh local AID state so fields such as KIDX update
without requiring a manual route reload. If Signify/KERIA response shapes change
and include a fresh `HabState`, update the service layer and tests before
changing UI behavior.

## Font

`src/index.css` imports Source Code Pro from Google Fonts and defines:

```css
--app-mono-font: 'Source Code Pro', 'Roboto Mono', 'SFMono-Regular',
    Consolas, 'Liberation Mono', monospace;
```

Use this variable for AIDs, current keys, and JSON/code-like identifier data.
Do not introduce one-off monospace stacks in components.

## Tests

Relevant coverage:

- `tests/unit/identifierHelpers.test.ts` covers salty and randy metadata
  extraction, unavailable values, JSON formatting, and middle truncation.
- `tests/browser-smoke.mjs` checks that the table includes AID, KIDX, PIDX, and
  Actions headers after connect.
- Scenario tests protect real Signify/KERIA rotation behavior.

Run `pnpm unit:test`, `pnpm browser:smoke`, and `pnpm scenario:test` when
changing display helpers or rotation behavior.
