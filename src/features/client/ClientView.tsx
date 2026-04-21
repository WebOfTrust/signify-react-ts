import { Box, Grid, Typography } from '@mui/material';
import type { SignifyStateSummary } from '../../signify/client';
import { AidCard } from './AidCard';

/**
 * Props for the connected client summary route.
 */
export interface ClientViewProps {
    summary: SignifyStateSummary;
}

/**
 * Connected client state view.
 *
 * This route projects the normalized Signify state summary into stable smoke
 * selectors and raw AID cards. It should not fetch state itself; refreshing
 * connected state belongs to the Signify hook boundary.
 */
export const ClientView = ({ summary }: ClientViewProps) => {
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
