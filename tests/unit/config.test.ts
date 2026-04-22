import { describe, expect, it } from 'vitest';
import { buildAppConfig } from '../../src/config';

describe('buildAppConfig', () => {
    it('uses local KERIA, witness, role, schema, and verifier defaults', () => {
        const config = buildAppConfig({});

        expect(config.keria).toEqual({
            adminUrl: 'http://127.0.0.1:3901',
            routerUrl: 'http://127.0.0.1:3902',
            bootUrl: 'http://127.0.0.1:3903',
        });
        expect(config.connectionOptions).toEqual([
            {
                label: 'Local KERIA',
                adminUrl: 'http://127.0.0.1:3901',
                bootUrl: 'http://127.0.0.1:3903',
            },
        ]);
        expect(config.operations).toEqual({
            timeoutMs: 30000,
            minSleepMs: 1000,
            maxSleepMs: 5000,
            liveRefreshMs: 3000,
        });
        expect(config.witnesses.aids).toHaveLength(3);
        expect(config.witnesses.toad).toBe(2);
        expect(config.roles.issuer).toEqual({
            alias: 'issuer',
            passcode: null,
        });
        expect(config.schemas.sediVoterId).toEqual({
            said: 'EANVmibW8WDFs-aySWUGGaSbZKeV5_yIqVzuSiC9xYer',
            oobiUrl:
                'http://127.0.0.1:7723/oobi/EANVmibW8WDFs-aySWUGGaSbZKeV5_yIqVzuSiC9xYer',
        });
        expect(config.verifier).toEqual({
            directUrl: 'http://127.0.0.1:9723',
            dashboardUrl: 'http://127.0.0.1:9923',
            oobiUrl: null,
            trustedIssuerAid: null,
        });
    });

    it('parses app runtime overrides and optional cloud connection options', () => {
        const config = buildAppConfig({
            VITE_KERIA_ADMIN_URL: 'http://keria.example.test:3901',
            VITE_KERIA_ROUTER_URL: 'http://keria.example.test:3902',
            VITE_KERIA_BOOT_URL: 'http://keria.example.test:3903',
            VITE_KERIA_CONNECTION_LABEL: 'Shared KERIA',
            VITE_CLOUD_KERIA_ADMIN_URL: 'https://cloud.example.test',
            VITE_CLOUD_KERIA_BOOT_URL: 'https://cloud.example.test/boot',
            VITE_CLOUD_KERIA_CONNECTION_LABEL: 'Cloud Demo',
            VITE_OPERATION_TIMEOUT_MS: '45000',
            VITE_OPERATION_MIN_SLEEP_MS: '250',
            VITE_OPERATION_MAX_SLEEP_MS: '2000',
            VITE_LIVE_REFRESH_MS: '750',
            VITE_WITNESS_AIDS: 'aid-one, aid-two , aid-three',
            VITE_WITNESS_TOAD: '3',
            VITE_ISSUER_ALIAS: 'demo-issuer',
            VITE_ISSUER_PASSCODE: 'issuer-passcode-value',
            VITE_HOLDER_ALIAS: 'demo-holder',
            VITE_HOLDER_PASSCODE: 'holder-passcode-value',
            VITE_VERIFIER_ALIAS: 'demo-verifier',
            VITE_VERIFIER_PASSCODE: 'verifier-passcode-value',
            VITE_SEDI_VOTER_ID_SCHEMA_SAID: 'schema-said',
            VITE_SEDI_VOTER_ID_SCHEMA_OOBI_URL:
                'http://schema.example.test/oobi',
            VITE_VERIFIER_DIRECT_URL: 'http://verifier.example.test:9723',
            VITE_VERIFIER_DASHBOARD_URL: 'http://verifier.example.test:9923',
            VITE_VERIFIER_OOBI_URL: 'http://verifier.example.test/oobi',
            VITE_TRUSTED_ISSUER_AID: 'trusted-issuer-aid',
        });

        expect(config.connectionOptions).toEqual([
            {
                label: 'Shared KERIA',
                adminUrl: 'http://keria.example.test:3901',
                bootUrl: 'http://keria.example.test:3903',
            },
            {
                label: 'Cloud Demo',
                adminUrl: 'https://cloud.example.test',
                bootUrl: 'https://cloud.example.test/boot',
            },
        ]);
        expect(config.operations.timeoutMs).toBe(45000);
        expect(config.operations.minSleepMs).toBe(250);
        expect(config.operations.maxSleepMs).toBe(2000);
        expect(config.operations.liveRefreshMs).toBe(750);
        expect(config.witnesses).toEqual({
            aids: ['aid-one', 'aid-two', 'aid-three'],
            toad: 3,
        });
        expect(config.roles.issuer).toEqual({
            alias: 'demo-issuer',
            passcode: 'issuer-passcode-value',
        });
        expect(config.roles.holder).toEqual({
            alias: 'demo-holder',
            passcode: 'holder-passcode-value',
        });
        expect(config.roles.verifier).toEqual({
            alias: 'demo-verifier',
            passcode: 'verifier-passcode-value',
        });
        expect(config.schemas.sediVoterId).toEqual({
            said: 'schema-said',
            oobiUrl: 'http://schema.example.test/oobi',
        });
        expect(config.verifier).toEqual({
            directUrl: 'http://verifier.example.test:9723',
            dashboardUrl: 'http://verifier.example.test:9923',
            oobiUrl: 'http://verifier.example.test/oobi',
            trustedIssuerAid: 'trusted-issuer-aid',
        });
    });

    it('supports the legacy credential schema env names', () => {
        const config = buildAppConfig({
            VITE_CREDENTIAL_SCHEMA_SAID: 'legacy-schema-said',
            VITE_CREDENTIAL_SCHEMA_OOBI_URL:
                'http://legacy-schema.example.test/oobi',
        });

        expect(config.schemas.sediVoterId).toEqual({
            said: 'legacy-schema-said',
            oobiUrl: 'http://legacy-schema.example.test/oobi',
        });
    });

    it('fails fast for invalid numeric environment values', () => {
        expect(() =>
            buildAppConfig({ VITE_OPERATION_TIMEOUT_MS: 'not-a-number' })
        ).toThrow('VITE_OPERATION_TIMEOUT_MS must be a finite number.');
        expect(() => buildAppConfig({ VITE_WITNESS_TOAD: 'NaN' })).toThrow(
            'VITE_WITNESS_TOAD must be a finite number.'
        );
    });

    it('requires cloud KERIA admin and boot URLs to be configured together', () => {
        expect(() =>
            buildAppConfig({
                VITE_CLOUD_KERIA_ADMIN_URL: 'https://cloud.example',
            })
        ).toThrow(
            'VITE_CLOUD_KERIA_ADMIN_URL and VITE_CLOUD_KERIA_BOOT_URL must be set together.'
        );
    });
});
