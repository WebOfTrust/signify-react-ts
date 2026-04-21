import { Box, Typography } from '@mui/material';

/**
 * Blocked-state view for routes that need a connected Signify client.
 *
 * Routes render this instead of redirecting or opening the dialog automatically;
 * direct URL navigation should be passive until the user chooses to connect.
 */
export const ConnectionRequired = () => (
    <Box sx={{ p: 3 }} data-testid="connection-required">
        <Typography>Connect to KERIA before opening this view.</Typography>
    </Box>
);
