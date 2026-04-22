import {
    Box,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState, PageHeader, StatusPill } from '../../app/Console';
import { formatOperationWindow } from '../../app/timeFormat';
import { useAppSelector } from '../../state/hooks';
import { selectOperationRecords } from '../../state/selectors';

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

export const OperationsView = () => {
    const operations = [...useAppSelector(selectOperationRecords)].reverse();

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Activity"
                title="Operations"
                summary="Foreground and background KERIA work launched from this browser session."
            />
            {operations.length === 0 ? (
                <EmptyState
                    title="No operation records"
                    message="Identifier, credential, schema, and contact workflows will appear here once launched."
                />
            ) : (
                <List disablePadding>
                    {operations.map((operation) => (
                        <ListItemButton
                            key={operation.requestId}
                            component={RouterLink}
                            to={operation.operationRoute}
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                mb: 1,
                                alignItems: 'flex-start',
                                bgcolor: 'background.paper',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'action.hover',
                                },
                            }}
                        >
                            <ListItemText
                                primary={
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        sx={{
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Typography component="span">
                                            {operation.title}
                                        </Typography>
                                        <StatusPill
                                            label={operation.status}
                                            tone={operationTone(
                                                operation.status
                                            )}
                                        />
                                    </Stack>
                                }
                                secondary={
                                    <Stack spacing={0.25}>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {operation.kind} | {operation.phase}
                                        </Typography>
                                        {formatOperationWindow(operation) !==
                                            null && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {formatOperationWindow(
                                                    operation
                                                )}
                                            </Typography>
                                        )}
                                    </Stack>
                                }
                            />
                        </ListItemButton>
                    ))}
                </List>
            )}
        </Box>
    );
};
