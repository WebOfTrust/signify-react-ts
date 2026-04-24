import { describe, expect, it } from 'vitest';
import type { IdentifierSummary } from '../../src/features/identifiers/identifierTypes';
import {
    defaultMultisigRequestGroupAlias,
    displayMultisigRequestGroupAlias,
    UNKNOWN_MULTISIG_GROUP_ALIAS,
} from '../../src/features/multisig/multisigRequestUi';
import type { MultisigRequestNotification } from '../../src/state/notifications.slice';

const request = (
    overrides: Partial<MultisigRequestNotification> = {}
): MultisigRequestNotification => ({
    notificationId: 'note-1',
    exnSaid: 'Eexn',
    route: '/multisig/icp',
    senderAid: 'Elead',
    groupAid: 'Egroup',
    groupAlias: null,
    signingMemberAids: ['Elead', 'Efollower'],
    rotationMemberAids: ['Elead', 'Efollower'],
    signingThreshold: ['1/2', '1/2'],
    rotationThreshold: ['1/2', '1/2'],
    embeddedPayloadSummary: null,
    embeddedEventType: 'icp',
    embeddedEventSaid: 'Eicp',
    progress: {
        groupAid: 'Egroup',
        route: '/multisig/icp',
        expectedMemberAids: ['Elead', 'Efollower'],
        respondedMemberAids: ['Elead'],
        waitingMemberAids: ['Efollower'],
        completed: 1,
        total: 2,
    },
    createdAt: '2026-04-22T00:00:00.000Z',
    status: 'actionable',
    ...overrides,
});

describe('multisig request UI helpers', () => {
    it('does not synthesize a group alias for inbound inception joins', () => {
        const identifiers: IdentifierSummary[] = [
            { name: 'follower', prefix: 'Efollower' } as IdentifierSummary,
        ];

        expect(defaultMultisigRequestGroupAlias(request(), identifiers)).toBe('');
        expect(displayMultisigRequestGroupAlias(request(), identifiers)).toBe(
            UNKNOWN_MULTISIG_GROUP_ALIAS
        );
    });

    it('uses a local group alias when the request group already exists locally', () => {
        const identifiers: IdentifierSummary[] = [
            { name: 'team', prefix: 'Egroup', group: {} } as IdentifierSummary,
        ];

        expect(defaultMultisigRequestGroupAlias(request(), identifiers)).toBe(
            'team'
        );
        expect(displayMultisigRequestGroupAlias(request(), identifiers)).toBe(
            'team'
        );
    });

    it('keeps generated fallback labels for non-inception requests without aliases', () => {
        expect(
            defaultMultisigRequestGroupAlias(
                request({ route: '/multisig/ixn' }),
                []
            )
        ).toBe('group-Egroup');
    });
});
