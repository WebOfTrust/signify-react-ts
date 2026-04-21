import { Box, Typography } from '@mui/material';
import { useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import type { CredentialsLoaderData } from '../../app/routeData';

/**
 * Placeholder credentials route.
 *
 * The route loader gates this placeholder behind a connected Signify client so
 * the future issuer/holder credential workflow can replace this component
 * without changing route semantics.
 */
export const CredentialsView = () => {
    const loaderData = useLoaderData() as CredentialsLoaderData;

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    return (
        <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography variant="h5" component="h1">
                Credentials
            </Typography>
            <Typography color="text.secondary">
                Credential workflow placeholder
            </Typography>
        </Box>
    );
};
