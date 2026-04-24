import {
    createBrowserRouter,
    redirect,
    type RouteObject,
} from 'react-router-dom';
import { ClientView } from '../features/client/ClientView';
import { ContactDetailView } from '../features/contacts/ContactDetailView';
import { ContactsView } from '../features/contacts/ContactsView';
import { CredentialsView } from '../features/credentials/CredentialsView';
import { DashboardView } from '../features/dashboard/DashboardView';
import { IdentifiersView } from '../features/identifiers/IdentifiersView';
import { MultisigView } from '../features/multisig/MultisigView';
import { AppNotificationsView } from '../features/notifications/AppNotificationsView';
import { NotificationDetailView } from '../features/notifications/NotificationDetailView';
import { OperationDetailView } from '../features/operations/OperationDetailView';
import { OperationsView } from '../features/operations/OperationsView';
import type { AppRuntime } from './runtime';
import {
    DEFAULT_APP_PATH,
    contactsAction,
    credentialsAction,
    identifiersAction,
    loadContacts,
    loadDashboard,
    loadClient,
    loadCredentials,
    loadIdentifiers,
    loadMultisig,
    loadNotifications,
    multisigAction,
    notificationsAction,
    rootAction,
} from './routeData';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/**
 * Stable IDs for feature routes that appear in the app shell.
 */
export type AppRouteId =
    | 'dashboard'
    | 'contacts'
    | 'identifiers'
    | 'multisig'
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
        id: 'dashboard',
        path: 'dashboard',
        handle: {
            routeId: 'dashboard',
            label: 'Dashboard',
            gate: 'client',
            nav: true,
            testId: 'nav-dashboard',
        },
    },
    {
        id: 'contacts',
        path: 'contacts',
        handle: {
            routeId: 'contacts',
            label: 'Contacts',
            gate: 'client',
            nav: true,
            testId: 'nav-contacts',
        },
    },
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
        id: 'multisig',
        path: 'multisig',
        handle: {
            routeId: 'multisig',
            label: 'Multisig',
            gate: 'client',
            nav: true,
            testId: 'nav-multisig',
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

const credentialRoute = (
    id: string,
    path: string,
    runtime: AppRuntime,
    handle?: AppRouteHandle
): RouteObject => ({
    id,
    path,
    handle,
    loader: ({ request }) => loadCredentials(runtime, request),
    action: ({ request }) => credentialsAction(runtime, request),
    element: <CredentialsView />,
    errorElement: <RouteErrorBoundary title="Credentials route failed" />,
});

const dashboardRoute = (
    id: string,
    path: string,
    runtime: AppRuntime,
    handle?: AppRouteHandle
): RouteObject => ({
    id,
    path,
    handle,
    loader: ({ request }) => loadDashboard(runtime, request),
    element: <DashboardView />,
    errorElement: <RouteErrorBoundary title="Dashboard route failed" />,
});

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
            dashboardRoute(
                'dashboard',
                'dashboard',
                runtime,
                APP_FEATURE_ROUTES[0].handle
            ),
            dashboardRoute('dashboardSchemas', 'dashboard/schemas', runtime),
            dashboardRoute(
                'dashboardIssuedCredentials',
                'dashboard/credentials/issued',
                runtime
            ),
            dashboardRoute(
                'dashboardHeldCredentials',
                'dashboard/credentials/held',
                runtime
            ),
            dashboardRoute(
                'dashboardCredentialDetail',
                'dashboard/credentials/:credentialSaid',
                runtime
            ),
            {
                id: 'contacts',
                path: 'contacts',
                handle: APP_FEATURE_ROUTES[1].handle,
                loader: ({ request }) => loadContacts(runtime, request),
                action: ({ request }) => contactsAction(runtime, request),
                element: <ContactsView />,
                errorElement: (
                    <RouteErrorBoundary title="Contacts route failed" />
                ),
            },
            {
                id: 'contactDetail',
                path: 'contacts/:contactId',
                loader: ({ request }) => loadContacts(runtime, request),
                action: ({ request }) => contactsAction(runtime, request),
                element: <ContactDetailView />,
                errorElement: (
                    <RouteErrorBoundary title="Contact route failed" />
                ),
            },
            {
                id: 'identifiers',
                path: 'identifiers',
                handle: APP_FEATURE_ROUTES[2].handle,
                loader: ({ request }) => loadIdentifiers(runtime, request),
                action: ({ request }) => identifiersAction(runtime, request),
                element: <IdentifiersView />,
                errorElement: (
                    <RouteErrorBoundary title="Identifiers route failed" />
                ),
            },
            {
                id: 'multisig',
                path: 'multisig',
                handle: APP_FEATURE_ROUTES[3].handle,
                loader: ({ request }) => loadMultisig(runtime, request),
                action: ({ request }) => multisigAction(runtime, request),
                element: <MultisigView />,
                errorElement: (
                    <RouteErrorBoundary title="Multisig route failed" />
                ),
            },
            credentialRoute(
                'credentials',
                'credentials',
                runtime,
                APP_FEATURE_ROUTES[4].handle
            ),
            credentialRoute('credentialAid', 'credentials/:aid', runtime),
            credentialRoute(
                'credentialIssuer',
                'credentials/:aid/issuer',
                runtime
            ),
            credentialRoute(
                'credentialIssuerType',
                'credentials/:aid/issuer/:typeKey',
                runtime
            ),
            credentialRoute(
                'credentialWallet',
                'credentials/:aid/wallet',
                runtime
            ),
            {
                id: 'client',
                path: 'client',
                handle: APP_FEATURE_ROUTES[5].handle,
                loader: ({ request }) => loadClient(runtime, request),
                element: <ClientView />,
                errorElement: (
                    <RouteErrorBoundary title="Client route failed" />
                ),
            },
            {
                id: 'operations',
                path: 'operations',
                handle: APP_FEATURE_ROUTES[6].handle,
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
                handle: APP_FEATURE_ROUTES[7].handle,
                loader: ({ request }) => loadNotifications(runtime, request),
                action: ({ request }) => notificationsAction(runtime, request),
                element: <AppNotificationsView />,
                errorElement: (
                    <RouteErrorBoundary title="Notifications route failed" />
                ),
            },
            {
                id: 'notificationDetail',
                path: 'notifications/:notificationId',
                loader: ({ request }) => loadNotifications(runtime, request),
                action: ({ request }) => notificationsAction(runtime, request),
                element: <NotificationDetailView />,
                errorElement: (
                    <RouteErrorBoundary title="Notification route failed" />
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
