import { Box, Grid, Stack, Typography } from '@mui/material';
import { useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { ConsolePanel, PageHeader, StatusPill } from '../../app/Console';
import type { CredentialsLoaderData } from '../../app/routeData';

const roleCards = [
    {
        role: 'Issuer',
        state: 'Prepare',
        tone: 'info' as const,
        summary:
            'Create registry, issue SEDI voter credential, grant to holder.',
        steps: ['Registry', 'Credential draft', 'IPEX grant'],
    },
    {
        role: 'Holder',
        state: 'Receive',
        tone: 'warning' as const,
        summary: 'Resolve issuer, admit credential grant, present to verifier.',
        steps: ['Issuer OOBI', 'Grant admit', 'Presentation'],
    },
    {
        role: 'Verifier',
        state: 'Validate',
        tone: 'success' as const,
        summary: 'Trust issuer/schema, validate presentation, emit result.',
        steps: ['Trusted issuer', 'TEL state', 'Webhook event'],
    },
];

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
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Credential mission"
                title="Issuer / Holder / Verifier"
                summary="The credential flow is staged by role so the demo keeps issuance, possession, presentation, and verification responsibilities explicit."
            />
            <Grid container spacing={2}>
                {roleCards.map((card) => (
                    <Grid size={{ xs: 12, md: 4 }} key={card.role}>
                        <ConsolePanel
                            title={card.role}
                            eyebrow="Role"
                            actions={
                                <StatusPill
                                    label={card.state}
                                    tone={card.tone}
                                />
                            }
                            sx={{ height: '100%' }}
                        >
                            <Stack spacing={1.5}>
                                <Typography color="text.secondary">
                                    {card.summary}
                                </Typography>
                                <Stack spacing={1}>
                                    {card.steps.map((step, index) => (
                                        <Box
                                            key={step}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                border: 1,
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                px: 1.25,
                                                py: 1,
                                                bgcolor:
                                                    index === 0
                                                        ? 'action.selected'
                                                        : 'rgba(5, 9, 13, 0.4)',
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                color="primary.main"
                                                sx={{
                                                    minWidth: 22,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {index + 1}
                                            </Typography>
                                            <Typography>{step}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Stack>
                        </ConsolePanel>
                    </Grid>
                ))}
            </Grid>
            <ConsolePanel
                title="Next credential build target"
                eyebrow="Workflow"
            >
                <Typography color="text.secondary">
                    Replace this mission board with live schema resolution,
                    registry creation, issuer grant, holder admit, holder
                    presentation, and verifier result panels as those operations
                    land behind the runtime workflow boundary.
                </Typography>
            </ConsolePanel>
        </Box>
    );
};
