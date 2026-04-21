import { useCallback, useState } from 'react';
import type { SignifyClient } from 'signify-ts';
import {
  connectSignifyClient,
  getSignifyState,
  toError,
  type ConnectedSignifyClient,
  type SignifyClientConfig,
  type SignifyStateSummary,
} from './client';

export type SignifyConnectionState =
  | { status: 'idle'; client: null; state: null; error: null; booted: false }
  | {
      status: 'connecting';
      client: null;
      state: null;
      error: null;
      booted: false;
    }
  | {
      status: 'connected';
      client: SignifyClient;
      state: SignifyStateSummary;
      error: null;
      booted: boolean;
    }
  | {
      status: 'error';
      client: null;
      state: null;
      error: Error;
      booted: false;
    };

const idleState: SignifyConnectionState = {
  status: 'idle',
  client: null,
  state: null,
  error: null,
  booted: false,
};

/**
 * React state adapter for the Signify client boundary.
 *
 * The hook deliberately exposes a discriminated connection state instead of a
 * maybe-connected client. Views that require KERIA should render a blocked
 * state until `status === "connected"`.
 */
export const useSignifyClient = () => {
  const [connection, setConnection] =
    useState<SignifyConnectionState>(idleState);

  const connect = useCallback(async (config: SignifyClientConfig) => {
    setConnection({
      status: 'connecting',
      client: null,
      state: null,
      error: null,
      booted: false,
    });

    try {
      const connected: ConnectedSignifyClient =
        await connectSignifyClient(config);
      setConnection({
        status: 'connected',
        client: connected.client,
        state: connected.state,
        error: null,
        booted: connected.booted,
      });
      return connected;
    } catch (error) {
      const normalized = toError(error);
      setConnection({
        status: 'error',
        client: null,
        state: null,
        error: normalized,
        booted: false,
      });
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnection(idleState);
  }, []);

  const refreshState = useCallback(async () => {
    if (connection.status !== 'connected') {
      return null;
    }

    const state = await getSignifyState(connection.client);
    setConnection({
      ...connection,
      state,
    });
    return state;
  }, [connection]);

  return {
    connection,
    client: connection.status === 'connected' ? connection.client : null,
    state: connection.status === 'connected' ? connection.state : null,
    connect,
    disconnect,
    refreshState,
  };
};
