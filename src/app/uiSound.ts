export const UI_SOUND_HOVER_VALUE = 'hover';
export const UI_SOUND_HOVER_SELECTOR = `[data-ui-sound="${UI_SOUND_HOVER_VALUE}"]`;
export const HOVER_SOUND_MIN_INTERVAL_MS = 90;

export interface HoverSoundGateFacts {
    muted: boolean;
    finePointer: boolean;
    documentVisible: boolean;
    targetAvailable: boolean;
    enteredFromInsideTarget: boolean;
    nowMs: number;
    lastPlayedAtMs: number | null;
    minIntervalMs?: number;
}

type AudioContextConstructor = new () => AudioContext;

interface WebKitAudioWindow extends Window {
    webkitAudioContext?: AudioContextConstructor;
}

export const shouldPlayHoverSound = ({
    muted,
    finePointer,
    documentVisible,
    targetAvailable,
    enteredFromInsideTarget,
    nowMs,
    lastPlayedAtMs,
    minIntervalMs = HOVER_SOUND_MIN_INTERVAL_MS,
}: HoverSoundGateFacts): boolean => {
    if (
        muted ||
        !finePointer ||
        !documentVisible ||
        !targetAvailable ||
        enteredFromInsideTarget
    ) {
        return false;
    }

    return (
        lastPlayedAtMs === null || nowMs - lastPlayedAtMs >= minIntervalMs
    );
};

export const hasFineHoverPointer = (
    targetWindow: Pick<Window, 'matchMedia'> | undefined =
        typeof window === 'undefined' ? undefined : window
): boolean => {
    if (targetWindow === undefined) {
        return false;
    }

    if (typeof targetWindow.matchMedia !== 'function') {
        return true;
    }

    return (
        targetWindow.matchMedia('(pointer: fine)').matches &&
        targetWindow.matchMedia('(hover: hover)').matches
    );
};

const isElement = (target: EventTarget | null): target is Element =>
    typeof Element !== 'undefined' && target instanceof Element;

const isHTMLElement = (target: Element | null): target is HTMLElement =>
    typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;

export const closestHoverSoundTarget = (
    target: EventTarget | null
): HTMLElement | null => {
    if (!isElement(target)) {
        return null;
    }

    const candidate = target.closest(UI_SOUND_HOVER_SELECTOR);
    if (!isHTMLElement(candidate)) {
        return null;
    }

    if (
        candidate.closest(
            '[hidden], [aria-hidden="true"], [disabled], [aria-disabled="true"]'
        ) !== null
    ) {
        return null;
    }

    return candidate;
};

export const enteredFromInsideTarget = (
    target: HTMLElement,
    relatedTarget: EventTarget | null
): boolean => {
    if (typeof Node === 'undefined' || !(relatedTarget instanceof Node)) {
        return false;
    }

    return target.contains(relatedTarget);
};

const getAudioContextConstructor = (): AudioContextConstructor | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return (
        window.AudioContext ??
        (window as WebKitAudioWindow).webkitAudioContext ??
        null
    );
};

export class UiSoundEngine {
    private context: AudioContext | null = null;

    private muted = false;

    private activated = false;

    setMuted(muted: boolean): void {
        this.muted = muted;
    }

    async unlock(): Promise<void> {
        const context = this.ensureContext();
        if (context === null) {
            return;
        }

        try {
            if (context.state === 'suspended') {
                await context.resume();
            }
            this.activated = context.state === 'running';
        } catch {
            this.activated = false;
        }
    }

    playHover(): void {
        if (this.muted || !this.activated) {
            return;
        }

        const context = this.ensureContext();
        if (context === null || context.state !== 'running') {
            return;
        }

        const now = context.currentTime;
        const output = context.createGain();
        output.gain.setValueAtTime(0.0001, now);
        output.gain.exponentialRampToValueAtTime(0.13, now + 0.004);
        output.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        output.connect(context.destination);

        this.scheduleBody(context, output, now);
        this.scheduleOvertone(context, output, now);
        this.scheduleTransient(context, output, now);

        globalThis.setTimeout(() => {
            output.disconnect();
        }, 180);
    }

    private ensureContext(): AudioContext | null {
        if (this.context !== null) {
            return this.context;
        }

        const AudioConstructor = getAudioContextConstructor();
        if (AudioConstructor === null) {
            return null;
        }

        try {
            this.context = new AudioConstructor();
            return this.context;
        } catch {
            return null;
        }
    }

    private scheduleBody(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(132, now);
        oscillator.frequency.exponentialRampToValueAtTime(96, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.88, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);

        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(now);
        oscillator.stop(now + 0.135);
    }

    private scheduleOvertone(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(255, now);
        oscillator.frequency.exponentialRampToValueAtTime(182, now + 0.08);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(820, now);
        filter.frequency.exponentialRampToValueAtTime(420, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }

    private scheduleTransient(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const durationSeconds = 0.024;
        const sampleCount = Math.max(
            1,
            Math.floor(context.sampleRate * durationSeconds)
        );
        const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
        const samples = buffer.getChannelData(0);

        for (let index = 0; index < sampleCount; index += 1) {
            const envelope = 1 - index / sampleCount;
            samples[index] = (Math.random() * 2 - 1) * envelope * envelope;
        }

        const source = context.createBufferSource();
        const bandpass = context.createBiquadFilter();
        const gain = context.createGain();

        source.buffer = buffer;
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(640, now);
        bandpass.Q.setValueAtTime(3.8, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

        source.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(destination);
        source.start(now);
        source.stop(now + durationSeconds);
    }
}

export const uiSoundEngine = new UiSoundEngine();
