import { createContext } from 'effection';
import type { AppRuntime } from '../app/runtime';
import type { AppConfig } from '../config';
import type { OperationLogger } from '../signify/client';
import type { AppStore } from '../state/store';

export interface AppServices {
    /** Browser runtime boundary that owns the live Signify session. */
    runtime: AppRuntime;
    /** Parsed runtime configuration shared by app, services, and workflows. */
    config: AppConfig;
    /** Redux store used for durable, inspectable workflow state. */
    store: AppStore;
    /** Optional operation logger injected into Signify operation waits. */
    logger: OperationLogger;
}

/**
 * Aggregate Effection context for workflows that need several app services.
 */
export const AppServicesContext =
    createContext<AppServices>('app.services');

/**
 * Narrow Effection context for workflows that only need the runtime boundary.
 */
export const RuntimeContext = createContext<AppRuntime>('app.runtime');

/**
 * Narrow Effection context for workflows that only need runtime config.
 */
export const ConfigContext = createContext<AppConfig>('app.config');

/**
 * Narrow Effection context for workflows that only need the Redux store.
 */
export const StoreContext = createContext<AppStore>('app.store');

/**
 * Narrow Effection context for workflows that only need operation logging.
 */
export const LoggerContext =
    createContext<OperationLogger>('app.logger', () => undefined);
