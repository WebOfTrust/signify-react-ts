import type { ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ButtonProps, SxProps, Theme } from '@mui/material';
import { monoValueSx } from './consoleStyles';

export interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    summary?: string;
    actions?: ReactNode;
}

export const PageHeader = ({
    eyebrow,
    title,
    summary,
    actions,
}: PageHeaderProps) => (
    <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
            alignItems: { xs: 'stretch', md: 'flex-end' },
            justifyContent: 'space-between',
            minWidth: 0,
        }}
    >
        <Box sx={{ minWidth: 0 }}>
            {eyebrow && (
                <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{
                        display: 'block',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}
                >
                    {eyebrow}
                </Typography>
            )}
            <Typography variant="h4" component="h1">
                {title}
            </Typography>
            {summary && (
                <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5, maxWidth: 760, overflowWrap: 'anywhere' }}
                >
                    {summary}
                </Typography>
            )}
        </Box>
        {actions && <Box sx={{ flex: '0 0 auto' }}>{actions}</Box>}
    </Stack>
);

export interface ConsolePanelProps {
    children: ReactNode;
    title?: string;
    eyebrow?: string;
    actions?: ReactNode;
    sx?: SxProps<Theme>;
}

export const ConsolePanel = ({
    children,
    title,
    eyebrow,
    actions,
    sx,
}: ConsolePanelProps) => (
    <Box
        sx={[
            {
                position: 'relative',
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: '0 18px 42px rgba(0, 0, 0, 0.2)',
                '&:before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    borderTop: '1px solid rgba(118, 232, 255, 0.16)',
                },
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
    >
        {(title || eyebrow || actions) && (
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    borderBottom: 1,
                    borderColor: 'divider',
                    px: 2,
                    py: 1.5,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    {eyebrow && (
                        <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        >
                            {eyebrow}
                        </Typography>
                    )}
                    {title && (
                        <Typography
                            variant="h6"
                            sx={{ overflowWrap: 'anywhere' }}
                        >
                            {title}
                        </Typography>
                    )}
                </Box>
                {actions}
            </Stack>
        )}
        <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
);

export interface EmptyStateProps {
    title: string;
    message: string;
    action?: ReactNode;
}

export const EmptyState = ({ title, message, action }: EmptyStateProps) => (
    <Box
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'rgba(13, 23, 34, 0.72)',
            px: { xs: 2, sm: 3 },
            py: { xs: 3, sm: 4 },
            textAlign: { xs: 'left', sm: 'center' },
        }}
    >
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {message}
        </Typography>
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
);

export interface StatusPillProps {
    label: string;
    tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

const statusColors = {
    neutral: { borderColor: 'divider', color: 'text.secondary' },
    success: { borderColor: 'success.main', color: 'success.main' },
    warning: { borderColor: 'warning.main', color: 'warning.main' },
    error: { borderColor: 'error.main', color: 'error.main' },
    info: { borderColor: 'primary.main', color: 'primary.main' },
} as const;

export const StatusPill = ({ label, tone = 'neutral' }: StatusPillProps) => (
    <Box
        component="span"
        sx={{
            ...statusColors[tone],
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 24,
            border: 1,
            borderRadius: 1,
            px: 1,
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
        }}
    >
        {label}
    </Box>
);

export interface TelemetryRowProps {
    label: string;
    value: ReactNode;
    mono?: boolean;
}

export const TelemetryRow = ({
    label,
    value,
    mono = false,
}: TelemetryRowProps) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(160px, 0.32fr) 1fr' },
            gap: { xs: 0.25, sm: 1.5 },
            alignItems: 'baseline',
            borderBottom: 1,
            borderColor: 'divider',
            py: 1,
            '&:last-child': {
                borderBottom: 0,
            },
        }}
    >
        <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 700 }}
        >
            {label}
        </Typography>
        <Typography
            variant="body2"
            sx={{
                ...(mono ? monoValueSx : {}),
                minWidth: 0,
                color: 'text.primary',
            }}
        >
            {value}
        </Typography>
    </Box>
);

export const CommandButton = (props: ButtonProps) => (
    <Button variant="contained" color="primary" {...props} />
);
