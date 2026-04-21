import type { Operation as EffectionOperation } from 'effection';
import { AppServicesContext } from '../effects/contexts';
import {
    createIdentifierService,
    listIdentifiersService,
    rotateIdentifierService,
} from '../services/identifiers.service';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import {
    identifierCreated,
    identifierListLoaded,
    identifierRotated,
} from '../state/identifiers.slice';

/*
 * Application operations are the unit-of-work layer. They may read Effection
 * Context for capabilities, but business inputs stay explicit in parameters.
 */

/**
 * Load identifiers through the connected runtime client and update Redux.
 */
export function* listIdentifiersOp(): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const identifiers = yield* listIdentifiersService({
        client: services.runtime.requireConnectedClient(),
    });

    services.store.dispatch(
        identifierListLoaded({
            identifiers,
            loadedAt: new Date().toISOString(),
        })
    );

    return identifiers;
}

/**
 * Create one identifier from a route draft, wait for KERIA completion, and
 * publish the refreshed identifier list.
 */
export function* createIdentifierOp(
    draft: IdentifierCreateDraft
): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const identifiers = yield* createIdentifierService({
        client: services.runtime.requireConnectedClient(),
        config: services.config,
        draft,
        logger: services.logger,
    });

    services.store.dispatch(
        identifierCreated({
            name: draft.name.trim(),
            identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return identifiers;
}

/**
 * Rotate one identifier, wait for KERIA completion, and publish the refreshed
 * identifier list.
 */
export function* rotateIdentifierOp(
    aid: string
): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const identifiers = yield* rotateIdentifierService({
        client: services.runtime.requireConnectedClient(),
        aid,
        logger: services.logger,
    });

    services.store.dispatch(
        identifierRotated({
            aid,
            identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return identifiers;
}
