import { describe, expect, it } from 'vitest';
import {
    derivePendingState,
    type PendingFetcher,
    type PendingNavigation,
} from '../../src/app/pendingState';

const idleNavigation: PendingNavigation = {
    state: 'idle',
};

const formData = (intent: string): FormData => {
    const data = new FormData();
    data.set('intent', intent);
    return data;
};

describe('derivePendingState', () => {
    it('returns inactive state for idle router and runtime state', () => {
        expect(
            derivePendingState({
                navigation: idleNavigation,
                fetchers: [],
                connectionStatus: 'idle',
            })
        ).toEqual({
            active: false,
            label: 'Loading...',
            source: null,
        });
    });

    it('labels identifier route navigation loads', () => {
        expect(
            derivePendingState({
                navigation: {
                    state: 'loading',
                    location: { pathname: '/identifiers' },
                },
                fetchers: [],
                connectionStatus: 'connected',
            })
        ).toEqual({
            active: true,
            label: 'Loading identifiers...',
            source: 'navigation',
        });
    });

    it('labels connect fetcher submissions', () => {
        const fetcher: PendingFetcher = {
            state: 'submitting',
            formData: formData('connect'),
            formAction: '/',
        };

        expect(
            derivePendingState({
                navigation: idleNavigation,
                fetchers: [fetcher],
                connectionStatus: 'idle',
            })
        ).toEqual({
            active: true,
            label: 'Connecting to KERIA...',
            source: 'fetcher',
        });
    });

    it('labels Signify passcode generation fetcher submissions', () => {
        const fetcher: PendingFetcher = {
            state: 'submitting',
            formData: formData('generatePasscode'),
            formAction: '/',
        };

        expect(
            derivePendingState({
                navigation: idleNavigation,
                fetchers: [fetcher],
                connectionStatus: 'idle',
            })
        ).toEqual({
            active: true,
            label: 'Preparing Signify...',
            source: 'fetcher',
        });
    });

    it('keeps runtime connection pending after router state settles', () => {
        expect(
            derivePendingState({
                navigation: idleNavigation,
                fetchers: [],
                connectionStatus: 'connecting',
            })
        ).toEqual({
            active: true,
            label: 'Connecting to KERIA...',
            source: 'connection',
        });
    });

    it('uses active RTK operation facts when router state is idle', () => {
        expect(
            derivePendingState({
                navigation: idleNavigation,
                fetchers: [],
                connectionStatus: 'connected',
                activeOperationLabel: 'Resolving contact...',
            })
        ).toEqual({
            active: true,
            label: 'Resolving contact...',
            source: 'runtime',
        });
    });
});
