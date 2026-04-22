import type { ReactNode } from 'react';
import type { AppRuntime } from './runtime';
import { AppRuntimeContext } from './runtimeContextValue';

/**
 * Props for the React provider that exposes the data-router runtime instance.
 */
export interface AppRuntimeProviderProps {
    /** Runtime instance shared by the router factory and React context. */
    runtime: AppRuntime;
    /** Shell and route elements that need access to runtime state. */
    children: ReactNode;
}

/**
 * React bridge for the app runtime used by data-router loaders and actions.
 *
 * Keep the runtime object itself outside React so route functions can use it,
 * then expose the same instance to components through context and
 * `useSyncExternalStore`.
 */
export const AppRuntimeProvider = ({
    runtime,
    children,
}: AppRuntimeProviderProps) => (
    <AppRuntimeContext value={runtime}>{children}</AppRuntimeContext>
);
