/**
 * Human description for a KERI key-state field.
 */
export interface KeyStateFieldDescription {
    title: string;
    description: string;
    notes: string;
}

/**
 * Display labels for raw agent/controller key-state maps.
 *
 * This is presentational metadata only. It should not become a parser or
 * validator for KERI events.
 */
export const keyStateFieldDescriptions: Record<
    string,
    KeyStateFieldDescription
> = {
    v: {
        title: 'Version String',
        description: '',
        notes: '',
    },
    i: {
        title: 'Identifier Prefix (AID)',
        description: '',
        notes: '',
    },
    s: {
        title: 'Sequence Number',
        description: '',
        notes: '',
    },
    et: {
        title: 'Message Type',
        description: '',
        notes: '',
    },
    te: {
        title: 'Last received Event Message Type in a Key State Notice',
        description: '',
        notes: '',
    },
    d: {
        title: 'Event SAID',
        description: '',
        notes: '',
    },
    p: {
        title: 'Prior Event SAID',
        description: '',
        notes: '',
    },
    kt: {
        title: 'Keys Signing Threshold',
        description: '',
        notes: '',
    },
    k: {
        title: 'List of Signing Keys (ordered key set)',
        description: '',
        notes: '',
    },
    nt: {
        title: 'Next Keys Signing Threshold',
        description: '',
        notes: '',
    },
    n: {
        title: 'List of Next Key Digests (ordered key digest set)',
        description: '',
        notes: '',
    },
    bt: {
        title: 'Backer Threshold',
        description: '',
        notes: '',
    },
    b: {
        title: 'List of Backers (ordered backer set of AIDs)',
        description: '',
        notes: '',
    },
    br: {
        title: 'List of Backers to Remove (ordered backer set of AIDs)',
        description: '',
        notes: '',
    },
    ba: {
        title: 'List of Backers to Add (ordered backer set of AIDs)',
        description: '',
        notes: '',
    },
    c: {
        title: 'List of Configuration Traits/Modes',
        description: '',
        notes: '',
    },
    a: {
        title: 'List of Anchors (seals)',
        description: '',
        notes: '',
    },
    di: {
        title: 'Delegator Identifier Prefix (AID)',
        description: '',
        notes: '',
    },
    rd: {
        title: 'Merkle Tree Root Digest (SAID)',
        description: '',
        notes: '',
    },
    ee: {
        title: 'Last Establishment Event Map',
        description: '',
        notes: '',
    },
    vn: {
        title: "Version Number ('major.minor')",
        description: '',
        notes: '',
    },
    dt: {
        title: 'Datetime of the SAID',
        description: '',
        notes: '',
    },
    f: {
        title: 'Number of first seen ordinal',
        description: '',
        notes: '',
    },
};
