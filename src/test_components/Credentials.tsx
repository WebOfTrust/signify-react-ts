// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { SignifyClient, ready, Serder, Diger, MtrDex, CredentialTypes } from "@kentbull/signify-ts";
import { useState, useEffect } from 'react';


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
                            const operations1 = issuerClient.operations()
                            const oobis1 = issuerClient.oobis()
                            const result1 = await identifiers1.create('issuer',  {
                                toad: 3,
                                wits: [
                                    "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha",
                                    "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM",
                                    "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX"]
                                })
                            let op1 = await result1.op()
                            while (!op1["done"] ) {
                                    op1 = await operations1.get(op1["name"]);
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                                }

                            const recipientClient = new SignifyClient(url, bran2)
                            await recipientClient.boot()
                            await recipientClient.connect()
                            const identifiers2 = recipientClient.identifiers()
                            const operations2 = recipientClient.operations()
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
                            let op2 = await result2.op()
                            while (!op2["done"] ) {
                                    op2 = await operations2.get(op2["name"]);
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                                }
                            const aid2 = op2['response']

                            const verifierClient = new SignifyClient(url, bran3)
                            await verifierClient.boot()
                            await verifierClient.connect()
                            const identifiers3 = verifierClient.identifiers()
                            const operations3 = verifierClient.operations()
                            const oobis3 = verifierClient.oobis()
                            const result3 = await identifiers3.create('verifier', {
                                toad: 3,
                                wits: [
                                    "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha",
                                    "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM",
                                    "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX"]
                                });
                            let op3 = await result3.op();
                            while (!op3["done"] ) {
                                    op3 = await operations3.get(op3["name"]);
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                                }

                            await identifiers1.addEndRole("issuer", 'agent', issuerClient!.agent!.pre)
                            await identifiers2.addEndRole("recipient", 'agent', recipientClient!.agent!.pre)
                            await identifiers3.addEndRole("verifier", 'agent', verifierClient!.agent!.pre)
                            let oobi1 = await oobis1.get("issuer","agent")
                            let oobi2 = await oobis2.get("recipient","agent")
                            let oobi3 = await oobis3.get("verifier","agent")

                            op1 = await oobis1.resolve(oobi2.oobis[0],"recipient")

                            while (!op1["done"]) {
                                op1 = await operations1.get(op1["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }
                            op1 = await oobis1.resolve(oobi3.oobis[0],"verifier")

                            while (!op1["done"]) {
                                op1 = await operations1.get(op1["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }


                            op2 = await oobis2.resolve(oobi1.oobis[0],"issuer")

                            while (!op2["done"]) {
                                op2 = await operations2.get(op2["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }

                            op2 = await oobis2.resolve(oobi3.oobis[0],"verifier")

                            while (!op2["done"]) {
                                op2 = await operations2.get(op2["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }

                            op3 = await oobis3.resolve(oobi2.oobis[0],"issuer")
                            while (!op3["done"]) {
                                op3 = await operations3.get(op3["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }

                            op1 = await oobis1.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema")
                            while (!op1["done"]) {
                                op1 = await operations1.get(op1["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }
                            op2 = await oobis2.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema")
                            while (!op2["done"]) {
                                op2 = await operations2.get(op2["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }

                            op3 = await oobis3.resolve("http://127.0.0.1:7723/oobi/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao","schema")
                            while (!op3["done"]) {
                                op3 = await operations3.get(op3["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }


                            op1 = await issuerClient.registries().create({name: 'issuer', registryName: 'vLEI', nonce: "AOLPzF1vRwMPo6tDfoxba1udvpu0jG_BCP_CI49rpMxK"})
                            while (!op1["done"]) {
                                op1 = await operations1.get(op1["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }

                            let registries = await issuerClient.registries().list('issuer')

                            await issuerClient.schemas().get("EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao")
                            await recipientClient.schemas().list()
                            const vcdata = {
                                "LEI": "5493001KJTIIGC8Y1R17"
                              }
                            op1 = await issuerClient.credentials().issue({
                                issuerName: 'issuer',
                                registryId: registries[0].regk,
                                schemaId: 'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao',
                                recipient: aid2.i,
                                data: vcdata
                            })
                            while (!op1["done"]) {
                                op1 = await operations1.get(op1["name"]);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            }
                            // await new Promise(resolve => setTimeout(resolve, 20000))
                            let creds = await issuerClient.credentials().list()
                            await issuerClient.credentials().list()
                            await recipientClient.credentials().list()

                            await issuerClient.credentials().present('issuer', creds[0].sad.d, 'verifier', true)
                            await new Promise(resolve => setTimeout(resolve, 5000))
                            await verifierClient.credentials().list()

                            op1 = await issuerClient.credentials().revoke('issuer', creds[0].sad.d)
                            // while (!op1["done"]) {
                            //     op1 = await operations1.get(op1["name"]);
                            //     await new Promise(resolve => setTimeout(resolve, 1000)); // sleep for 1 second
                            // }
                            await new Promise(resolve => setTimeout(resolve, 5000))
                            await issuerClient.credentials().list()
                            await recipientClient.credentials().list()
                            await verifierClient.credentials().list()

                            await issuerClient.credentials().present('issuer', creds[0].sad.d, 'verifier', true)
                            await new Promise(resolve => setTimeout(resolve, 5000))
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


