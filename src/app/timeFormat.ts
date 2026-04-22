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
