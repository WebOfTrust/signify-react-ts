import { Stack } from '@mui/material';
import type { KeyState } from 'signify-ts';
import { ConsolePanel, TelemetryRow } from '../../app/Console';
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
    <ConsolePanel title={text} eyebrow="Key state" sx={{ height: '100%' }}>
        <Stack spacing={0.25}>
            {Object.entries(data).map(([key, value]) =>
                typeof value === 'string' ? (
                    <TelemetryRow
                        key={key}
                        label={keyStateFieldDescriptions[key]?.title ?? key}
                        value={value}
                        mono
                    />
                ) : null
            )}
        </Stack>
    </ConsolePanel>
);
