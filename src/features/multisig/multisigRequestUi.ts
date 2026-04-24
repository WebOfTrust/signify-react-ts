import type { IdentifierSummary } from '../identifiers/identifierTypes';
import type { MultisigRequestNotification } from '../../state/notifications.slice';

export type MultisigRequestIntent =
    | 'joinInception'
    | 'acceptEndRole'
    | 'acceptInteraction'
    | 'acceptRotation';

export const UNKNOWN_MULTISIG_GROUP_ALIAS = 'Unknown until joined';

const isGroupIdentifier = (identifier: IdentifierSummary): boolean =>
    'group' in identifier;

export const defaultMultisigRequestLocalMember = (
    request: MultisigRequestNotification,
    identifiers: readonly IdentifierSummary[]
): IdentifierSummary | null => {
    const participants = new Set([
        ...request.signingMemberAids,
        ...request.rotationMemberAids,
    ]);
    return (
        identifiers.find((identifier) => participants.has(identifier.prefix)) ??
        identifiers.find((identifier) => !isGroupIdentifier(identifier)) ??
        null
    );
};

export const multisigRequestLocalMembers = (
    identifiers: readonly IdentifierSummary[]
): IdentifierSummary[] =>
    identifiers.filter((identifier) => !isGroupIdentifier(identifier));

export const requiresMultisigJoinLabel = (
    request: MultisigRequestNotification
): boolean => request.route === '/multisig/icp';

export const defaultMultisigRequestGroupAlias = (
    request: MultisigRequestNotification,
    identifiers: readonly IdentifierSummary[]
): string => {
    const existing =
        request.groupAid === null
            ? undefined
            : identifiers.find(
                  (identifier) => identifier.prefix === request.groupAid
              );
    const requestAlias = request.groupAlias?.trim();

    if (existing !== undefined) {
        return existing.name;
    }

    if (requestAlias !== undefined && requestAlias.length > 0) {
        return requestAlias;
    }

    if (requiresMultisigJoinLabel(request)) {
        return '';
    }

    return request.groupAid === null
        ? 'multisig-group'
        : `group-${request.groupAid.slice(-6)}`;
};

export const displayMultisigRequestGroupAlias = (
    request: MultisigRequestNotification,
    identifiers: readonly IdentifierSummary[]
): string => {
    const alias = defaultMultisigRequestGroupAlias(request, identifiers);
    return alias.length > 0 ? alias : UNKNOWN_MULTISIG_GROUP_ALIAS;
};

export const multisigRequestIntent = (
    request: MultisigRequestNotification
): MultisigRequestIntent => {
    if (request.route === '/multisig/icp') {
        return 'joinInception';
    }

    if (request.route === '/multisig/rpy') {
        return 'acceptEndRole';
    }

    if (request.route === '/multisig/ixn') {
        return 'acceptInteraction';
    }

    return 'acceptRotation';
};

export const multisigRequestTitle = (
    request: MultisigRequestNotification
): string => {
    if (request.route === '/multisig/icp') {
        return 'Group invitation';
    }
    if (request.route === '/multisig/rpy') {
        return 'Agent authorization';
    }
    if (request.route === '/multisig/ixn') {
        return 'Interaction approval';
    }
    return 'Rotation approval';
};

export const multisigRequestActionLabel = (
    request: MultisigRequestNotification
): string => {
    if (request.route === '/multisig/icp') {
        return 'Join group';
    }
    if (request.route === '/multisig/rpy') {
        return 'Authorize agent';
    }
    if (request.route === '/multisig/ixn') {
        return 'Approve interaction';
    }
    return 'Approve rotation';
};
