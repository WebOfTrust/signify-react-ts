import {
    createBrowserRouter,
    redirect,
    type RouteObject,
} from 'react-router-dom';
import { ClientView } from '../features/client/ClientView';
import { CredentialsView } from '../features/credentials/CredentialsView';
import { IdentifiersView } from '../features/identifiers/IdentifiersView';
import { AppNotificationsView } from '../features/notifications/AppNotificationsView';
import { OperationDetailView } from '../features/operations/OperationDetailView';
import { OperationsView } from '../features/operations/OperationsView';
import type { AppRuntime } from './runtime';
import {
    DEFAULT_APP_PATH,
    identifiersAction,
    loadClient,
    loadCredentials,
    loadIdentifiers,
    rootAction,
} from './routeData';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/**
 * Stable IDs for feature routes that appear in the app shell.
 */
export type AppRouteId =
    | 'identifiers'
    | 'credentials'
    | 'client'
    | 'operations'
    | 'appNotifications';

/**
 * Gate policy declared by a route handle.
 *
 * `client` means the route needs a connected Signify client. `state` means the
 * route also needs the latest normalized client state snapshot.
 */
export type AppRouteGate = 'none' | 'client' | 'state';

/**
 * Metadata stored in React Router's native `handle` field for app routes.
 *
 * Handles are the replacement for the old app-specific view registry. Keep
 * drawer labels, stable smoke selectors, and route gating metadata here so
 * future breadcrumbs, tabs, or nested navigation can read the native router
 * match tree instead of a parallel list.
 */
export interface AppRouteHandle {
    /** Stable internal route identifier; do not use display labels as IDs. */
    routeId: AppRouteId;
    /** Human label rendered in the navigation drawer. */
    label: string;
    /** Connected-state requirement used by route loaders and docs. */
    gate: AppRouteGate;
    /** True when this route should appear in the app drawer. */
    nav: true;
    /** Stable browser-smoke selector for the drawer item. */
    testId: string;
}

/**
 * Navigation item derived from a route descriptor and its `handle`.
 */
export interface AppNavItem extends AppRouteHandle {
    /** Absolute browser path for drawer navigation. */
    path: string;
}

/**
 * Internal route descriptor used to keep route objects and drawer navigation on
 * one metadata source.
 */
interface AppFeatureRouteDescriptor {
    /** Route object ID and handle route ID. */
    id: AppRouteId;
    /** Relative child path under the root route. */
    path: string;
    /** Native React Router handle metadata for the feature route. */
    handle: AppRouteHandle;
}

/**
 * Ordered feature route registry used only to build native route objects.
 */
const APP_FEATURE_ROUTES: readonly AppFeatureRouteDescriptor[] = [
    {
        id: 'identifiers',
        path: 'identifiers',
        handle: {
            routeId: 'identifiers',
            label: 'Identifiers',
            gate: 'client',
            nav: true,
            testId: 'nav-identifiers',
        },
    },
    {
        id: 'credentials',
        path: 'credentials',
        handle: {
            routeId: 'credentials',
            label: 'Credentials',
            gate: 'client',
            nav: true,
            testId: 'nav-credentials',
        },
    },
    {
        id: 'client',
        path: 'client',
        handle: {
            routeId: 'client',
            label: 'Client',
            gate: 'state',
            nav: true,
            testId: 'nav-client',
        },
    },
    {
        id: 'operations',
        path: 'operations',
        handle: {
            routeId: 'operations',
            label: 'Operations',
            gate: 'none',
            nav: true,
            testId: 'nav-operations',
        },
    },
    {
        id: 'appNotifications',
        path: 'notifications',
        handle: {
            routeId: 'appNotifications',
            label: 'Notifications',
            gate: 'none',
            nav: true,
            testId: 'nav-notifications',
        },
    },
] as const;

/**
 * Drawer navigation derived from the same route descriptors used to build the
 * data-router tree.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = APP_FEATURE_ROUTES.map(
    (route) => ({
        ...route.handle,
        path: `/${route.path}`,
    })
);

/**
 * Data-router route objects for the app shell.
 *
 * Loaders and actions close over `AppRuntime` because browser data routers do
 * not have access to React context. Keep route metadata in `handle` so
 * navigation and future breadcrumbs can use React Router's native route model.
 */
export const createAppRoutes = (runtime: AppRuntime): RouteObject[] => [
    {
        id: 'root',
        path: '/',
        element: <RootLayout runtime={runtime} />,
        action: ({ request }) => rootAction(runtime, request),
        errorElement: <RouteErrorBoundary title="Application route failed" />,
        children: [
            {
                index: true,
                loader: () => redirect(DEFAULT_APP_PATH),
            },
            {
                id: 'identifiers',
                path: 'identifiers',
                handle: APP_FEATURE_ROUTES[0].handle,
                loader: ({ request }) => loadIdentifiers(runtime, request),
                action: ({ request }) => identifiersAction(runtime, request),
                element: <IdentifiersView />,
                errorElement: (
                    <RouteErrorBoundary title="Identifiers route failed" />
                ),
            },
            {
                id: 'credentials',
                path: 'credentials',
                handle: APP_FEATURE_ROUTES[1].handle,
                loader: () => loadCredentials(runtime),
                element: <CredentialsView />,
                errorElement: (
                    <RouteErrorBoundary title="Credentials route failed" />
                ),
            },
            {
                id: 'client',
                path: 'client',
                handle: APP_FEATURE_ROUTES[2].handle,
                loader: ({ request }) => loadClient(runtime, request),
                element: <ClientView />,
                errorElement: <RouteErrorBoundary title="Client route failed" />,
            },
            {
                id: 'operations',
                path: 'operations',
                handle: APP_FEATURE_ROUTES[3].handle,
                element: <OperationsView />,
                errorElement: (
                    <RouteErrorBoundary title="Operations route failed" />
                ),
            },
            {
                id: 'operationDetail',
                path: 'operations/:requestId',
                element: <OperationDetailView />,
                errorElement: (
                    <RouteErrorBoundary title="Operation route failed" />
                ),
            },
            {
                id: 'appNotifications',
                path: 'notifications',
                handle: APP_FEATURE_ROUTES[4].handle,
                element: <AppNotificationsView />,
                errorElement: (
                    <RouteErrorBoundary title="Notifications route failed" />
                ),
            },
            {
                path: '*',
                loader: () => redirect(DEFAULT_APP_PATH),
            },
        ],
    },
];

/**
 * Build the browser router used by `App`.
 */
export const createAppRouter = (runtime: AppRuntime) =>
    createBrowserRouter(createAppRoutes(runtime));
