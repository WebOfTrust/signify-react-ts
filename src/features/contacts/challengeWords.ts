/** Supported BIP39 challenge strengths exposed by KERIA. */
export type ChallengeStrength = 128 | 256;

/** Parse pasted challenge text into normalized words. */
export const parseChallengeWords = (value: string): string[] =>
    value
        .trim()
        .split(/\s+/u)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0);

/** User-facing validation for challenge word lists. */
export const validateChallengeWords = (
    words: readonly string[]
): string | null => {
    if (words.length === 0) {
        return 'Challenge words are required.';
    }

    if (words.length !== 12 && words.length !== 24) {
        return 'Challenge must contain 12 or 24 words.';
    }

    return null;
};

/** Validate and return normalized words, throwing for workflow boundaries. */
export const requireChallengeWords = (value: string): string[] => {
    const words = parseChallengeWords(value);
    const error = validateChallengeWords(words);
    if (error !== null) {
        throw new Error(error);
    }

    return words;
};

/**
 * Stable non-secret fingerprint for challenge words.
 *
 * This is used only for local matching and operation conflict keys so raw
 * challenge phrases do not leak into persisted operation records.
 */
export const challengeWordsFingerprint = (words: readonly string[]): string => {
    let hash = 0x811c9dc5;
    const text = words.join(' ');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
};

/** Default user-facing challenge strength: 12 mnemonic words. */
export const defaultChallengeStrength: ChallengeStrength = 128;
