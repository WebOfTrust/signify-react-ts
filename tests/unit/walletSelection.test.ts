import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/state/store';
import { identifierListLoaded } from '../../src/state/identifiers.slice';
import { registryInventoryLoaded } from '../../src/state/registry.slice';
import { sessionConnecting } from '../../src/state/session.slice';
import {
    selectReadyCredentialRegistriesForSelectedAid,
    selectSelectedWalletAid,
    selectSelectedWalletIdentifier,
    selectSelectedWalletRegistry,
} from '../../src/state/selectors';
import {
    walletAidSelected,
    walletRegistrySelected,
} from '../../src/state/walletSelection.slice';
import type { IdentifierSummary } from '../../src/features/identifiers/identifierTypes';
import type { RegistryRecord } from '../../src/state/registry.slice';

const now = '2026-04-22T00:00:00.000Z';

const identifier = (name: string, prefix: string): IdentifierSummary =>
    ({ name, prefix }) as IdentifierSummary;

const registry = (
    id: string,
    issuerAid: string,
    status: RegistryRecord['status'] = 'ready'
): RegistryRecord => ({
    id,
    name: `issuer-${issuerAid}`,
    registryName: `registry-${id}`,
    regk: status === 'ready' ? id : '',
    issuerAlias: `issuer-${issuerAid}`,
    issuerAid,
    status,
    error: null,
    updatedAt: now,
});

describe('wallet-wide selection state', () => {
    it('selects a local AID and clears registry selection when AID changes', () => {
        const store = createAppStore();
        store.dispatch(
            identifierListLoaded({
                identifiers: [
                    identifier('issuer-one', 'Eissuer1'),
                    identifier('issuer-two', 'Eissuer2'),
                ],
                loadedAt: now,
            })
        );
        store.dispatch(
            registryInventoryLoaded({
                registries: [
                    registry('Eregistry1', 'Eissuer1'),
                    registry('Eregistry2', 'Eissuer2'),
                ],
                loadedAt: now,
            })
        );

        store.dispatch(walletAidSelected({ aid: 'Eissuer1' }));
        store.dispatch(walletRegistrySelected({ registryId: 'Eregistry1' }));

        expect(selectSelectedWalletAid(store.getState())).toBe('Eissuer1');
        expect(selectSelectedWalletIdentifier(store.getState())?.name).toBe(
            'issuer-one'
        );
        expect(selectSelectedWalletRegistry(store.getState())?.id).toBe(
            'Eregistry1'
        );

        store.dispatch(walletAidSelected({ aid: 'Eissuer2' }));

        expect(selectSelectedWalletAid(store.getState())).toBe('Eissuer2');
        expect(selectSelectedWalletRegistry(store.getState())).toBeNull();
        expect(
            selectReadyCredentialRegistriesForSelectedAid(store.getState()).map(
                (record) => record.id
            )
        ).toEqual(['Eregistry2']);
    });

    it('ignores stale registry selections and resets on session reconnect', () => {
        const store = createAppStore();
        store.dispatch(
            identifierListLoaded({
                identifiers: [identifier('issuer-one', 'Eissuer1')],
                loadedAt: now,
            })
        );
        store.dispatch(
            registryInventoryLoaded({
                registries: [registry('EotherRegistry', 'Eother')],
                loadedAt: now,
            })
        );

        store.dispatch(walletAidSelected({ aid: 'Eissuer1' }));
        store.dispatch(
            walletRegistrySelected({ registryId: 'EotherRegistry' })
        );

        expect(selectSelectedWalletRegistry(store.getState())).toBeNull();

        store.dispatch(sessionConnecting());
        expect(selectSelectedWalletAid(store.getState())).toBeNull();
    });
});
