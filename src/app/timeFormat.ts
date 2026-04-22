/**
 * Format ISO-ish timestamps for display while preserving invalid raw values.
 */
export const formatTimestamp = (
    value: string | null | undefined
): string | null => {
    if (value === null || value === undefined || value.trim().length === 0) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
};

/**
 * Format an operation start/end pair for detail and history views.
 */
export const formatOperationWindow = ({
    startedAt,
    finishedAt,
}: {
    startedAt: string | null | undefined;
    finishedAt?: string | null;
}): string | null => {
    const started = formatTimestamp(startedAt);
    const finished = formatTimestamp(finishedAt);

    if (started === null) {
        return null;
    }

    return finished === null
        ? `Started ${started}`
        : `Started ${started} | Ended ${finished}`;
};
