import type { Contact } from 'signify-ts';
import type {
    ContactEndpoint,
    ContactEndpointRole,
    ContactRecord,
    ContactWellKnown,
} from '../../state/contacts.slice';
import type { ChallengeRecord } from '../../state/challenges.slice';
import type { IdentifierSummary } from '../identifiers/identifierTypes';
import { challengeWordsFingerprint } from './challengeWords';

/**
 * KERIA endpoint roles the app preserves from contact `ends` records.
 */
export const CONTACT_ENDPOINT_ROLES = [
    'agent',
    'controller',
    'witness',
    'registrar',
    'watcher',
    'judge',
    'juror',
    'peer',
    'mailbox',
] as const satisfies readonly ContactEndpointRole[];

/**
 * OOBI roles the UI can request for a local managed identifier.
 */
export type OobiGenerationRole = 'agent' | 'witness';

/**
 * Contact challenge state used by shield icon presentation.
 */
export type ContactChallengeDisplayStatus =
    | 'verified'
    | 'pending'
    | 'unverified';

/**
 * Compact role summary rendered on contact cards.
 */
export interface ContactOobiRoleSummary {
    primaryRole: ContactEndpointRole | null;
    roles: ContactEndpointRole[];
    label: string;
}

/**
 * Human-readable challenge trust summary for a contact.
 */
export interface ContactChallengeStatusSummary {
    status: ContactChallengeDisplayStatus;
    label: string;
    tooltip: string;
}

/**
 * Group of copyable OOBI URLs for one contact detail role.
 */
export interface ContactOobiGroup {
    role: ContactEndpointRole;
    label: string;
    oobis: string[];
}

const CONTACT_ENDPOINT_ROLE_SET = new Set<string>(CONTACT_ENDPOINT_ROLES);
const CONTACT_OOBI_DETAIL_ROLES = [
    'agent',
    'witness',
    'mailbox',
    'controller',
] as const satisfies readonly ContactEndpointRole[];
const CONTACT_OOBI_DETAIL_ROLE_SET = new Set<ContactEndpointRole>(
    CONTACT_OOBI_DETAIL_ROLES
);

const roleLabels: Record<ContactEndpointRole, string> = {
    agent: 'Agent',
    controller: 'Controller',
    witness: 'Witness',
    registrar: 'Registrar',
    watcher: 'Watcher',
    judge: 'Judge',
    juror: 'Juror',
    peer: 'Peer',
    mailbox: 'Mailbox',
};

const normalizeEndpointRole = (
    role: string | null
): ContactEndpointRole | null =>
    role !== null && CONTACT_ENDPOINT_ROLE_SET.has(role)
        ? (role as ContactEndpointRole)
        : null;

const pushUniqueRole = (
    roles: ContactEndpointRole[],
    role: ContactEndpointRole | null
): void => {
    if (role !== null && !roles.includes(role)) {
        roles.push(role);
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value : null;

const endpointScheme = (url: string): string => {
    try {
        return new URL(url).protocol.replace(':', '') || 'unknown';
    } catch {
        return 'unknown';
    }
};

const endpointRoleRecords = (
    role: ContactEndpointRole,
    value: unknown
): ContactEndpoint[] => {
    if (!isRecord(value)) {
        return [];
    }

    return Object.entries(value).flatMap(([eid, rawEndpoint]) => {
        const directUrl = stringValue(rawEndpoint);
        if (directUrl !== null) {
            return [
                {
                    role,
                    eid,
                    scheme: endpointScheme(directUrl),
                    url: directUrl,
                },
            ];
        }

        if (!isRecord(rawEndpoint)) {
            return [];
        }

        return Object.entries(rawEndpoint).flatMap(([scheme, rawUrl]) => {
            const url = stringValue(rawUrl);
            if (url === null) {
                return [];
            }

            return [
                {
                    role,
                    eid,
                    scheme,
                    url,
                },
            ];
        });
    });
};

const webBaseUrl = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }

        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return null;
    }
};

const endpointOobiUrl = (
    contact: ContactRecord,
    endpoint: ContactEndpoint
): string | null => {
    const baseUrl = webBaseUrl(endpoint.url);
    if (baseUrl === null) {
        return null;
    }

    const contactAid = contact.aid ?? contact.id;
    switch (endpoint.role) {
        case 'agent':
            return `${baseUrl}/oobi/${contactAid}/agent/${endpoint.eid}`;
        case 'witness':
            return `${baseUrl}/oobi/${endpoint.eid}/controller?tag=witness`;
        case 'controller':
            return `${baseUrl}/oobi/${endpoint.eid}/controller`;
        case 'mailbox':
            return `${baseUrl}/oobi/${contactAid}/mailbox/${endpoint.eid}`;
        default:
            return null;
    }
};

/**
 * Extract a useful alias from an OOBI URL query string when one is present.
 */
export const aliasFromOobi = (oobi: string): string | null => {
    try {
        return stringValue(new URL(oobi).searchParams.get('name'));
    } catch {
        return null;
    }
};

/**
 * Extract the resolved AID from common KERIA OOBI URL paths.
 */
export const aidFromOobi = (oobi: string | null | undefined): string | null => {
    if (oobi === null || oobi === undefined || oobi.trim().length === 0) {
        return null;
    }

    try {
        const url = new URL(oobi);
        const parts = url.pathname.split('/').filter(Boolean);
        const oobiIndex = parts.indexOf('oobi');
        return oobiIndex >= 0 ? stringValue(parts[oobiIndex + 1]) : null;
    } catch {
        return null;
    }
};

/**
 * Remove app-local alias hints before handing an OOBI to KERIA.
 */
export const normalizeOobiUrlForResolution = (oobi: string): string => {
    const trimmed = oobi.trim();
    try {
        const url = new URL(trimmed);
        url.searchParams.delete('name');
        return url.toString();
    } catch {
        return trimmed;
    }
};

/**
 * Prefer a user-entered alias, then the OOBI `name` query hint.
 */
export const aliasForOobiResolution = (
    oobi: string,
    alias: string | null | undefined
): string | null => {
    const trimmedAlias = stringValue(alias);
    return trimmedAlias ?? aliasFromOobi(oobi);
};

/**
 * Stable placeholder id used while KERIA resolution is still in flight.
 */
export const pendingContactIdForOobi = (
    oobi: string,
    alias: string | null | undefined
): string => `pending:${aliasForOobiResolution(oobi, alias) ?? oobi.trim()}`;

/**
 * Extract likely component tags from KERIA OOBI URLs.
 */
export const componentTagsFromOobi = (
    oobi: string | null | undefined
): string[] => {
    if (oobi === null || oobi === undefined || oobi.trim().length === 0) {
        return [];
    }

    try {
        const url = new URL(oobi);
        const tags = new Set<string>();
        const queryTag = stringValue(url.searchParams.get('tag'));
        const queryRole = stringValue(url.searchParams.get('role'));
        if (queryTag !== null) {
            tags.add(queryTag);
        }
        if (queryRole !== null) {
            tags.add(queryRole);
        }

        const parts = url.pathname.split('/').filter(Boolean);
        const oobiIndex = parts.indexOf('oobi');
        const role = oobiIndex >= 0 ? parts[oobiIndex + 2] : null;
        if (role !== null && role !== undefined) {
            tags.add(role);
        }

        return [...tags];
    } catch {
        return [];
    }
};

/**
 * Extract endpoint-role candidates from an OOBI, preserving source priority.
 *
 * Query tags are more semantically useful for witness/controller OOBIs: local
 * witness URLs commonly use `/controller?role=witness`, where the role label
 * users care about is "Witness" rather than "Controller".
 */
export const endpointRolesFromOobi = (
    oobi: string | null | undefined
): ContactEndpointRole[] => {
    if (oobi === null || oobi === undefined || oobi.trim().length === 0) {
        return [];
    }

    try {
        const url = new URL(oobi);
        const roles: ContactEndpointRole[] = [];
        pushUniqueRole(
            roles,
            normalizeEndpointRole(stringValue(url.searchParams.get('tag')))
        );
        pushUniqueRole(
            roles,
            normalizeEndpointRole(stringValue(url.searchParams.get('role')))
        );

        const parts = url.pathname.split('/').filter(Boolean);
        const oobiIndex = parts.indexOf('oobi');
        const pathRole =
            oobiIndex >= 0 ? stringValue(parts[oobiIndex + 2]) : null;
        pushUniqueRole(roles, normalizeEndpointRole(pathRole));

        return roles;
    } catch {
        return [];
    }
};

/**
 * Extract only explicit role metadata from OOBI query hints.
 *
 * This is intentionally narrower than `endpointRolesFromOobi`: a regular
 * witnessed identifier can carry `ends.witness` records, but that does not make
 * the contact itself a witness component.
 */
export const explicitOobiMetadataRoles = (
    oobi: string | null | undefined
): ContactEndpointRole[] => {
    if (oobi === null || oobi === undefined || oobi.trim().length === 0) {
        return [];
    }

    try {
        const url = new URL(oobi);
        const roles: ContactEndpointRole[] = [];
        pushUniqueRole(
            roles,
            normalizeEndpointRole(stringValue(url.searchParams.get('tag')))
        );
        pushUniqueRole(
            roles,
            normalizeEndpointRole(stringValue(url.searchParams.get('role')))
        );
        return roles;
    } catch {
        return [];
    }
};

/**
 * Group full OOBI URLs by role for the contact detail view.
 */
export const contactOobiGroups = (
    contact: ContactRecord
): ContactOobiGroup[] => {
    const groups = new Map<ContactEndpointRole, Set<string>>();
    const addOobi = (role: ContactEndpointRole | null, oobi: string | null) => {
        if (
            role === null ||
            oobi === null ||
            !CONTACT_OOBI_DETAIL_ROLE_SET.has(role)
        ) {
            return;
        }

        const existing = groups.get(role) ?? new Set<string>();
        existing.add(oobi);
        groups.set(role, existing);
    };

    if (contact.oobi !== null) {
        const sourceRoles = explicitOobiMetadataRoles(contact.oobi);
        const roles =
            sourceRoles.length > 0
                ? sourceRoles
                : endpointRolesFromOobi(contact.oobi);
        for (const role of roles) {
            addOobi(role, contact.oobi);
        }
    }

    for (const endpoint of contact.endpoints) {
        addOobi(endpoint.role, endpointOobiUrl(contact, endpoint));
    }

    return CONTACT_OOBI_DETAIL_ROLES.flatMap((role) => {
        const oobis = [...(groups.get(role) ?? [])];
        return oobis.length === 0
            ? []
            : [
                  {
                      role,
                      label: `${roleLabels[role]} OOBI`,
                      oobis,
                  },
              ];
    });
};

/**
 * Keep long OOBIs and AIDs recognizable without letting them dominate cards.
 */
export const abbreviateMiddle = (value: string, maxLength = 56): string => {
    if (value.length <= maxLength) {
        return value;
    }

    const edgeLength = Math.max(8, Math.floor((maxLength - 3) / 2));
    return `${value.slice(0, edgeLength)}...${value.slice(-edgeLength)}`;
};

/**
 * Summarize the most relevant OOBI/endpoint role for compact contact cards.
 */
export const contactOobiRoleSummary = (
    contact: ContactRecord
): ContactOobiRoleSummary => {
    const roles: ContactEndpointRole[] = [];
    for (const role of endpointRolesFromOobi(contact.oobi)) {
        pushUniqueRole(roles, role);
    }
    for (const endpoint of contact.endpoints) {
        pushUniqueRole(roles, endpoint.role);
    }
    for (const tag of contact.componentTags) {
        pushUniqueRole(roles, normalizeEndpointRole(tag));
    }

    const primaryRole = roles[0] ?? null;
    if (primaryRole === null) {
        return {
            primaryRole,
            roles,
            label: 'Unknown OOBI',
        };
    }

    const extraCount = roles.length - 1;
    return {
        primaryRole,
        roles,
        label: `${roleLabels[primaryRole]} OOBI${extraCount > 0 ? ` +${extraCount}` : ''}`,
    };
};

/**
 * Witness records are useful, but they should not crowd the main contact list.
 */
export const isWitnessContact = (contact: ContactRecord): boolean =>
    explicitOobiMetadataRoles(contact.oobi).includes('witness');

/**
 * Shield state for compact contact cards and contact detail headers.
 */
export const contactChallengeStatus = (
    contact: ContactRecord
): ContactChallengeStatusSummary => {
    if (contact.authenticatedChallengeCount > 0) {
        return {
            status: 'verified',
            label: 'Verified',
            tooltip: `${contact.authenticatedChallengeCount} authenticated challenge${contact.authenticatedChallengeCount === 1 ? '' : 's'}`,
        };
    }

    if (contact.challengeCount > 0) {
        return {
            status: 'pending',
            label: 'Challenge pending',
            tooltip: `${contact.challengeCount} challenge response${contact.challengeCount === 1 ? '' : 's'} known, none authenticated`,
        };
    }

    return {
        status: 'unverified',
        label: 'Unverified',
        tooltip: 'No authenticated challenge is known for this contact',
    };
};

/**
 * Available local OOBI generation roles for a managed identifier.
 */
export const identifierAvailableOobiRoles = (
    identifier: IdentifierSummary | null | undefined
): OobiGenerationRole[] => {
    if (identifier === null || identifier === undefined) {
        return [];
    }

    const witnessBackers = (identifier as { state?: { b?: unknown } }).state?.b;
    const hasWitnessBackers =
        Array.isArray(witnessBackers) &&
        witnessBackers.some((backer) => typeof backer === 'string');
    const hasWitnessIndexes =
        Array.isArray(identifier.windexes) && identifier.windexes.length > 0;

    return hasWitnessBackers || hasWitnessIndexes
        ? ['agent', 'witness']
        : ['agent'];
};

const normalizeWellKnowns = (contact: Contact): ContactWellKnown[] =>
    (contact.wellKnowns ?? []).flatMap((item) => {
        const url = stringValue(item.url);
        const dt = stringValue(item.dt);
        if (url === null || dt === null) {
            return [];
        }

        return [{ url, dt }];
    });

const normalizeEndpoints = (contact: Contact): ContactEndpoint[] =>
    CONTACT_ENDPOINT_ROLES.flatMap((role) =>
        endpointRoleRecords(role, contact.ends?.[role])
    );

/**
 * Project KERIA's loose contact shape into serializable app state.
 */
export const contactRecordFromKeriaContact = (
    contact: Contact,
    updatedAt: string
): ContactRecord => {
    const alias = stringValue(contact.alias) ?? contact.id;
    const oobi = stringValue(contact.oobi);
    const challenges = contact.challenges ?? [];

    return {
        id: contact.id,
        alias,
        aid: contact.id,
        oobi,
        endpoints: normalizeEndpoints(contact),
        wellKnowns: normalizeWellKnowns(contact),
        componentTags: componentTagsFromOobi(oobi),
        challengeCount: challenges.length,
        authenticatedChallengeCount: challenges.filter(
            (challenge) => challenge.authenticated === true
        ).length,
        resolutionStatus: 'resolved',
        error: null,
        updatedAt,
    };
};

/**
 * Convert contact challenge arrays into read-only dashboard challenge records.
 */
export const challengeRecordsFromKeriaContacts = (
    contacts: Contact[],
    updatedAt: string
): ChallengeRecord[] =>
    contacts.flatMap((contact) =>
        (contact.challenges ?? []).map((challenge, index) => {
            const said = stringValue(challenge.said);
            const authenticated = challenge.authenticated === true;
            const updated = stringValue(challenge.dt) ?? updatedAt;
            return {
                id: `${contact.id}:${said ?? index.toString()}`,
                source: 'keria',
                direction: 'received',
                role: stringValue(contact.alias) ?? contact.id,
                counterpartyAid: contact.id,
                words: challenge.words,
                wordsHash: challengeWordsFingerprint(challenge.words),
                responseSaid: said,
                authenticated,
                status: authenticated ? 'verified' : 'responded',
                result: said,
                error: null,
                verifiedAt: authenticated ? updated : null,
                updatedAt: updated,
            };
        })
    );

/**
 * Dashboard/component table projection derived from contact metadata.
 */
export interface KnownComponentRecord {
    id: string;
    contactId: string;
    alias: string;
    role: string;
    eid: string | null;
    scheme: string | null;
    url: string | null;
    source: 'endpoint' | 'oobi';
}

/**
 * Derive witness/watcher/mailbox/etc. records from contact endpoints and OOBIs.
 */
export const knownComponentsFromContacts = (
    contacts: readonly ContactRecord[]
): KnownComponentRecord[] =>
    contacts.flatMap((contact) => {
        const endpointComponents = contact.endpoints.map((endpoint) => ({
            id: `${contact.id}:endpoint:${endpoint.role}:${endpoint.eid}`,
            contactId: contact.id,
            alias: contact.alias,
            role: endpoint.role,
            eid: endpoint.eid,
            scheme: endpoint.scheme,
            url: endpoint.url,
            source: 'endpoint' as const,
        }));

        const tagComponents = contact.componentTags.map((tag) => ({
            id: `${contact.id}:oobi:${tag}`,
            contactId: contact.id,
            alias: contact.alias,
            role: tag,
            eid: contact.aid,
            scheme: null,
            url: contact.oobi,
            source: 'oobi' as const,
        }));

        return [...endpointComponents, ...tagComponents];
    });
