import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, createAppRoutes } from '../../src/app/router';
import { DEFAULT_APP_PATH } from '../../src/app/routeData';
import type { AppRuntime } from '../../src/app/runtime';

describe('data-router route metadata', () => {
    it('keeps dashboard as the default route', () => {
        expect(DEFAULT_APP_PATH).toBe('/dashboard');
    });

    it('derives drawer navigation from route handles', () => {
        expect(APP_NAV_ITEMS).toEqual([
            {
                routeId: 'dashboard',
                label: 'Dashboard',
                gate: 'client',
                nav: true,
                testId: 'nav-dashboard',
                path: '/dashboard',
            },
            {
                routeId: 'contacts',
                label: 'Contacts',
                gate: 'client',
                nav: true,
                testId: 'nav-contacts',
                path: '/contacts',
            },
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
            {
                routeId: 'operations',
                label: 'Operations',
                gate: 'none',
                nav: true,
                testId: 'nav-operations',
                path: '/operations',
            },
            {
                routeId: 'appNotifications',
                label: 'Notifications',
                gate: 'none',
                nav: true,
                testId: 'nav-notifications',
                path: '/notifications',
            },
        ]);
    });

    it('attaches handles to the feature route objects', () => {
        const rootRoute = createAppRoutes({} as AppRuntime)[0];
        const featureRoutes = rootRoute.children?.filter(
            (route) => route.id !== undefined && route.handle !== undefined
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
                id: 'dashboard',
                handle: routeHandles[0],
            },
            {
                id: 'contacts',
                handle: routeHandles[1],
            },
            {
                id: 'identifiers',
                handle: routeHandles[2],
            },
            {
                id: 'credentials',
                handle: routeHandles[3],
            },
            {
                id: 'client',
                handle: routeHandles[4],
            },
            {
                id: 'operations',
                handle: routeHandles[5],
            },
            {
                id: 'appNotifications',
                handle: routeHandles[6],
            },
        ]);
    });

    it('adds a non-navigation contact detail route under contacts', () => {
        const rootRoute = createAppRoutes({} as AppRuntime)[0];
        const contactDetail = rootRoute.children?.find(
            (route) => route.id === 'contactDetail'
        );

        expect(contactDetail).toMatchObject({
            id: 'contactDetail',
            path: 'contacts/:contactId',
        });
        expect(contactDetail?.handle).toBeUndefined();
    });
});
