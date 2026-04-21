import { createScope, type Operation, type Scope, type Task } from 'effection';
import {
    AppServicesContext,
    ConfigContext,
    LoggerContext,
    RuntimeContext,
    StoreContext,
    type AppServices,
} from './contexts';

/**
 * Scope lifetime used when launching an Effection workflow from `AppRuntime`.
 *
 * `app` work can survive reconnects; `session` work is tied to a connected
 * KERIA session and is halted on disconnect or reconnect.
 */
export type RuntimeScopeKind = 'app' | 'session';

/**
 * Populate a scope with every context the workflow layer may request.
 */
const seedScope = (scope: Scope, services: AppServices): void => {
    scope.set(AppServicesContext, services);
    scope.set(RuntimeContext, services.runtime);
    scope.set(ConfigContext, services.config);
    scope.set(StoreContext, services.store);
    scope.set(LoggerContext, services.logger);
};

/**
 * Owns Effection lifetimes for the browser runtime.
 *
 * The app scope lives for the lifetime of the React app. The session scope is a
 * child scope recreated on every successful KERIA connection and halted on
 * disconnect/reconnect so polling and child waits cannot outlive a session.
 */
export class AppEffectionScopes {
    private readonly appScope: Scope;
    private readonly destroyAppScope: () => Promise<void>;
    private sessionScope: Scope | null = null;
    private destroySessionScope: (() => Promise<void>) | null = null;

    constructor(private readonly services: AppServices) {
        const [appScope, destroyAppScope] = createScope();
        this.appScope = appScope;
        this.destroyAppScope = async () => {
            await destroyAppScope();
        };
        seedScope(appScope, services);
    }

    /**
     * Create a fresh child scope for work tied to the current KERIA session.
     */
    async startSession(): Promise<void> {
        await this.haltSession();
        const [sessionScope, destroySessionScope] = createScope(this.appScope);
        this.sessionScope = sessionScope;
        this.destroySessionScope = async () => {
            await destroySessionScope();
        };
        seedScope(sessionScope, this.services);
    }

    /**
     * Halt all session-scoped workflows and forget the child scope.
     */
    async haltSession(): Promise<void> {
        if (this.destroySessionScope === null) {
            return;
        }

        const destroy = this.destroySessionScope;
        this.sessionScope = null;
        this.destroySessionScope = null;
        await destroy();
    }

    /**
     * Run an Effection operation in the app or active session scope.
     */
    run<T>(
        operation: () => Operation<T>,
        scopeKind: RuntimeScopeKind = 'session'
    ): Task<T> {
        const scope =
            scopeKind === 'session' && this.sessionScope !== null
                ? this.sessionScope
                : this.appScope;

        return scope.run(operation);
    }

    /**
     * Halt both session-scoped and app-scoped workflow lifetimes.
     */
    async destroy(): Promise<void> {
        await this.haltSession();
        await this.destroyAppScope();
    }
}
