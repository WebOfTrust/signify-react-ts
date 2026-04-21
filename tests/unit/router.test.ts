import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, createAppRoutes } from '../../src/app/router';
import { DEFAULT_APP_PATH } from '../../src/app/routeData';
import type { AppRuntime } from '../../src/app/runtime';

describe('data-router route metadata', () => {
    it('keeps identifiers as the default route', () => {
        expect(DEFAULT_APP_PATH).toBe('/identifiers');
    });

    it('derives drawer navigation from route handles', () => {
        expect(APP_NAV_ITEMS).toEqual([
            {
                routeId: 'identifiers',
                label: 'Identifiers',
                gate: 'client',
                nav: true,
                testId: 'nav-identifiers',
                path: '/identifiers',
            },
            {
                routeId: 'credentials',
                label: 'Credentials',
                gate: 'client',
                nav: true,
                testId: 'nav-credentials',
                path: '/credentials',
            },
            {
                routeId: 'client',
                label: 'Client',
                gate: 'state',
                nav: true,
                testId: 'nav-client',
                path: '/client',
            },
        ]);
    });

    it('attaches handles to the feature route objects', () => {
        const rootRoute = createAppRoutes({} as AppRuntime)[0];
        const featureRoutes = rootRoute.children?.filter(
            (route) => route.id !== undefined
        );
        const routeHandles = APP_NAV_ITEMS.map((item) => ({
            routeId: item.routeId,
            label: item.label,
            gate: item.gate,
            nav: item.nav,
            testId: item.testId,
        }));

        expect(
            featureRoutes?.map((route) => ({
                id: route.id,
                handle: route.handle,
            }))
        ).toEqual([
            {
                id: 'identifiers',
                handle: routeHandles[0],
            },
            {
                id: 'credentials',
                handle: routeHandles[1],
            },
            {
                id: 'client',
                handle: routeHandles[2],
            },
        ]);
    });
});
