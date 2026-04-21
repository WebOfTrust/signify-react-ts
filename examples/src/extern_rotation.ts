import dotenv from 'dotenv';
import {
    Tier,
    Algos,
    ready,
    SignifyClient,
    Saider,
    Serder,
    ExternalModule,
    Diger,
    Matter,
    MtrDex,
} from 'signify-ts';
import { AwsKmsModule } from './AwsKmsModule.js';

dotenv.config();

/* =================================================
 * Minimal Helpers for Standalone Execution
 * ================================================= */
async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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

async function postRotEvent(
    client: SignifyClient,
    alias: string,
    rotKed: any,
    sigerQb64: string,
    externMeta: any
) {
    const path = `/identifiers/${encodeURIComponent(alias)}/events`;

    const body: any = {
        rot: rotKed,
        sigs: [sigerQb64],
        smids: [],
        rmids: [],
    };

    if (externMeta) body.extern = externMeta;

    const res = await (client as any).fetch(path, 'POST', body);
    if (res && typeof res.json === 'function') return await res.json();
    return res;
}

/* =================================================
 * Main Execution Script (Testing Rotation)
 * ================================================= */
async function main() {
    console.log('\n=================================================');
    console.log('🚀 EXTERN AID STANDALONE DEMO (ROTATION)');
    console.log('=================================================');

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

    console.log(`\n[STEP 1] Fetching Identifier Info for ${ALIAS}...`);
    let aidInfo: any;
    try {
        aidInfo = await identifiers.get(ALIAS);
    } catch (e: any) {
        throw new Error(
            `❌ Failed to fetch identifier ${ALIAS}. Run createAccount script first.`
        );
    }

    const prefix = aidInfo.prefix || aidInfo.state?.i;

    console.log('\n[STEP 2] Fetching Current KeyState...');
    const statesRes = await client.keyStates().get(prefix);
    const beforeState = Array.isArray(statesRes) ? statesRes[0] : statesRes;
    const beforeS = parseInt(beforeState.s, 16);
    const beforeD = beforeState.d;

    console.log(`   - Current Sequence (s): ${beforeS}`);
    console.log(`   - Current Event Dig(d): ${beforeD}`);

    console.log('\n[STEP 3] Constructing ROT Event...');
    const awsSigner = new AwsKmsModule(0, {}, AWS_REGION, AWS_KEY_ID);
    const pubQb64 = await awsSigner.getPubQb64();
    const nextDigQb64 = new Diger(
        { code: MtrDex.Blake3_256 },
        new Matter({ qb64: pubQb64 }).qb64b
    ).qb64;

    const nextS_hex = (beforeS + 1).toString(16);

    const rotKed0: any = {
        v: 'KERI10JSON000000_',
        t: 'rot',
        d: '',
        i: prefix,
        s: nextS_hex,
        p: beforeD,
        kt: '1',
        k: [pubQb64],
        nt: '1',
        n: [nextDigQb64],
        bt: '0',
        br: [],
        ba: [],
        a: [],
    };

    const [, rotKed1] = (Saider as any).saidify(rotKed0);
    const serder = new Serder(rotKed1);

    const rotKedFinal = (serder as any).ked ?? (serder as any).sad ?? rotKed1;
    const rawSer: Uint8Array =
        (serder as any).raw instanceof Uint8Array
            ? (serder as any).raw
            : new TextEncoder().encode((serder as any).raw);

    console.log('\n[STEP 4] Signing ROT Event with AWS KMS...');
    const sigs = await awsSigner.sign(rawSer, true);
    console.log(`   - Generated KERI Siger: ${sigs[0]}`);

    console.log('\n[STEP 5] Submitting ROT Event to KERIA...');
    const externMeta = aidInfo.extern;

    await postRotEvent(client, ALIAS, rotKedFinal, sigs[0], externMeta);
    console.log('   - Submit Response OK.');

    console.log('\n[STEP 6] Verifying State & Key Event Log (KEL)...');
    await sleep(2000);

    const finalStates = await client.keyStates().get(prefix);
    const finalState = Array.isArray(finalStates)
        ? finalStates[0]
        : finalStates;
    const finalS = parseInt(finalState.s, 16);

    const fullKel = await client.keyEvents().get(prefix);
    const lastEvent = fullKel[fullKel.length - 1];

    console.log('---------------------------------------------------');
    console.log(`📊 Current State: Sequence ${finalS}`);
    console.log(`📜 Full KEL Length: ${fullKel.length} events`);
    console.log(`🆕 Latest Event Type: ${lastEvent.ked.t}`);
    console.log(`🆕 Latest Event SAID: ${lastEvent.ked.d}`);
    console.log('---------------------------------------------------');

    if (finalS === beforeS + 1 && lastEvent.ked.t === 'rot') {
    } else {
        console.error(
            '\n❌ FAILED: Sequence number did not increment or ROT event missing.'
        );
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => {
        console.error('\n💥 FATAL ERROR:', e);
        process.exit(1);
    });
}
