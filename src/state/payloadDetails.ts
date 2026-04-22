/** Payload detail type for meaningful workflow artifacts. */
export type PayloadDetailKind = 'oobi' | 'aid' | 'url' | 'text';

/** Serializable, copyable payload surfaced on operations and notifications. */
export interface PayloadDetailRecord {
    id: string;
    label: string;
    value: string;
    displayValue?: string;
    kind: PayloadDetailKind;
    copyable: boolean;
}
