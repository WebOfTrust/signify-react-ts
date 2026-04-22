import {
    Box,
    Chip,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '../../state/hooks';
import { selectOperationRecords } from '../../state/selectors';

export const OperationsView = () => {
    const operations = [...useAppSelector(selectOperationRecords)].reverse();

    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h5" component="h1">
                Operations
            </Typography>
            {operations.length === 0 ? (
                <Typography color="text.secondary">
                    No operations have run in this browser session.
                </Typography>
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
                                        <Chip
                                            size="small"
                                            label={operation.status}
                                            color={
                                                operation.status === 'error'
                                                    ? 'error'
                                                    : operation.status ===
                                                        'success'
                                                      ? 'success'
                                                      : 'default'
                                            }
                                        />
                                    </Stack>
                                }
                                secondary={`${operation.kind} | ${operation.phase}`}
                            />
                        </ListItemButton>
                    ))}
                </List>
            )}
        </Box>
    );
};
