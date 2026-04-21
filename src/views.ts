/**
 * Closed set of app shell views.
 *
 * Use this union instead of display labels or route-like strings so drawer
 * navigation and view rendering stay exhaustively typed.
 */
export type ViewId = 'identifiers' | 'credentials' | 'client';

/**
 * View shown after startup and after a successful KERIA connection.
 */
export const DEFAULT_VIEW: ViewId = 'identifiers';

/**
 * App shell metadata for a drawer item and its view gating policy.
 */
export interface ViewDefinition {
    id: ViewId;
    label: string;
    path: string;
    /** True when the view should render the connection-required state first. */
    requiresConnection: boolean;
    /** Stable browser-smoke selector; update smoke tests before changing. */
    testId: string;
}

/**
 * Ordered drawer/view registry.
 *
 * Add new views here first, then update `AppShell` routes so the `ViewId` union
 * remains the single source of truth.
 */
export const VIEW_DEFINITIONS: readonly ViewDefinition[] = [
    {
        id: 'identifiers',
        label: 'Identifiers',
        path: '/identifiers',
        requiresConnection: true,
        testId: 'nav-identifiers',
    },
    {
        id: 'credentials',
        label: 'Credentials',
        path: '/credentials',
        requiresConnection: true,
        testId: 'nav-credentials',
    },
    {
        id: 'client',
        label: 'Client',
        path: '/client',
        requiresConnection: true,
        testId: 'nav-client',
    },
] as const;

export const pathForView = (viewId: ViewId): string =>
    VIEW_DEFINITIONS.find((view) => view.id === viewId)?.path ?? '/identifiers';
