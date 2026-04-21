import { createContext } from 'react';
import type { AppRuntime } from './runtime';

/**
 * Context value shared by the provider component and runtime hooks.
 *
 * This lives in a non-component file so React Fast Refresh accepts
 * `runtimeContext.tsx` as a component-only module.
 */
export const AppRuntimeContext = createContext<AppRuntime | null>(null);
