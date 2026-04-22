/**
 * Data attribute value that opts an element into hover sound feedback.
 */
export const UI_SOUND_HOVER_VALUE = 'hover';

/**
 * Selector used by delegated pointerover handling for explicit hover targets.
 */
export const UI_SOUND_HOVER_SELECTOR = `[data-ui-sound="${UI_SOUND_HOVER_VALUE}"]`;

/**
 * Delegated click target selector for native controls and explicit sound zones.
 */
export const UI_SOUND_CLICK_SELECTOR = [
    UI_SOUND_HOVER_SELECTOR,
    'a[href]',
    'button',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="tab"]',
    'summary',
    'input[type="button"]',
    'input[type="submit"]',
].join(',');

/**
 * Minimum hover spacing to avoid audio chatter while moving across dense UI.
 */
export const HOVER_SOUND_MIN_INTERVAL_MS = 90;

/**
 * Minimum click spacing to avoid duplicate sounds from bubbling controls.
 */
export const CLICK_SOUND_MIN_INTERVAL_MS = 120;

/**
 * Pure facts used to decide whether delegated hover audio should play.
 */
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

/**
 * Pure facts used to decide whether delegated click audio should play.
 */
export interface ClickSoundGateFacts {
    muted: boolean;
    documentVisible: boolean;
    targetAvailable: boolean;
    nowMs: number;
    lastPlayedAtMs: number | null;
    minIntervalMs?: number;
}

/** Constructor alias for standard and WebKit-prefixed audio contexts. */
type AudioContextConstructor = new () => AudioContext;

/** Safari compatibility surface for the prefixed Web Audio constructor. */
interface WebKitAudioWindow extends Window {
    webkitAudioContext?: AudioContextConstructor;
}

/**
 * Decide hover playback without touching the DOM or Web Audio state.
 */
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

/**
 * Decide click playback without touching the DOM or Web Audio state.
 */
export const shouldPlayClickSound = ({
    muted,
    documentVisible,
    targetAvailable,
    nowMs,
    lastPlayedAtMs,
    minIntervalMs = CLICK_SOUND_MIN_INTERVAL_MS,
}: ClickSoundGateFacts): boolean => {
    if (muted || !documentVisible || !targetAvailable) {
        return false;
    }

    return (
        lastPlayedAtMs === null || nowMs - lastPlayedAtMs >= minIntervalMs
    );
};

/**
 * Return whether this browser input setup supports intentional hover feedback.
 */
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

/**
 * Find the nearest enabled explicit hover-sound target for a delegated event.
 */
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

/**
 * Find the nearest enabled clickable sound target for a delegated event.
 */
export const closestClickSoundTarget = (
    target: EventTarget | null
): HTMLElement | null => {
    if (!isElement(target)) {
        return null;
    }

    const candidate = target.closest(UI_SOUND_CLICK_SELECTOR);
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

/**
 * Filter pointerover events that move within the same target.
 */
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

/**
 * Browser-local sound synthesizer for short UI feedback tones.
 *
 * This class owns Web Audio state outside React/Redux. Redux stores only the
 * mute preference; audio context handles stay here because they are
 * nonserializable browser capabilities and must respect autoplay unlock rules.
 */
export class UiSoundEngine {
    /** Lazily created browser audio context after user interaction. */
    private context: AudioContext | null = null;

    /** Runtime mute gate mirrored from persisted UI preferences. */
    private muted = false;

    /** Whether autoplay policy has allowed the context to run. */
    private activated = false;

    /** Update the runtime mute gate without touching Web Audio state. */
    setMuted(muted: boolean): void {
        this.muted = muted;
    }

    /** Resume audio after a user gesture so later hover sounds can play. */
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

    /** Play the short hover cue when gating has already accepted the event. */
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

    /** Play the longer click cue, resuming the context from the click gesture. */
    async playClick(): Promise<void> {
        if (this.muted) {
            return;
        }

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

        if (!this.activated || context.state !== 'running') {
            return;
        }

        const now = context.currentTime;
        const output = context.createGain();
        output.gain.setValueAtTime(0.0001, now);
        output.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
        output.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        output.connect(context.destination);

        this.scheduleClickBody(context, output, now);
        this.scheduleClickLatch(context, output, now + 0.052);
        this.scheduleClickTransient(context, output, now);

        globalThis.setTimeout(() => {
            output.disconnect();
        }, 340);
    }

    /** Create or reuse the browser audio context, returning null if blocked. */
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

    /** Schedule the low hover tone body. */
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

    /** Schedule the hover overtone that gives the cue its terminal character. */
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

    /** Schedule the brief filtered-noise attack for the hover cue. */
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

    /** Schedule the low click body tone. */
    private scheduleClickBody(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(118, now);
        oscillator.frequency.exponentialRampToValueAtTime(78, now + 0.24);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(540, now);
        filter.frequency.exponentialRampToValueAtTime(240, now + 0.22);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.95, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        oscillator.start(now);
        oscillator.stop(now + 0.275);
    }

    /** Schedule the delayed latch overtone for click confirmation. */
    private scheduleClickLatch(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(236, now);
        oscillator.frequency.exponentialRampToValueAtTime(170, now + 0.11);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(360, now);
        filter.Q.setValueAtTime(2.2, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.28, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }

    /** Schedule the filtered-noise attack for the click cue. */
    private scheduleClickTransient(
        context: AudioContext,
        destination: AudioNode,
        now: number
    ): void {
        const durationSeconds = 0.042;
        const sampleCount = Math.max(
            1,
            Math.floor(context.sampleRate * durationSeconds)
        );
        const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
        const samples = buffer.getChannelData(0);

        for (let index = 0; index < sampleCount; index += 1) {
            const envelope = 1 - index / sampleCount;
            samples[index] = (Math.random() * 2 - 1) * envelope ** 3;
        }

        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(520, now);
        filter.Q.setValueAtTime(4.6, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.046);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        source.start(now);
        source.stop(now + durationSeconds);
    }
}

/**
 * Shared browser sound engine instance used by the delegated React effect.
 */
export const uiSoundEngine = new UiSoundEngine();
