import type { ContactRecord } from '../../domain/contacts/contactTypes';
import type { NotificationRecord } from '../../state/notifications.slice';

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type JsonRecord = Record<string, unknown>;

export interface KeriaNoteAttrs extends JsonRecord {
    r?: unknown;
    d?: unknown;
    m?: unknown;
}

export interface KeriaNoteItem extends JsonRecord {
    i?: unknown;
    dt?: unknown;
    r?: unknown;
    d?: unknown;
    a?: unknown;
}

export type KeriaNotificationListResponse =
    | readonly KeriaNoteItem[]
    | { notes?: readonly KeriaNoteItem[] };

export interface ParsedKeriaNote {
    id: string;
    dt: string | null;
    read: boolean;
    attrs: KeriaNoteAttrs;
    anchorSaid: string | null;
}

export interface KeriaExchange extends JsonRecord {
    exn: JsonRecord;
}

export const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

export const requireRecord = (
    value: unknown,
    label: string
): JsonRecord => {
    if (!isRecord(value)) {
        throw new Error(`${label} is missing or malformed.`);
    }

    return value;
};

export const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.flatMap((item) => {
              const text = stringValue(item);
              return text === null ? [] : [text];
          })
        : [];

export const numberValue = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const aidSet = (aids: readonly string[]): ReadonlySet<string> =>
    new Set(aids.map((aid) => aid.trim()).filter((aid) => aid.length > 0));

export const contactForAid = (
    contacts: readonly ContactRecord[],
    aid: string
): ContactRecord | null =>
    contacts.find((contact) => contact.aid === aid || contact.id === aid) ??
    null;

export interface NotificationResponseProjection {
    notifications: NotificationRecord[];
    noteAttrsById: ReadonlyMap<string, KeriaNoteAttrs>;
}

const noteAttrs = (value: unknown): KeriaNoteAttrs =>
    isRecord(value) ? value : {};

/**
 * Parse KERIA's loose notification response at the Signify boundary.
 * Malformed notes are dropped before projection or protocol hydration.
 */
export const parseKeriaNotificationResponse = (
    response: unknown
): ParsedKeriaNote[] => {
    const items = Array.isArray(response)
        ? response
        : isRecord(response) && Array.isArray(response.notes)
          ? response.notes
          : [];

    return items.flatMap((item) => {
        if (!isRecord(item)) {
            return [];
        }

        const id = stringValue(item.i);
        if (id === null) {
            return [];
        }

        const attrs = noteAttrs(item.a);
        const dt = stringValue(item.dt);
        const read = item.r === true;
        const anchorSaid = stringValue(attrs.d) ?? stringValue(item.d);

        return [
            {
                id,
                dt,
                read,
                anchorSaid,
                attrs,
            } satisfies ParsedKeriaNote,
        ];
    });
};

/**
 * Project parsed KERIA notes into serializable app records plus local-only
 * attrs needed by protocol hydrators.
 */
export const notificationResponseProjectionFromNotes = (
    notes: readonly ParsedKeriaNote[],
    loadedAt: string
): NotificationResponseProjection => {
    const noteAttrsById = new Map<string, KeriaNoteAttrs>();

    const notifications = notes.map((note) => {
        noteAttrsById.set(note.id, note.attrs);

        return {
            id: note.id,
            dt: note.dt,
            read: note.read,
            route: stringValue(note.attrs.r) ?? 'unknown',
            anchorSaid: note.anchorSaid,
            status: note.read ? 'processed' : 'unread',
            message: stringValue(note.attrs.m),
            challengeRequest: null,
            credentialGrant: null,
            credentialAdmit: null,
            w3cVcGrant: null,
            delegationRequest: null,
            updatedAt: note.dt ?? loadedAt,
        } satisfies NotificationRecord;
    });

    return {
        notifications,
        noteAttrsById,
    };
};

/**
 * Project KERIA's loose notification response into serializable app records
 * plus local-only note attrs needed by protocol hydrators.
 */
export const notificationResponseProjectionFromResponse = (
    response: unknown,
    loadedAt: string
): NotificationResponseProjection =>
    notificationResponseProjectionFromNotes(
        parseKeriaNotificationResponse(response),
        loadedAt
    );

/**
 * Project KERIA's loose notification response into serializable app records.
 */
export const notificationRecordsFromResponse = (
    response: unknown,
    loadedAt: string
): NotificationRecord[] =>
    notificationResponseProjectionFromResponse(response, loadedAt).notifications;

export const exchangeExn = (exchange: unknown): JsonRecord => {
    if (!isRecord(exchange) || !isRecord(exchange.exn)) {
        throw new Error(
            'Challenge request notification did not include an EXN.'
        );
    }

    return exchange.exn;
};

export const exchangeRoute = (exchange: unknown): string | null =>
    stringValue(exchangeExn(exchange).r);

export const exchangeSaid = (exchange: unknown): string | null =>
    stringValue(exchangeExn(exchange).d);

export const exchangeRecipientAid = (exchange: unknown): string | null => {
    const exn = exchangeExn(exchange);
    const attrs = isRecord(exn.a) ? exn.a : {};

    return stringValue(exn.rp) ?? stringValue(attrs.i);
};

export const exchangeGroupAid = (exchange: unknown): string | null => {
    const exn = exchangeExn(exchange);
    const attrs = isRecord(exn.a) ? exn.a : {};
    return stringValue(attrs.gid);
};

export const exchangeSenderAid = (exchange: unknown): string | null =>
    stringValue(exchangeExn(exchange).i);
