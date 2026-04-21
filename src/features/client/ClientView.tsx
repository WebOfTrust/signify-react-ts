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
    const agent = (summary.state.agent ?? {}) as Record<string, unknown>;
    const controller = (summary.state.controller?.state ?? {}) as Record<
        string,
        unknown
    >;

    return (
        <>
            <Box sx={{ p: 2 }} data-testid="client-summary">
                <Typography data-testid="controller-aid">
                    Controller AID: {summary.controllerPre}
                </Typography>
                <Typography data-testid="agent-aid">
                    Agent AID: {summary.agentPre}
                </Typography>
            </Box>
            <Grid container>
                <AidCard data={agent} text="Agent" />
                <AidCard data={controller} text="Controller" />
            </Grid>
        </>
    );
};
