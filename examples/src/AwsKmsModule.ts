import { Algos, Matter, MtrDex, Diger, Siger, Signer } from "signify-ts";
import { KMSClient, GetPublicKeyCommand, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";

/* =================================================
 * AWS KMS External Module Implementation
 * -------------------------------------------------
 * This strictly implements the IdentifierManager interface. 
 * You can swap the inner logic with `@google-cloud/kms` to test on GCP.
 * ================================================= */
export class AwsKmsModule {
    algo: Algos = Algos.extern;
    signers: Signer[] = []; // KMS handles signing, so local signers remain empty
    private kms: KMSClient;
    private keyId: string;

    constructor(pidx: number, args: any, region: string, keyId: string) {
        this.kms = new KMSClient({ region });
        this.keyId = keyId;
    }

    // This data is passed to KERIA and stored in the DB (fixes the 500 error)
    params(): any {
        return { extern_type: "aws_kms" };
    }

    // Fetches the public key from AWS KMS and formats it to qb64
    async getPubQb64(): Promise<string> {
        const cmd = new GetPublicKeyCommand({ KeyId: this.keyId });
        const res = await this.kms.send(cmd);
        if (!res.PublicKey) throw new Error("PublicKey not found in KMS");

        // Extract raw 32 bytes from AWS Ed25519 DER format
        const raw32 = Buffer.from(res.PublicKey).slice(-32);
        return new Matter({ raw: raw32, code: MtrDex.Ed25519 }).qb64;
    }

    async incept(transferable: boolean): Promise<[string[], string[]]> {
        const pubQb64 = await this.getPubQb64();
        const nextDigQb64 = new Diger({ code: MtrDex.Blake3_256 }, new Matter({ qb64: pubQb64 }).qb64b).qb64;
        
        return [[pubQb64], [nextDigQb64]]; 
    }

    async rotate(ncodes: string[], transferable: boolean): Promise<[string[], string[]]> {
        return this.incept(transferable);
    }

    // Delegates the payload signing to AWS KMS
    async sign(ser: Uint8Array, indexed: boolean = true): Promise<string[]> {
        const input: SignCommandInput = {
            KeyId: this.keyId,
            Message: ser,
            MessageType: "RAW",
            SigningAlgorithm: "ED25519_SHA_512", // Required for Ed25519 in AWS SDK v3
        };
        const command = new SignCommand(input);
        const response = await this.kms.send(command);
        if (!response.Signature) throw new Error("Signature generation failed");
        
        const sigBytes = Buffer.from(response.Signature);
        return [new Siger({ raw: sigBytes, index: 0 }).qb64]; 
    }
}