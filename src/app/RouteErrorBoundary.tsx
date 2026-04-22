import { Box, Typography } from '@mui/material';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ConsolePanel, StatusPill } from './Console';
import { toError } from '../signify/client';

/**
 * Props for the shared route-level unexpected-error boundary.
 */
export interface RouteErrorBoundaryProps {
    /** Route-specific heading shown above the normalized error message. */
    title: string;
}

/**
 * Convert the values React Router may expose through `useRouteError` into text.
 */
const routeErrorMessage = (error: unknown): string => {
    if (isRouteErrorResponse(error)) {
        return `${error.status} ${error.statusText}`;
    }

    return toError(error).message;
};

/**
 * Shared route-level error boundary presentation.
 *
 * Route loaders and actions should return typed recoverable errors where the
 * user can continue. Throwing is reserved for unexpected failures that should
 * land here with enough detail for maintainers to triage.
 */
export const RouteErrorBoundary = ({ title }: RouteErrorBoundaryProps) => {
    const error = useRouteError();

    return (
        <Box sx={{ maxWidth: 820 }}>
            <ConsolePanel
                title={title}
                eyebrow="Route failure"
                actions={<StatusPill label="error" tone="error" />}
            >
                <Typography color="error">
                    {routeErrorMessage(error)}
                </Typography>
            </ConsolePanel>
        </Box>
    );
};
