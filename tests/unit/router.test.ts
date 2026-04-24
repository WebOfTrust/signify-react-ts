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
                routeId: 'multisig',
                label: 'Multisig',
                gate: 'client',
                nav: true,
                testId: 'nav-multisig',
                path: '/multisig',
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
                id: 'multisig',
                handle: routeHandles[3],
            },
            {
                id: 'credentials',
                handle: routeHandles[4],
            },
            {
                id: 'client',
                handle: routeHandles[5],
            },
            {
                id: 'operations',
                handle: routeHandles[6],
            },
            {
                id: 'appNotifications',
                handle: routeHandles[7],
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

    it('adds non-navigation dashboard inventory detail routes', () => {
        const rootRoute = createAppRoutes({} as AppRuntime)[0];
        const dashboardRoutes = rootRoute.children
            ?.filter((route) => String(route.id ?? '').startsWith('dashboard'))
            .map((route) => ({
                id: route.id,
                path: route.path,
                hasLoader: route.loader !== undefined,
                hasHandle: route.handle !== undefined,
            }));

        expect(dashboardRoutes).toEqual([
            {
                id: 'dashboard',
                path: 'dashboard',
                hasLoader: true,
                hasHandle: true,
            },
            {
                id: 'dashboardSchemas',
                path: 'dashboard/schemas',
                hasLoader: true,
                hasHandle: false,
            },
            {
                id: 'dashboardIssuedCredentials',
                path: 'dashboard/credentials/issued',
                hasLoader: true,
                hasHandle: false,
            },
            {
                id: 'dashboardHeldCredentials',
                path: 'dashboard/credentials/held',
                hasLoader: true,
                hasHandle: false,
            },
            {
                id: 'dashboardCredentialDetail',
                path: 'dashboard/credentials/:credentialSaid',
                hasLoader: true,
                hasHandle: false,
            },
        ]);
    });

    it('adds non-navigation nested credential drilldown routes', () => {
        const rootRoute = createAppRoutes({} as AppRuntime)[0];
        const credentialRoutes = rootRoute.children
            ?.filter((route) => String(route.id ?? '').startsWith('credential'))
            .map((route) => ({
                id: route.id,
                path: route.path,
                hasLoader: route.loader !== undefined,
                hasAction: route.action !== undefined,
                hasHandle: route.handle !== undefined,
            }));

        expect(credentialRoutes).toEqual([
            {
                id: 'credentials',
                path: 'credentials',
                hasLoader: true,
                hasAction: true,
                hasHandle: true,
            },
            {
                id: 'credentialAid',
                path: 'credentials/:aid',
                hasLoader: true,
                hasAction: true,
                hasHandle: false,
            },
            {
                id: 'credentialIssuer',
                path: 'credentials/:aid/issuer',
                hasLoader: true,
                hasAction: true,
                hasHandle: false,
            },
            {
                id: 'credentialIssuerType',
                path: 'credentials/:aid/issuer/:typeKey',
                hasLoader: true,
                hasAction: true,
                hasHandle: false,
            },
            {
                id: 'credentialWallet',
                path: 'credentials/:aid/wallet',
                hasLoader: true,
                hasAction: true,
                hasHandle: false,
            },
        ]);
    });
});
