import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import type { PendingSource } from './pendingState';

export interface LoadingOverlayProps {
    active: boolean;
    label: string;
    source: PendingSource | null;
}

/**
 * Global dimmer for route and Signify/KERIA async work.
 */
export const LoadingOverlay = ({
    active,
    label,
    source,
}: LoadingOverlayProps) => {
    if (!active) {
        return null;
    }

    return (
        <Backdrop
            open
            data-testid="app-loading-overlay"
            data-pending-source={source ?? undefined}
            sx={(theme) => ({
                zIndex: theme.zIndex.modal + 2,
                color: 'common.white',
                bgcolor: 'rgba(0, 0, 0, 0.48)',
                px: 2,
            })}
        >
            <Box
                role="status"
                aria-live="polite"
                sx={{
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 2,
                    width: 'min(100%, 280px)',
                    px: 3,
                    py: 2.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 6,
                    textAlign: 'center',
                }}
            >
                <CircularProgress aria-hidden="true" />
                <Typography
                    variant="body1"
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    {label}
                </Typography>
            </Box>
        </Backdrop>
    );
};
