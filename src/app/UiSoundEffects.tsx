import { useEffect } from 'react';
import {
    closestClickSoundTarget,
    closestHoverSoundTarget,
    enteredFromInsideTarget,
    hasFineHoverPointer,
    shouldPlayClickSound,
    shouldPlayHoverSound,
    uiSoundEngine,
} from './uiSound';
import { useAppSelector } from '../state/hooks';
import { selectHoverSoundMuted } from '../state/selectors';

export const UiSoundEffects = () => {
    const muted = useAppSelector(selectHoverSoundMuted);

    useEffect(() => {
        uiSoundEngine.setMuted(muted);
    }, [muted]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        let lastPlayedAtMs: number | null = null;
        let lastClickedAtMs: number | null = null;

        const playHoverSound = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse') {
                return;
            }

            const target = closestHoverSoundTarget(event.target);
            const targetAvailable = target !== null;
            const movedWithinTarget =
                target !== null &&
                enteredFromInsideTarget(target, event.relatedTarget);
            const nowMs = window.performance.now();

            if (
                !shouldPlayHoverSound({
                    muted,
                    finePointer: hasFineHoverPointer(window),
                    documentVisible: document.visibilityState !== 'hidden',
                    targetAvailable,
                    enteredFromInsideTarget: movedWithinTarget,
                    nowMs,
                    lastPlayedAtMs,
                })
            ) {
                return;
            }

            lastPlayedAtMs = nowMs;
            uiSoundEngine.playHover();
        };

        const playClickSound = (event: Event) => {
            const target = closestClickSoundTarget(event.target);
            const nowMs = window.performance.now();

            if (
                !shouldPlayClickSound({
                    muted,
                    documentVisible: document.visibilityState !== 'hidden',
                    targetAvailable: target !== null,
                    nowMs,
                    lastPlayedAtMs: lastClickedAtMs,
                })
            ) {
                return;
            }

            lastClickedAtMs = nowMs;
            void uiSoundEngine.playClick();
        };

        const playPointerClickSound = (event: PointerEvent) => {
            playClickSound(event);
        };

        const playKeyboardClickSound = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            playClickSound(event);
        };

        document.addEventListener('pointerdown', playPointerClickSound, {
            capture: true,
            passive: true,
        });
        document.addEventListener('keydown', playKeyboardClickSound, true);
        document.addEventListener('pointerover', playHoverSound, {
            passive: true,
        });

        return () => {
            document.removeEventListener(
                'pointerdown',
                playPointerClickSound,
                true
            );
            document.removeEventListener(
                'keydown',
                playKeyboardClickSound,
                true
            );
            document.removeEventListener('pointerover', playHoverSound);
        };
    }, [muted]);

    return null;
};
