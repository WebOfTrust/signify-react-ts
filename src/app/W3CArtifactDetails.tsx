import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Stack,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { decodeJwt } from '../integrations/signifyW3c';
import type { ReactNode } from 'react';
import { monoValueSx } from './consoleStyles';
import { TelemetryRow } from './Console';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const stringArrayText = (value: unknown): string | null => {
    if (Array.isArray(value)) {
        const items = value.flatMap((item) => {
            const text = stringValue(item);
            return text === null ? [] : [text];
        });
        return items.length === 0 ? null : items.join(', ');
    }

    return stringValue(value);
};

const jsonText = (value: unknown): string => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const copyValue = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

const JsonCodeBlock = ({ value }: { value: string }) => (
    <Box
        component="pre"
        sx={{
            m: 0,
            maxHeight: '52dvh',
            overflow: 'auto',
            p: 2,
            borderRadius: 1,
            bgcolor: 'background.default',
            color: 'text.primary',
            fontFamily: 'var(--app-mono-font)',
            fontSize: '0.8125rem',
            lineHeight: 1.55,
            whiteSpace: 'pre',
        }}
    >
        {value}
    </Box>
);

const CopyButton = ({ value, label }: { value: string; label: string }) => (
    <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopyIcon />}
        onClick={() => copyValue(value)}
    >
        Copy {label}
    </Button>
);

const DetailAccordion = ({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) => (
    <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        </AccordionSummary>
        <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
);

const nestedVcJwtTokens = (payload: Record<string, unknown>): string[] => {
    const vp = isRecord(payload.vp) ? payload.vp : null;
    const credentials = Array.isArray(vp?.verifiableCredential)
        ? vp.verifiableCredential
        : [];

    return credentials.flatMap((credential) => {
        const token = stringValue(credential);
        return token === null ? [] : [token];
    });
};

const jwtSummaryRows = (
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    nestedCount: number
): Array<[string, string]> => {
    const vc = isRecord(payload.vc) ? payload.vc : null;
    const vp = isRecord(payload.vp) ? payload.vp : null;
    return [
        ['alg', stringValue(header.alg) ?? 'Not available'],
        ['kid', stringValue(header.kid) ?? 'Not available'],
        ['iss', stringValue(payload.iss) ?? 'Not available'],
        ['sub', stringValue(payload.sub) ?? 'Not available'],
        ['jti', stringValue(payload.jti) ?? 'Not available'],
        ['aud', stringValue(payload.aud) ?? 'Not available'],
        ['nonce', stringValue(payload.nonce) ?? 'Not available'],
        [
            'credential type',
            vc === null
                ? 'Not available'
                : (stringArrayText(vc.type) ?? 'Not available'),
        ],
        [
            'presentation type',
            vp === null
                ? 'Not available'
                : (stringArrayText(vp.type) ?? 'Not available'),
        ],
        ['nested VC-JWTs', String(nestedCount)],
    ];
};

/**
 * Decode and render a compact W3C JWT for local inspection. This component does
 * not verify signatures.
 */
export const W3CJwtArtifactDetails = ({
    token,
    label,
    level = 0,
}: {
    token: string;
    label: string;
    level?: number;
}) => {
    const segments = token.split('.');
    const decodedResult:
        | {
              ok: true;
              header: Record<string, unknown>;
              payload: Record<string, unknown>;
              nested: string[];
              summaryRows: Array<[string, string]>;
          }
        | { ok: false; message: string } = (() => {
        try {
            const decoded = decodeJwt(token);
            const header = decoded.header;
            const payload = decoded.payload;
            const nested = level >= 2 ? [] : nestedVcJwtTokens(payload);
            return {
                ok: true,
                header,
                payload,
                nested,
                summaryRows: jwtSummaryRows(header, payload, nested.length),
            };
        } catch (error) {
            return {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Unable to decode JWT.',
            };
        }
    })();

    if (!decodedResult.ok) {
        return (
            <Stack spacing={1} data-testid="w3c-jwt-artifact-invalid">
                <Alert severity="warning">{decodedResult.message}</Alert>
                <DetailAccordion title="Raw compact token">
                    <Stack spacing={1}>
                        <Typography
                            component="pre"
                            sx={{
                                ...monoValueSx,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                m: 0,
                            }}
                        >
                            {token}
                        </Typography>
                        <CopyButton value={token} label="token" />
                    </Stack>
                </DetailAccordion>
            </Stack>
        );
    }

    const { header, payload, nested, summaryRows } = decodedResult;

    return (
        <Stack spacing={1.25} data-testid="w3c-jwt-artifact">
            <Typography variant="subtitle2">{label}</Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                    },
                    gap: 0.75,
                }}
            >
                {summaryRows.map(([rowLabel, value]) => (
                    <TelemetryRow
                        key={rowLabel}
                        label={rowLabel}
                        value={value}
                        mono={
                            rowLabel === 'kid' ||
                            rowLabel === 'iss' ||
                            rowLabel === 'sub' ||
                            rowLabel === 'jti' ||
                            rowLabel === 'aud' ||
                            rowLabel === 'nonce'
                        }
                    />
                ))}
            </Box>
            <DetailAccordion title="JOSE header">
                <Stack spacing={1}>
                    <JsonCodeBlock value={jsonText(header)} />
                    <CopyButton value={jsonText(header)} label="header" />
                </Stack>
            </DetailAccordion>
            <DetailAccordion title="JWT payload">
                <Stack spacing={1}>
                    <JsonCodeBlock value={jsonText(payload)} />
                    <CopyButton value={jsonText(payload)} label="payload" />
                </Stack>
            </DetailAccordion>
            <DetailAccordion title="Raw compact token">
                <Stack spacing={1}>
                    <Typography
                        component="pre"
                        sx={{
                            ...monoValueSx,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            m: 0,
                        }}
                    >
                        {token}
                    </Typography>
                    <CopyButton value={token} label="token" />
                </Stack>
            </DetailAccordion>
            <DetailAccordion title="Signature segment">
                <Stack spacing={1}>
                    <Typography
                        component="pre"
                        sx={{
                            ...monoValueSx,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            m: 0,
                        }}
                    >
                        {segments[2] ?? 'Not available'}
                    </Typography>
                    {segments[2] !== undefined && (
                        <CopyButton value={segments[2]} label="signature" />
                    )}
                </Stack>
            </DetailAccordion>
            {nested.length > 0 && (
                <DetailAccordion title={`Nested VC-JWTs (${nested.length})`}>
                    <Stack spacing={2}>
                        {nested.map((nestedToken, index) => (
                            <W3CJwtArtifactDetails
                                key={`${nestedToken}:${index}`}
                                token={nestedToken}
                                label={`Nested VC-JWT ${index + 1}`}
                                level={level + 1}
                            />
                        ))}
                    </Stack>
                </DetailAccordion>
            )}
        </Stack>
    );
};

/** Render a JSON payload artifact with collapsed raw detail and copy support. */
export const JsonArtifactDetails = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <DetailAccordion title={label}>
        <Stack spacing={1}>
            <JsonCodeBlock value={value} />
            <CopyButton value={value} label={label.toLowerCase()} />
        </Stack>
    </DetailAccordion>
);
