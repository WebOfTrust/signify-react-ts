import { useMemo, useSyncExternalStore } from 'react';
import { AppRuntime, type SignifyConnectionState } from '../app/runtime';

export type { SignifyConnectionState };

/**
 * React state adapter for the Signify client boundary.
 *
 * The hook deliberately exposes a discriminated connection state instead of a
 * maybe-connected client. Views that require KERIA should render a blocked
 * state until `status === "connected"`.
 */
export const useSignifyClient = () => {
  const runtime = useMemo(() => new AppRuntime(), []);
  const { connection } = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot
  );

  return {
    connection,
    client: runtime.getClient(),
    state: runtime.getState(),
    connect: runtime.connect,
    disconnect: runtime.disconnect,
    refreshState: runtime.refreshState,
  };
};
