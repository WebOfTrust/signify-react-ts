import { useContext, useSyncExternalStore } from 'react';
import { AppRuntimeContext } from './runtimeContextValue';
import type { AppRuntime, AppRuntimeSnapshot } from './runtime';

/**
 * Read the data-router app runtime from React context.
 */
export const useAppRuntime = (): AppRuntime => {
    const runtime = useContext(AppRuntimeContext);
    if (runtime === null) {
        throw new Error('useAppRuntime must be used within AppRuntimeProvider.');
    }

    return runtime;
};

/**
 * Subscribe React components to the runtime snapshot used by route actions.
 */
export const useAppSession = (): AppRuntimeSnapshot => {
    const runtime = useAppRuntime();
    return useSyncExternalStore(
        runtime.subscribe,
        runtime.getSnapshot,
        runtime.getSnapshot
    );
};
