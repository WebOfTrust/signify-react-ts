import { useEffect } from 'react';
import {
    closestHoverSoundTarget,
    enteredFromInsideTarget,
    hasFineHoverPointer,
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

        const unlockAudio = () => {
            void uiSoundEngine.unlock();
        };

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

        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio);
        document.addEventListener('pointerover', playHoverSound, {
            passive: true,
        });

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            document.removeEventListener('pointerover', playHoverSound);
        };
    }, [muted]);

    return null;
};
