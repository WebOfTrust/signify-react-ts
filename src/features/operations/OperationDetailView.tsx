import {
    Box,
    Button,
    Chip,
    Divider,
    Link,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAppSelector } from '../../state/hooks';
import { selectOperationById } from '../../state/selectors';

const DetailRow = ({ label, value }: { label: string; value: string | null }) => (
    <Box>
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Typography sx={{ overflowWrap: 'anywhere' }}>
            {value ?? 'None'}
        </Typography>
    </Box>
);

export const OperationDetailView = () => {
    const { requestId = '' } = useParams();
    const operation = useAppSelector(selectOperationById(requestId));

    if (operation === null) {
        return (
            <Box sx={{ display: 'grid', gap: 2 }}>
                <Typography variant="h5" component="h1">
                    Operation Not Found
                </Typography>
                <Button component={RouterLink} to="/operations" variant="outlined">
                    Back to Operations
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'grid', gap: 2, maxWidth: 900 }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
            >
                <Typography variant="h5" component="h1">
                    {operation.title}
                </Typography>
                <Chip label={operation.status} />
            </Stack>
            {operation.description && (
                <Typography color="text.secondary">
                    {operation.description}
                </Typography>
            )}
            <Divider />
            <Stack spacing={1.5}>
                <DetailRow label="Request ID" value={operation.requestId} />
                <DetailRow label="Kind" value={operation.kind} />
                <DetailRow label="Phase" value={operation.phase} />
                <DetailRow label="Started" value={operation.startedAt} />
                <DetailRow label="Finished" value={operation.finishedAt} />
                <DetailRow label="KERIA operation" value={operation.keriaOperationName} />
                <DetailRow label="Error" value={operation.error} />
                <DetailRow label="Canceled reason" value={operation.canceledReason} />
                <DetailRow
                    label="Resource keys"
                    value={
                        operation.resourceKeys.length > 0
                            ? operation.resourceKeys.join(', ')
                            : null
                    }
                />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button component={RouterLink} to="/operations" variant="outlined">
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
