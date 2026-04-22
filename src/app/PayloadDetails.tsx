import { Box, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { monoValueSx } from './consoleStyles';
import type { PayloadDetailRecord } from '../state/payloadDetails';

const abbreviate = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) {
        return value;
    }

    const edgeLength = Math.max(8, Math.floor((maxLength - 3) / 2));
    return `${value.slice(0, edgeLength)}...${value.slice(-edgeLength)}`;
};

const copyValue = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

/**
 * Copyable operation/notification payload details exposed to users.
 */
export interface PayloadDetailsProps {
    details: readonly PayloadDetailRecord[];
    dense?: boolean;
    maxLength?: number;
}

/**
 * Render meaningful operation/notification payloads as compact copy targets.
 */
export const PayloadDetails = ({
    details,
    dense = false,
    maxLength = dense ? 52 : 84,
}: PayloadDetailsProps) => {
    if (details.length === 0) {
        return null;
    }

    return (
        <Stack spacing={dense ? 0.5 : 0.75} sx={{ mt: dense ? 0.75 : 1 }}>
            {details.map((detail) => (
                <Tooltip
                    key={detail.id}
                    title={
                        detail.copyable
                            ? `Copy ${detail.label}`
                            : (detail.displayValue ?? detail.value)
                    }
                >
                    <Box
                        component="span"
                        role={detail.copyable ? 'button' : undefined}
                        tabIndex={detail.copyable ? 0 : undefined}
                        onClick={(event) => {
                            if (!detail.copyable) {
                                return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            copyValue(detail.value);
                        }}
                        onKeyDown={(event) => {
                            if (
                                !detail.copyable ||
                                (event.key !== 'Enter' && event.key !== ' ')
                            ) {
                                return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            copyValue(detail.value);
                        }}
                        data-testid="payload-detail"
                        data-payload-kind={detail.kind}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                            alignItems: 'center',
                            gap: 0.75,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            px: dense ? 0.75 : 1,
                            py: dense ? 0.5 : 0.75,
                            bgcolor: 'rgba(39, 215, 255, 0.06)',
                            cursor: detail.copyable ? 'copy' : 'default',
                            minWidth: 0,
                        }}
                    >
                        <Typography
                            component="span"
                            variant="caption"
                            color="primary.main"
                            sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        >
                            {detail.label}
                        </Typography>
                        <Typography
                            component="span"
                            variant={dense ? 'caption' : 'body2'}
                            color="text.primary"
                            sx={{
                                ...monoValueSx,
                                minWidth: 0,
                            }}
                        >
                            {abbreviate(
                                detail.displayValue ?? detail.value,
                                maxLength
                            )}
                        </Typography>
                        {detail.copyable && (
                            <ContentCopyIcon
                                fontSize="small"
                                sx={{ color: 'text.secondary' }}
                            />
                        )}
                    </Box>
                </Tooltip>
            ))}
        </Stack>
    );
};
