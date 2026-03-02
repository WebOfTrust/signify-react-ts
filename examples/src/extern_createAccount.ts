import dotenv from 'dotenv';
import { Tier, Algos, ready, SignifyClient, ExternalModule } from 'signify-ts';
import { AwsKmsModule } from './AwsKmsModule.js';

dotenv.config();

/* =================================================
 * Minimal Helpers for Standalone Execution
 * ================================================= */
async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function waitOperation(client: SignifyClient, op: any): Promise<any> {
    let cur = op;
    for (let i = 0; i < 30; i++) {
        if (cur?.done) {
            try {
                await client.operations().delete(op.name);
            } catch {}
            return cur.response;
        }
        await sleep(1000);
        cur = await client.operations().get(op.name);
    }
    throw new Error(`Operation timed out: ${op.name}`);
}

async function connectClient(
    url: string,
    bootUrl: string,
    bran: string,
    modules: any[]
) {
    await ready();
    const client = new SignifyClient(url, bran, Tier.low, bootUrl, modules);

    try {
        await client.connect();
    } catch {
        await client.boot();
        await sleep(500);
        await client.connect();
    }
    return client;
}

/* =================================================
 * Main Execution Script (Testing PR #415 FIX)
 * ================================================= */
async function main() {
    console.log('\n🚀 EXTERN AID STANDALONE DEMO (CREATE ACCOUNT)');

    const KERIA_URL = process.env.KERIA_URL || '';
    const KERIA_PORT = process.env.KERIA_PORT || '3901';
    const BOOT_PORT = process.env.BOOT_PORT || '3903';
    const BRAN = process.env.TEST_BRAN || '';
    const ALIAS = process.env.TEST_ALIAS || '';
    const AWS_REGION = process.env.AWS_REGION || '';
    const AWS_KEY_ID = process.env.AWS_KMS_KEY_ID || '';

    await ready();

    const modules: ExternalModule[] = [
        {
            type: 'aws_kms',
            name: 'AwsKmsModule',
            module: class {
                constructor(pidx: number, args: any) {
                    return new AwsKmsModule(
                        pidx,
                        args,
                        AWS_REGION,
                        AWS_KEY_ID
                    ) as any;
                }
            } as any,
        },
    ];

    console.log('\n[SETUP] Connecting to KERIA...');
    const client = await connectClient(
        `${KERIA_URL}:${KERIA_PORT}`,
        `${KERIA_URL}:${BOOT_PORT}`,
        BRAN,
        modules
    );
    console.log('✅ Client connected.');

    const identifiers = client.identifiers();
    let prefix: string | undefined;

    console.log(`\n[STEP 1] Ensure extern AID with alias: ${ALIAS}`);
    try {
        const hab = await identifiers.get(ALIAS);
        prefix = hab.prefix || hab.state?.i;
        console.log(`ℹ️ AID already exists: ${prefix}`);
    } catch {
        console.log('➡️ Creating new extern AID...');
        const createRes = await identifiers.create(ALIAS, {
            algo: Algos.extern,
            extern_type: 'aws_kms',
            transferable: true,
            wits: [],
            toad: 0,
        });

        const op = await createRes.op();
        const result = await waitOperation(client, op);
        prefix = result?.i || result?.pre;
        console.log(`✅ AWS KMS AID created successfully: ${prefix}`);
    }

    console.log(
        `\n[STEP 2] Verifying metadata persistence (The 500 Error Fix)`
    );
    const aidInfo = await identifiers.get(ALIAS);

    console.log('-----------------------------------------');
    console.log(JSON.stringify(aidInfo, null, 2));
    console.log('-----------------------------------------');

    if (aidInfo.extern && aidInfo.extern.extern_type === 'aws_kms') {
        console.log(
            "✅ SUCCESS: The 'extern' metadata is correctly persisted and retrieved without throwing a 500 error!"
        );
    } else {
        console.error(
            "❌ FAILED: The 'extern' metadata is missing from the DB response."
        );
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => {
        console.error('\n💥 FATAL ERROR:', e);
        process.exit(1);
    });
}
