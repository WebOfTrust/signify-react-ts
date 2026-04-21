import { SignifyClient, ready, Serder, type Operation } from "signify-ts";
import { useState, useEffect } from 'react';

const waitOperation = (client: SignifyClient, op: Operation) =>
    client.operations().wait(op, { minSleep: 1000 });


export function Credentials() {
    const [testResult, setTestResult] = useState('');
    useEffect(() => {
        ready().then(() => {
            console.log("signify client is ready")
        })
    }, [])

    return (
        <>
            <div className="card">
                <button
                    onClick={async () => {
                        try {
                            const url = "http://localhost:3901"
                            const bran1 = '0123456789abcdefghijk'
                            const bran2 = '1123456789abcdefghijk'
                            const bran3 = '2123456789abcdefghijk'

                            const issuerClient = new SignifyClient(url, bran1)
                            await issuerClient.boot()
                            await issuerClient.connect()
                            const identifiers1 = issuerClient.identifiers()
                            const oobis1 = issuerClient.oobis()
                            const result1 = await identifiers1.create('issuer',  {
                                toad: 3,
                                wits: [
                                    "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha",
                                    "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM",
                                    "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX"]
                                })
                            await waitOperation(issuerClient, await result1.op())

                            const recipientClient = new SignifyClient(url, bran2)
                            await recipientClient.boot()
                            await recipientClient.connect()
                            const identifiers2 = recipientClient.identifiers()
                            const oobis2 = recipientClient.oobis()
                            // let client2 = client1
                            // let identifiers2 = identifiers1
                            // let operations2 = operations1
                            // let oobis2 = oobis1
                            const result2 = await identifiers2.create('recipient', {
                                toad: 3,
                                wits: [
                                    "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha",
                                    "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM",
                                    "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX"]
                                })
                            await waitOperation(recipientClient, await result2.op())
                            const aid2 = await identifiers2.get('recipient')

                            const verifierClient = new SignifyClient(url, bran3)
                            await verifierClient.boot()
                            await verifierClient.connect()
                            const identifiers3 = verifierClient.identifiers()
                            const oobis3 = verifierClient.oobis()
                            const result3 = await identifiers3.create('verifier', {
                                toad: 3,
                                wits: [
                                    "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha",
                                    "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM",
                                    "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX"]
                                });
                            await waitOperation(verifierClient, await result3.op());
                            const aid3 = await identifiers3.get('verifier')

                            await identifiers1.addEndRole("issuer", 'agent', issuerClient!.agent!.pre)
                            await identifiers2.addEndRole("recipient", 'agent', recipientClient!.agent!.pre)
                            await identifiers3.addEndRole("verifier", 'agent', verifierClient!.agent!.pre)
                            const oobi1 = await oobis1.get("issuer","agent")
                            const oobi2 = await oobis2.get("recipient","agent")
                            const oobi3 = await oobis3.get("verifier","agent")

                            await waitOperation(issuerClient, await oobis1.resolve(oobi2.oobis[0],"recipient"))
                            await waitOperation(issuerClient, await oobis1.resolve(oobi3.oobis[0],"verifier"))

                            await waitOperation(recipientClient, await oobis2.resolve(oobi1.oobis[0],"issuer"))
                            await waitOperation(recipientClient, await oobis2.resolve(oobi3.oobis[0],"verifier"))

                            await waitOperation(verifierClient, await oobis3.resolve(oobi2.oobis[0],"issuer"))

                            await waitOperation(issuerClient, await oobis1.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema"))
                            await waitOperation(recipientClient, await oobis2.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema"))
                            await waitOperation(verifierClient, await oobis3.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema"))

                            const registryResult = await issuerClient.registries().create({name: 'issuer', registryName: 'vLEI', nonce: "AOLPzF1vRwMPo6tDfoxba1udvpu0jG_BCP_CI49rpMxK"})
                            await waitOperation(issuerClient, await registryResult.op())

                            const registries = await issuerClient.registries().list('issuer')

                            await issuerClient.schemas().get("EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao")
                            await recipientClient.schemas().list()
                            const vcdata = {
                                "LEI": "5493001KJTIIGC8Y1R17"
                              }
                            const issued = await issuerClient.credentials().issue('issuer', {
                                ri: registries[0].regk,
                                s: 'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao',
                                a: {
                                    i: aid2.prefix,
                                    ...vcdata
                                }
                            })
                            await waitOperation(issuerClient, issued.op)
                            // await new Promise(resolve => setTimeout(resolve, 20000))
                            const creds = await issuerClient.credentials().list()
                            await issuerClient.credentials().list()
                            await recipientClient.credentials().list()

                            const credential = await issuerClient.credentials().get(creds[0].sad.d)
                            const [grant, gsigs, gend] = await issuerClient.ipex().grant({
                                senderName: 'issuer',
                                recipient: aid3.prefix,
                                acdc: new Serder(credential.sad),
                                anc: new Serder(credential.anc),
                                iss: new Serder(credential.iss),
                                ancAttachment: credential.ancatc,
                            })
                            const grantOp = await issuerClient.ipex().submitGrant('issuer', grant, gsigs, gend, [aid3.prefix])
                            await waitOperation(issuerClient, grantOp)
                            await verifierClient.credentials().list()

                            const revoked = await issuerClient.credentials().revoke('issuer', creds[0].sad.d)
                            await waitOperation(issuerClient, revoked.op)
                            await issuerClient.credentials().list()
                            await recipientClient.credentials().list()
                            await verifierClient.credentials().list()

                            setTestResult("Passed")
                        }
                        catch (e) {
                            console.log(e)
                            setTestResult("Failed")
                        }
                    }} >Credential Integration Test</button>{testResult}
            </div>
        </>
    )
}
