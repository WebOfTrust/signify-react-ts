import type { DashboardLoaderData, RouteDataRuntime } from './routeData.types';
import { toRouteError } from './routeData.shared';
import { appConfig } from '../config';

/**
 * Loader for `/dashboard`.
 */
export const loadDashboard = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<DashboardLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await runtime
            .refreshState({ signal: request?.signal })
            .catch(() => null);
        await runtime.identifiers.list({ signal: request?.signal });
        await Promise.all([
            runtime.contacts.syncInventory({ signal: request?.signal }),
            runtime.credentials.syncKnownSchemas({ signal: request?.signal }),
            runtime.credentials.syncRegistries({ signal: request?.signal }),
            runtime.credentials.syncInventory({ signal: request?.signal }),
        ]);
        await runtime.credentials.syncIpexActivity({ signal: request?.signal });
        return {
            status: 'ready',
            verifiers: [...appConfig.w3cVerifiers],
        };
    } catch (error) {
        return {
            status: 'error',
            verifiers: [...appConfig.w3cVerifiers],
            message: `Unable to refresh dashboard inventory: ${toRouteError(error).message}`,
        };
    }
};
