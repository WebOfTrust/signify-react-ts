import { Box, Grid, Stack } from '@mui/material';
import { useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { ConsolePanel, PageHeader, TelemetryRow } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
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
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Diagnostics"
                title="Client Console"
                summary="Controller and agent key-state telemetry for the connected Signify session."
            />
            <ConsolePanel title="Session identity" eyebrow="Connected client">
                <Stack spacing={0.25} data-testid="client-summary">
                    <TelemetryRow
                        label="Controller AID"
                        value={
                            <Box
                                component="span"
                                data-testid="controller-aid"
                                sx={monoValueSx}
                            >
                                {summary.controllerPre}
                            </Box>
                        }
                    />
                    <TelemetryRow
                        label="Agent AID"
                        value={
                            <Box
                                component="span"
                                data-testid="agent-aid"
                                sx={monoValueSx}
                            >
                                {summary.agentPre}
                            </Box>
                        }
                    />
                </Stack>
            </ConsolePanel>
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
