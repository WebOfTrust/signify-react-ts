import { configureStore } from '@reduxjs/toolkit';
import { appNotificationsReducer } from './appNotifications.slice';
import { challengesReducer } from './challenges.slice';
import { contactsReducer } from './contacts.slice';
import { credentialsReducer } from './credentials.slice';
import { exchangeTombstonesReducer } from './exchangeTombstones.slice';
import { identifiersReducer } from './identifiers.slice';
import { notificationsReducer } from './notifications.slice';
import { operationsReducer } from './operations.slice';
import { registryReducer } from './registry.slice';
import { rolesReducer } from './roles.slice';
import { schemaReducer } from './schema.slice';
import { sessionReducer } from './session.slice';
import { uiPreferencesReducer } from './uiPreferences.slice';
import { loadPersistedUiPreferences } from './uiPreferencesPersistence';

/**
 * Create an isolated Redux store for app runtime or unit tests.
 */
export const createAppStore = () =>
    configureStore({
        reducer: {
            session: sessionReducer,
            operations: operationsReducer,
            appNotifications: appNotificationsReducer,
            contacts: contactsReducer,
            challenges: challengesReducer,
            exchangeTombstones: exchangeTombstonesReducer,
            credentials: credentialsReducer,
            identifiers: identifiersReducer,
            notifications: notificationsReducer,
            schema: schemaReducer,
            registry: registryReducer,
            roles: rolesReducer,
            uiPreferences: uiPreferencesReducer,
        },
        preloadedState: {
            uiPreferences: loadPersistedUiPreferences(),
        },
    });

/**
 * Browser singleton store used by the default app runtime.
 */
export const appStore = createAppStore();

/** Concrete Redux store type returned by `createAppStore`. */
export type AppStore = ReturnType<typeof createAppStore>;

/** Root state shape consumed by selectors and typed hooks. */
export type RootState = ReturnType<AppStore['getState']>;

/** Dispatch type for all app slice actions. */
export type AppDispatch = AppStore['dispatch'];
