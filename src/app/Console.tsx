import type { ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ButtonProps, SxProps, Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { clickablePanelSx, monoValueSx } from './consoleStyles';
import { UI_SOUND_HOVER_VALUE } from './uiSound';

/**
 * Standard page title block for routed feature screens.
 */
export interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    summary?: string;
    actions?: ReactNode;
}

/**
 * Render a responsive feature page heading with optional command actions.
 */
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

/**
 * Shared dark-panel container for route sections and clickable summaries.
 */
export interface ConsolePanelProps {
    children: ReactNode;
    title?: string;
    eyebrow?: string;
    actions?: ReactNode;
    sx?: SxProps<Theme>;
    to?: string;
    testId?: string;
}

/**
 * Render a command-console panel, optionally as a route link.
 */
export const ConsolePanel = ({
    children,
    title,
    eyebrow,
    actions,
    sx,
    to,
    testId,
}: ConsolePanelProps) => (
    <Box
        component={to === undefined ? 'section' : RouterLink}
        to={to}
        data-testid={testId}
        data-ui-sound={to === undefined ? undefined : UI_SOUND_HOVER_VALUE}
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
            ...(to === undefined ? [] : [clickablePanelSx]),
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

/**
 * Compact empty-state message with an optional primary action.
 */
export interface EmptyStateProps {
    title: string;
    message: string;
    action?: ReactNode;
}

/**
 * Render an empty state that fits inside pages without nested-card styling.
 */
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

/**
 * Label/tone pair for compact operational status chips.
 */
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

/**
 * Render a fixed-height status chip for tables, cards, and headers.
 */
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

/**
 * Label/value row for diagnostics and KERI key-state telemetry.
 */
export interface TelemetryRowProps {
    label: string;
    value: ReactNode;
    mono?: boolean;
}

/**
 * Render a responsive telemetry row with optional monospace value styling.
 */
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

/**
 * Primary command button wired into the delegated UI sound layer.
 */
export const CommandButton = (props: ButtonProps) => (
    <Button
        variant="contained"
        color="primary"
        data-ui-sound={UI_SOUND_HOVER_VALUE}
        {...props}
    />
);
