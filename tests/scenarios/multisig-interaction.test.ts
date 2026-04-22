import { assertMultisigIxn } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import {
    MULTISIG_IXN_ROUTE,
    acceptMultisigInteractionService,
    startMultisigInteractionService,
} from '../../src/services/multisig.service';
import {
    createWitnessedIdentifier,
    markAndRemoveNotification,
    runServiceOperation,
    uniqueAlias,
    waitForNotification,
    waitForNotifications,
} from '../support/keria';
import {
    acceptInteractionNotes,
    expectGroupConvergence,
    notificationSaid,
    requestInput,
    requiredValue,
    setupActiveMultisigGroup,
} from '../support/multisig';

const interactionPayload = ({
    prefix,
    sequence,
    digest,
}: {
    prefix: string;
    sequence: string;
    digest: string;
}): Array<{ i: string; s: string; d: string }> => [
    {
        i: prefix,
        s: sequence,
        d: digest,
    },
];

describe.sequential('multisig interaction workflow quality gate', () => {
    it(
        'proves a two-member interaction request, accept, payload, and repeated sequence advance',
        async () => {
            const group = await setupActiveMultisigGroup(
                'multisig-interaction-two',
                2
            );
            const initiator = requiredValue(group.roles[0], 'Missing initiator.');
            const acceptor = requiredValue(group.roles[1], 'Missing acceptor.');
            const initiatorAlias = requiredValue(
                group.aliases[0],
                'Missing initiator alias.'
            );
            const acceptorAlias = requiredValue(
                group.aliases[1],
                'Missing acceptor alias.'
            );
            const before = await expectGroupConvergence(
                group.roles,
                group.groupAlias
            );
            const payload = interactionPayload(before);
            const interacting = runServiceOperation(() =>
                startMultisigInteractionService({
                    client: initiator.client,
                    draft: {
                        groupAlias: group.groupAlias,
                        localMemberName: initiatorAlias,
                        data: payload,
                    },
                })
            );
            const notification = await waitForNotification(
                acceptor,
                MULTISIG_IXN_ROUTE
            );
            const request = assertMultisigIxn(
                (
                    await acceptor.client
                        .groups()
                        .getRequest(notificationSaid(notification))
                )[0]
            );

            await Promise.all([
                interacting,
                acceptInteractionNotes(
                    acceptor,
                    [notification],
                    group.groupAlias,
                    acceptorAlias
                ),
            ]);

            expect(notification.r).toBe(false);
            expect(request.exn.a.gid).toBe(before.prefix);
            expect(request.exn.a.smids).toEqual(group.memberAids);
            expect(request.exn.a.rmids).toEqual(group.memberAids);
            expect(request.exn.e.ixn.a).toEqual(payload);

            const afterFirst = await expectGroupConvergence(
                group.roles,
                group.groupAlias
            );
            expect(Number(afterFirst.sequence)).toBe(Number(before.sequence) + 1);

            const repeatedPayload = interactionPayload(afterFirst);
            const repeating = runServiceOperation(() =>
                startMultisigInteractionService({
                    client: initiator.client,
                    draft: {
                        groupAlias: group.groupAlias,
                        localMemberName: initiatorAlias,
                        data: repeatedPayload,
                    },
                })
            );
            const repeatedNotification = await waitForNotification(
                acceptor,
                MULTISIG_IXN_ROUTE
            );
            await Promise.all([
                repeating,
                acceptInteractionNotes(
                    acceptor,
                    [repeatedNotification],
                    group.groupAlias,
                    acceptorAlias
                ),
            ]);
            const afterSecond = await expectGroupConvergence(
                group.roles,
                group.groupAlias
            );
            expect(Number(afterSecond.sequence)).toBe(
                Number(afterFirst.sequence) + 1
            );
        },
        300_000
    );

    it(
        'proves a three-member interaction with concurrent acceptors',
        async () => {
            const group = await setupActiveMultisigGroup(
                'multisig-interaction-three',
                3
            );
            const initiator = requiredValue(group.roles[0], 'Missing initiator.');
            const acceptors = group.roles.slice(1);
            const initiatorAlias = requiredValue(
                group.aliases[0],
                'Missing initiator alias.'
            );
            const before = await expectGroupConvergence(
                group.roles,
                group.groupAlias
            );
            const payload = interactionPayload(before);
            const interacting = runServiceOperation(() =>
                startMultisigInteractionService({
                    client: initiator.client,
                    draft: {
                        groupAlias: group.groupAlias,
                        localMemberName: initiatorAlias,
                        data: payload,
                    },
                })
            );
            const noteSets = await Promise.all(
                acceptors.map((role) =>
                    waitForNotifications(role, MULTISIG_IXN_ROUTE, 1)
                )
            );

            const requests = [];
            for (const [index, noteSet] of noteSets.entries()) {
                const request = assertMultisigIxn(
                    (
                        await requiredValue(
                            acceptors[index],
                            'Missing acceptor.'
                        )
                            .client
                            .groups()
                            .getRequest(
                                notificationSaid(
                                    requiredValue(
                                        noteSet[0],
                                        'Missing interaction notification.'
                                    )
                                )
                            )
                    )[0]
                );
                requests.push(request);
            }

            await Promise.all([
                interacting,
                ...acceptors.map((role, index) =>
                    acceptInteractionNotes(
                        role,
                        noteSets[index],
                        group.groupAlias,
                        requiredValue(
                            group.aliases[index + 1],
                            'Missing acceptor alias.'
                        )
                    )
                ),
            ]);
            for (const request of requests) {
                expect(request.exn.a.gid).toBe(before.prefix);
                expect(request.exn.a.smids).toEqual(group.memberAids);
                expect(request.exn.a.rmids).toEqual(group.memberAids);
                expect(request.exn.e.ixn.a).toEqual(payload);
            }
            const after = await expectGroupConvergence(
                group.roles,
                group.groupAlias
            );
            expect(Number(after.sequence)).toBe(Number(before.sequence) + 1);
        },
        360_000
    );

    it(
        'rejects interaction start and accept when the selected local AID is not a signing member',
        async () => {
            const group = await setupActiveMultisigGroup(
                'multisig-interaction-reject',
                2
            );
            const initiator = requiredValue(group.roles[0], 'Missing initiator.');
            const acceptor = requiredValue(group.roles[1], 'Missing acceptor.');
            const nonMemberAlias = uniqueAlias('multisig-interaction-outsider');
            await createWitnessedIdentifier(acceptor, nonMemberAlias);

            await expect(
                runServiceOperation(() =>
                    startMultisigInteractionService({
                        client: acceptor.client,
                        draft: {
                            groupAlias: group.groupAlias,
                            localMemberName: nonMemberAlias,
                            data: { test: 'not-a-member-start' },
                        },
                    })
                )
            ).rejects.toThrow('The selected local member is not a signing member.');

            const interacting = runServiceOperation(() =>
                startMultisigInteractionService({
                    client: initiator.client,
                    draft: {
                        groupAlias: group.groupAlias,
                        localMemberName: requiredValue(
                            group.aliases[0],
                            'Missing initiator alias.'
                        ),
                        data: { test: 'not-a-member-accept' },
                    },
                })
            );
            const notification = await waitForNotification(
                acceptor,
                MULTISIG_IXN_ROUTE
            );

            try {
                await expect(
                    runServiceOperation(() =>
                        acceptMultisigInteractionService({
                            client: acceptor.client,
                            input: requestInput(
                                notification,
                                group.groupAlias,
                                nonMemberAlias
                            ),
                        })
                    )
                ).rejects.toThrow(
                    'The selected local member is not a signing member.'
                );
            } finally {
                await runServiceOperation(() =>
                    acceptMultisigInteractionService({
                        client: acceptor.client,
                        input: requestInput(
                            notification,
                            group.groupAlias,
                            requiredValue(
                                group.aliases[1],
                                'Missing acceptor alias.'
                            )
                        ),
                    })
                );
                await markAndRemoveNotification(acceptor, notification);
                await interacting;
            }
        },
        300_000
    );
});
