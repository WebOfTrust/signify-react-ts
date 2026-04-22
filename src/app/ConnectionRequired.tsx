import { Box, Typography } from '@mui/material';
import { ConsolePanel, StatusPill } from './Console';

/**
 * Blocked-state view for routes that need a connected Signify client.
 *
 * Routes render this instead of redirecting or opening the dialog automatically;
 * direct URL navigation should be passive until the user chooses to connect.
 */
export const ConnectionRequired = () => (
    <Box sx={{ maxWidth: 720 }} data-testid="connection-required">
        <ConsolePanel
            title="KERIA connection required"
            eyebrow="Access gate"
            actions={<StatusPill label="offline" tone="error" />}
        >
            <Typography color="text.secondary">
                Connect to KERIA before opening this view.
            </Typography>
        </ConsolePanel>
    </Box>
);
