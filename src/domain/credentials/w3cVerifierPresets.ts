export interface W3CVerifierRequestPreset {
    id: string;
    label: string;
    publicBaseUrl: string;
    submissionBaseUrl: string;
    verifyVpPath: string;
}

export interface W3CVerifierRequestDescriptor
    extends Record<string, unknown> {
    verifierId: string;
    verifierLabel: string;
    verifierOrigin: string;
    origin: string;
    format: 'vp+jwt';
    formats: ['vp+jwt'];
    client_id: string;
    aud: string;
    nonce: string;
    response_uri: string;
    submissionEndpoint: string;
}

export const W3C_VERIFY_VP_PATH = '/verify/vp';
export const DEFAULT_W3C_VERIFIER_PRESET_ID = 'isomer-python';

export const DEFAULT_LOCAL_ISOMER_W3C_VERIFIER_PRESETS: readonly W3CVerifierRequestPreset[] =
    [
        {
            id: 'isomer-python',
            label: 'Isomer Python',
            publicBaseUrl: 'http://127.0.0.1:8788',
            submissionBaseUrl: 'http://isomer-python:8788',
            verifyVpPath: W3C_VERIFY_VP_PATH,
        },
        {
            id: 'isomer-node',
            label: 'Isomer Node',
            publicBaseUrl: 'http://127.0.0.1:8789',
            submissionBaseUrl: 'http://isomer-node:8788',
            verifyVpPath: W3C_VERIFY_VP_PATH,
        },
        {
            id: 'isomer-go',
            label: 'Isomer Go',
            publicBaseUrl: 'http://127.0.0.1:8790',
            submissionBaseUrl: 'http://isomer-go:8788',
            verifyVpPath: W3C_VERIFY_VP_PATH,
        },
    ];

export const defaultW3CVerifierPreset = (
    presets: readonly W3CVerifierRequestPreset[] =
        DEFAULT_LOCAL_ISOMER_W3C_VERIFIER_PRESETS
): W3CVerifierRequestPreset =>
    presetById(DEFAULT_W3C_VERIFIER_PRESET_ID, presets) ??
    presets[0] ??
    DEFAULT_LOCAL_ISOMER_W3C_VERIFIER_PRESETS[0];

export const presetById = (
    id: string,
    presets: readonly W3CVerifierRequestPreset[] =
        DEFAULT_LOCAL_ISOMER_W3C_VERIFIER_PRESETS
): W3CVerifierRequestPreset | null =>
    presets.find((preset) => preset.id === id) ?? null;

export const verifierPresetForSelection = (
    selectedVerifierId: string,
    presets: readonly W3CVerifierRequestPreset[] =
        DEFAULT_LOCAL_ISOMER_W3C_VERIFIER_PRESETS
): W3CVerifierRequestPreset =>
    presetById(selectedVerifierId, presets) ?? defaultW3CVerifierPreset(presets);

export const createW3CPresentationNonce = (
    verifierId: string,
    credentialSaid: string
): string => {
    const random =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `react-${verifierId}-${credentialSaid.slice(0, 12)}-${random}`;
};

export const buildW3CVerifierRequestDescriptor = ({
    preset,
    nonce,
}: {
    preset: W3CVerifierRequestPreset;
    nonce: string;
}): W3CVerifierRequestDescriptor => {
    const publicBaseUrl = stripTrailingSlash(preset.publicBaseUrl);
    const submissionBaseUrl = stripTrailingSlash(preset.submissionBaseUrl);
    const path = pathWithLeadingSlash(preset.verifyVpPath);
    const verifierEndpoint = `${publicBaseUrl}${path}`;
    const submissionEndpoint = `${submissionBaseUrl}${path}`;

    return {
        verifierId: preset.id,
        verifierLabel: preset.label,
        verifierOrigin: publicBaseUrl,
        origin: publicBaseUrl,
        format: 'vp+jwt',
        formats: ['vp+jwt'],
        client_id: verifierEndpoint,
        aud: verifierEndpoint,
        nonce,
        response_uri: submissionEndpoint,
        submissionEndpoint,
    };
};

export const buildW3CVerifierRequestJson = ({
    preset,
    credentialSaid,
}: {
    preset: W3CVerifierRequestPreset;
    credentialSaid: string;
}): string =>
    JSON.stringify(
        buildW3CVerifierRequestDescriptor({
            preset,
            nonce: createW3CPresentationNonce(preset.id, credentialSaid),
        }),
        null,
        2
    );

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const pathWithLeadingSlash = (value: string): string =>
    value.startsWith('/') ? value : `/${value}`;
