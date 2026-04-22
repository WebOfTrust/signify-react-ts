import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import type { PendingSource } from './pendingState';

/**
 * Derived foreground-pending state for the global loading dimmer.
 */
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
                color: 'text.primary',
                bgcolor: 'rgba(0, 0, 0, 0.72)',
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
                    border: 1,
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow:
                        '0 20px 56px rgba(0, 0, 0, 0.54), 0 0 28px rgba(39, 215, 255, 0.12)',
                    textAlign: 'center',
                }}
            >
                <CircularProgress aria-hidden="true" color="primary" />
                <Typography variant="body1" sx={{ overflowWrap: 'anywhere' }}>
                    {label}
                </Typography>
            </Box>
        </Backdrop>
    );
};
