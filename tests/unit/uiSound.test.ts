import { describe, expect, it } from 'vitest';
import {
    hasFineHoverPointer,
    shouldPlayClickSound,
    shouldPlayHoverSound,
} from '../../src/app/uiSound';

const playableFacts = {
    muted: false,
    finePointer: true,
    documentVisible: true,
    targetAvailable: true,
    enteredFromInsideTarget: false,
    nowMs: 200,
    lastPlayedAtMs: null,
};

describe('UI hover sound helpers', () => {
    it('allows a primary hover target when the UI is unmuted', () => {
        expect(shouldPlayHoverSound(playableFacts)).toBe(true);
    });

    it('blocks muted, hidden, unavailable, nested, coarse, and throttled hovers', () => {
        expect(
            shouldPlayHoverSound({ ...playableFacts, muted: true })
        ).toBe(false);
        expect(
            shouldPlayHoverSound({ ...playableFacts, documentVisible: false })
        ).toBe(false);
        expect(
            shouldPlayHoverSound({ ...playableFacts, targetAvailable: false })
        ).toBe(false);
        expect(
            shouldPlayHoverSound({
                ...playableFacts,
                enteredFromInsideTarget: true,
            })
        ).toBe(false);
        expect(
            shouldPlayHoverSound({ ...playableFacts, finePointer: false })
        ).toBe(false);
        expect(
            shouldPlayHoverSound({
                ...playableFacts,
                nowMs: 240,
                lastPlayedAtMs: 200,
            })
        ).toBe(false);
    });

    it('detects fine hover pointers from matchMedia', () => {
        const fineWindow = {
            matchMedia: (query: string) => ({
                matches:
                    query === '(pointer: fine)' || query === '(hover: hover)',
            }),
        };
        const coarseWindow = {
            matchMedia: (query: string) => ({
                matches: query !== '(pointer: fine)',
            }),
        };

        expect(hasFineHoverPointer(fineWindow)).toBe(true);
        expect(hasFineHoverPointer(coarseWindow)).toBe(false);
    });

    it('allows and throttles click sounds for primary targets', () => {
        const clickableFacts = {
            muted: false,
            documentVisible: true,
            targetAvailable: true,
            nowMs: 500,
            lastPlayedAtMs: null,
        };

        expect(shouldPlayClickSound(clickableFacts)).toBe(true);
        expect(
            shouldPlayClickSound({ ...clickableFacts, muted: true })
        ).toBe(false);
        expect(
            shouldPlayClickSound({
                ...clickableFacts,
                documentVisible: false,
            })
        ).toBe(false);
        expect(
            shouldPlayClickSound({
                ...clickableFacts,
                targetAvailable: false,
            })
        ).toBe(false);
        expect(
            shouldPlayClickSound({
                ...clickableFacts,
                nowMs: 560,
                lastPlayedAtMs: 500,
            })
        ).toBe(false);
    });
});
