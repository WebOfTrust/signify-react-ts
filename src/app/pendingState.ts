/**
 * App-wide async state derived from React Router and the Signify runtime.
 *
 * Keep this as a pure helper so loader labels can be unit tested without
 * rendering the router shell.
 */

/** Source category currently driving the app-wide loading overlay. */
export type PendingSource = 'navigation' | 'fetcher' | 'connection';

/** Derived loading overlay state consumed by the shell. */
export interface AppPendingState {
    active: boolean;
    label: string;
    source: PendingSource | null;
}

/** Minimal route location shape needed for pending labels. */
export interface PendingLocation {
    pathname: string;
}

/** Minimal React Router navigation shape used by pending derivation. */
export interface PendingNavigation {
    state: 'idle' | 'loading' | 'submitting';
    location?: PendingLocation;
    formData?: FormData;
    formAction?: string;
}

/** Minimal React Router fetcher shape used by pending derivation. */
export interface PendingFetcher {
    state: 'idle' | 'loading' | 'submitting';
    formData?: FormData;
    formAction?: string;
}

/** Input bundle for deriving one global pending state. */
export interface DerivePendingStateInput {
    navigation: PendingNavigation;
    fetchers: readonly PendingFetcher[];
    connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
}

const idlePendingState: AppPendingState = {
    active: false,
    label: 'Loading...',
    source: null,
};

/**
 * Map a submitted action intent to the user-facing loading label.
 */
const intentLabel = (intent: string): string | null => {
    if (intent === 'connect') {
        return 'Connecting to KERIA...';
    }

    if (intent === 'generatePasscode') {
        return 'Preparing Signify...';
    }

    if (intent === 'create') {
        return 'Creating identifier...';
    }

    if (intent === 'rotate') {
        return 'Rotating identifier...';
    }

    if (intent === 'issue') {
        return 'Issuing credential...';
    }

    if (intent === 'grant') {
        return 'Granting credential...';
    }

    if (intent === 'admit') {
        return 'Admitting credential...';
    }

    if (intent === 'present') {
        return 'Presenting credential...';
    }

    return null;
};

/**
 * Extract the `intent` field from route/fetcher form data.
 */
const formIntent = (formData?: FormData): string | null => {
    const intent = formData?.get('intent');
    return typeof intent === 'string' ? intent : null;
};

/**
 * Map a route path to a loading label.
 */
const pathLabel = (path?: string): string => {
    if (path === undefined) {
        return 'Loading...';
    }

    if (path.includes('/identifiers')) {
        return 'Loading identifiers...';
    }

    if (path.includes('/client')) {
        return 'Refreshing client state...';
    }

    if (path.includes('/credentials')) {
        return 'Loading credentials...';
    }

    return 'Loading...';
};

/**
 * Derive a label for one active navigation or fetcher.
 */
const pendingLabel = (
    pending: PendingNavigation | PendingFetcher
): string => {
    const intent = formIntent(pending.formData);
    if (intent !== null) {
        return intentLabel(intent) ?? 'Loading...';
    }

    return pathLabel(
        'location' in pending ? pending.location?.pathname : pending.formAction
    );
};

/**
 * Find the first fetcher currently in a specific active state.
 */
const firstActiveFetcher = (
    fetchers: readonly PendingFetcher[],
    state: 'submitting' | 'loading'
): PendingFetcher | null =>
    fetchers.find((fetcher) => fetcher.state === state) ?? null;

/**
 * Derive the single global pending indicator from router/runtime state.
 */
export const derivePendingState = ({
    navigation,
    fetchers,
    connectionStatus,
}: DerivePendingStateInput): AppPendingState => {
    if (connectionStatus === 'connecting') {
        return {
            active: true,
            label: 'Connecting to KERIA...',
            source: 'connection',
        };
    }

    const submittingFetcher = firstActiveFetcher(fetchers, 'submitting');
    if (submittingFetcher !== null) {
        return {
            active: true,
            label: pendingLabel(submittingFetcher),
            source: 'fetcher',
        };
    }

    if (navigation.state === 'submitting') {
        return {
            active: true,
            label: pendingLabel(navigation),
            source: 'navigation',
        };
    }

    const loadingFetcher = firstActiveFetcher(fetchers, 'loading');
    if (loadingFetcher !== null) {
        return {
            active: true,
            label: pendingLabel(loadingFetcher),
            source: 'fetcher',
        };
    }

    if (navigation.state === 'loading') {
        return {
            active: true,
            label: pendingLabel(navigation),
            source: 'navigation',
        };
    }

    return idlePendingState;
};
