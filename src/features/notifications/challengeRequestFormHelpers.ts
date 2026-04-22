import type { ChallengeRequestNotification } from '../../state/notifications.slice';
import type { IdentifierSummary } from '../identifiers/identifierTypes';

export const defaultChallengeResponseIdentifierName = (
    request: Pick<ChallengeRequestNotification, 'recipientAid'>,
    identifiers: readonly IdentifierSummary[]
): string => {
    if (request.recipientAid !== null) {
        const recipientIdentifier = identifiers.find(
            (identifier) => identifier.prefix === request.recipientAid
        );
        if (recipientIdentifier !== undefined) {
            return recipientIdentifier.name;
        }
    }

    return identifiers[0]?.name ?? '';
};
