import { Box, Button, Link, Stack } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
    ConsolePanel,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import { useAppSelector } from '../../state/hooks';
import { selectOperationById } from '../../state/selectors';

const DetailRow = ({
    label,
    value,
}: {
    label: string;
    value: string | null;
}) => <TelemetryRow label={label} value={value ?? 'None'} mono />;

const operationTone = (status: string) => {
    if (status === 'error') {
        return 'error' as const;
    }

    if (status === 'success') {
        return 'success' as const;
    }

    if (status === 'running') {
        return 'warning' as const;
    }

    return 'neutral' as const;
};

export const OperationDetailView = () => {
    const { requestId = '' } = useParams();
    const operation = useAppSelector(selectOperationById(requestId));

    if (operation === null) {
        return (
            <Box sx={{ display: 'grid', gap: 2 }}>
                <PageHeader
                    eyebrow="Activity"
                    title="Operation Not Found"
                    summary="The requested operation record is not available in this browser session."
                />
                <Button
                    component={RouterLink}
                    to="/operations"
                    variant="outlined"
                >
                    Back to Operations
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'grid', gap: 2.5, maxWidth: 980 }}>
            <PageHeader
                eyebrow="Operation detail"
                title={operation.title}
                summary={operation.description ?? undefined}
                actions={
                    <StatusPill
                        label={operation.status}
                        tone={operationTone(operation.status)}
                    />
                }
            />
            <ConsolePanel title="Telemetry" eyebrow={operation.kind}>
                <DetailRow label="Request ID" value={operation.requestId} />
                <DetailRow label="Kind" value={operation.kind} />
                <DetailRow label="Phase" value={operation.phase} />
                <DetailRow label="Started" value={operation.startedAt} />
                <DetailRow label="Finished" value={operation.finishedAt} />
                <DetailRow
                    label="KERIA operation"
                    value={operation.keriaOperationName}
                />
                <DetailRow label="Error" value={operation.error} />
                <DetailRow
                    label="Canceled reason"
                    value={operation.canceledReason}
                />
                <DetailRow
                    label="Resource keys"
                    value={
                        operation.resourceKeys.length > 0
                            ? operation.resourceKeys.join(', ')
                            : null
                    }
                />
            </ConsolePanel>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                    component={RouterLink}
                    to="/operations"
                    variant="outlined"
                >
                    All Operations
                </Button>
                {operation.resultRoute && (
                    <Button
                        component={RouterLink}
                        to={operation.resultRoute.path}
                        variant="contained"
                    >
                        {operation.resultRoute.label}
                    </Button>
                )}
                {operation.notificationId && (
                    <Link
                        component={RouterLink}
                        to="/notifications"
                        sx={{ alignSelf: 'center' }}
                    >
                        View notification
                    </Link>
                )}
            </Stack>
        </Box>
    );
};
