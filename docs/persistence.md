# Local Persistence

This document explains the local storage layer for operation history and
app-level notifications. Use it when changing persisted state shape,
controller switching behavior, or reload/interruption semantics.

## Purpose

The persistence layer eagerly stores serializable app work history so a browser
refresh, tab close, crash, or hot-module replacement does not erase the user's
most recent operation and notification context.

Persistence is intentionally conservative. It preserves facts the app owns, but
it does not claim that KERIA operation watchers survive a page reload. A
previously running local watcher is rehydrated as interrupted so the user sees a
clear local-state explanation instead of a false completion state.

## Storage Key

Persisted state is keyed by Signify controller AID:

```text
signify-react-ts:app-state:v1:<controllerAid>
```

The helper is `persistedAppStateKey(controllerAid)` in
`src/state/persistence.ts`.

Controller-AID keying is mandatory because the same browser can authenticate
multiple Signify controllers. Operation and notification history for one
controller must not appear under another controller.

## Persisted Shape

The stored JSON has this top-level shape:

```ts
interface PersistedAppState {
  version: 1;
  operations: OperationRecord[];
  appNotifications: AppNotificationRecord[];
}
```

Only serializable Redux records are persisted. Do not persist raw Signify
clients, Effection tasks, raw KERIA operation responses, `Error` objects,
abort controllers, functions, or DOM objects.

Both operation and app-notification slices have bounded retention limits. The
persisted value mirrors the bounded Redux state.

## Runtime Lifecycle

`AppRuntime` owns persistence installation and controller switching.

- Runtime construction calls `installAppStatePersistence(...)`.
- Store changes are saved only when `currentControllerAid` is known.
- Successful connect calls `setPersistenceController(controllerAid)`.
- Changing controller flushes the previous controller bucket before rehydrating
  the new bucket.
- `disconnect()` flushes before clearing connection state.
- `destroy()` flushes before halting tasks and tearing down scopes.
- `App.tsx` calls `appRuntime.destroy()` on `pagehide` and Vite HMR disposal.

Tests inject a memory implementation through the `AppStateStorage` interface.
Do not make persistence depend directly on browser `localStorage` in code that
unit tests need to exercise.

## Rehydration Semantics

`rehydratePersistedAppState(...)` loads the controller bucket and dispatches:

- `operationsRehydrated(...)`
- `appNotificationsRehydrated(...)`

Completed operation records rehydrate as they were stored.

Running records rehydrate as:

- `status: "interrupted"`
- `phase: "interrupted"`
- `finishedAt: <rehydration timestamp>`
- `canceledReason: "Browser refresh stopped the local operation watcher."`

This is a deliberate limitation. The browser-side Effection task that was
watching KERIA cannot be resumed after reload in this phase. A future resumable
watcher would need to persist enough KERIA operation identity and re-query
KERIA after reconnect before changing this behavior.

## Invalid Data

Invalid JSON, unsupported versions, and malformed records are ignored. The load
path filters individual operation and notification records with runtime guards
instead of trusting local storage.

## Tests

Persistence behavior is covered by `tests/unit/persistence.test.ts`:

- save/load operation history,
- controller-AID bucket isolation,
- running operations rehydrate as interrupted,
- empty buckets clear current state,
- subscribed writes only save under the active controller,
- invalid stored data is ignored.

## Change Checklist

Update this document and tests when changing:

- persistence version,
- storage key prefix,
- persisted top-level shape,
- operation interruption semantics,
- controller switching behavior,
- storage injection contract,
- retention limits for persisted slices.
