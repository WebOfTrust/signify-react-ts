import { Box, Grid, Typography } from '@mui/material';
import { useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import type { ClientLoaderData } from '../../app/routeData';
import { AidCard } from './AidCard';

/**
 * Connected client state view.
 *
 * This route projects the normalized Signify state summary into stable smoke
 * selectors and raw AID cards. Refreshing connected state belongs to the route
 * loader, not component effects.
 */
export const ClientView = () => {
    const loaderData = useLoaderData() as ClientLoaderData;

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const { summary } = loaderData;
    const agent = summary.state.agent;
    const controller = summary.state.controller.state;

    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Box data-testid="client-summary">
                <Typography
                    data-testid="controller-aid"
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    Controller AID: {summary.controllerPre}
                </Typography>
                <Typography
                    data-testid="agent-aid"
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    Agent AID: {summary.agentPre}
                </Typography>
            </Box>
            <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <AidCard data={agent} text="Agent" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <AidCard data={controller} text="Controller" />
                </Grid>
            </Grid>
        </Box>
    );
};
