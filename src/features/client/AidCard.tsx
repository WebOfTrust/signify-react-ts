import { Card, CardContent, Divider, Grid, Typography } from '@mui/material';
import type { KeyState } from 'signify-ts';
import { keyStateFieldDescriptions } from './keyStateFieldDescriptions';

/**
 * Props for one raw AID/key-state summary card.
 */
export interface AidCardProps {
    data: KeyState;
    text: string;
}

/**
 * Presentational card for agent/controller key-state string fields.
 *
 * Keep this intentionally dumb: it displays known field labels and falls back
 * to the raw key. State extraction belongs in `ClientView`.
 */
export const AidCard = ({ data, text }: AidCardProps) => (
    <Card sx={{ maxWidth: 545, marginX: 4 }}>
        <CardContent>
            <Typography variant="h6" component="div" gutterBottom>
                {text}
            </Typography>
            <Divider />
            <Grid container spacing={2}>
                {Object.entries(data).map(([key, value]) =>
                    typeof value === 'string' ? (
                        <Grid size={12} key={key}>
                            <Typography
                                variant="subtitle1"
                                gutterBottom
                                align="left"
                            >
                                <strong>
                                    {keyStateFieldDescriptions[key]?.title ??
                                        key}
                                </strong>{' '}
                                {value}
                            </Typography>
                        </Grid>
                    ) : null
                )}
            </Grid>
        </CardContent>
    </Card>
);
