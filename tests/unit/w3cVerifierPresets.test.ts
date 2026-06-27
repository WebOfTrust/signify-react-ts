import { describe, expect, it } from 'vitest';
import {
    buildW3CVerifierRequestDescriptor,
    buildW3CVerifierRequestJson,
    DEFAULT_W3C_VERIFIER_PRESET_ID,
    defaultW3CVerifierPreset,
    presetById,
    verifierPresetForSelection,
    type W3CVerifierRequestPreset,
} from '../../src/domain/credentials/w3cVerifierPresets';

describe('W3C verifier presets', () => {
    it('defaults to the Python Isomer verifier', () => {
        const preset = defaultW3CVerifierPreset();

        expect(DEFAULT_W3C_VERIFIER_PRESET_ID).toBe('isomer-python');
        expect(preset.id).toBe('isomer-python');
        expect(presetById('isomer-node')?.id).toBe('isomer-node');
        expect(verifierPresetForSelection('missing').id).toBe(
            'isomer-python'
        );
    });

    it('builds descriptors with separate audience and KERIA submission URLs', () => {
        const preset: W3CVerifierRequestPreset = {
            id: 'isomer-python',
            label: 'Isomer Python',
            publicBaseUrl: 'http://127.0.0.1:8788/',
            submissionBaseUrl: 'http://isomer-python:8788/',
            verifyVpPath: 'verify/vp',
        };

        expect(
            buildW3CVerifierRequestDescriptor({
                preset,
                nonce: 'nonce-1',
            })
        ).toEqual({
            verifierId: 'isomer-python',
            verifierLabel: 'Isomer Python',
            verifierOrigin: 'http://127.0.0.1:8788',
            origin: 'http://127.0.0.1:8788',
            format: 'vp+jwt',
            formats: ['vp+jwt'],
            client_id: 'http://127.0.0.1:8788/verify/vp',
            aud: 'http://127.0.0.1:8788/verify/vp',
            nonce: 'nonce-1',
            response_uri: 'http://isomer-python:8788/verify/vp',
            submissionEndpoint: 'http://isomer-python:8788/verify/vp',
        });
    });

    it('serializes request JSON with a fresh React nonce prefix', () => {
        const json = buildW3CVerifierRequestJson({
            preset: defaultW3CVerifierPreset(),
            credentialSaid: 'EcredentialSaid',
        });
        const descriptor = JSON.parse(json) as Record<string, unknown>;

        expect(descriptor.verifierId).toBe('isomer-python');
        expect(descriptor.nonce).toEqual(
            expect.stringMatching(/^react-isomer-python-Ecredential/)
        );
    });
});
