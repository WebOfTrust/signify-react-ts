import { Serder } from "signify-ts";
import { useState } from 'react';
import { createSignifyClient } from '../signify/client';


export function Delegation() {
    const [testResult, setTestResult] = useState('');
    return (
        <>
            <div className="card">
                <button
                    onClick={async () => {
                        try {
                            const url = "http://localhost:3901"
                            const bran = '0123456789abcdefghijk'
                            const client = await createSignifyClient({ adminUrl: url, passcode: bran })
                            // assert.equal(client.controller.pre, 'ELI7pg979AdhmvrjDeam2eAO2SR5niCgnjAJXJHtJose')
                            const r1 = await client.boot()
                            // assert.equal(r1.status, 202)
                            await client.connect()
                            // assert.notEqual(client.agent, undefined)
                            // assert.equal(client.agent?.pre, 'EEXekkGu9IAzav6pZVJhkLnjtjM5v3AcyA-pdKUcaGei')
                            // assert.equal(client.agent?.anchor, 'ELI7pg979AdhmvrjDeam2eAO2SR5niCgnjAJXJHtJose')

                            // Delegator OOBI:
                            // http://127.0.0.1:5642/oobi/EHpD0-CDWOdu5RJ8jHBSUkOqBZ3cXeDVHWNb_Ul89VI7/witness

                            const delpre = "EHpD0-CDWOdu5RJ8jHBSUkOqBZ3cXeDVHWNb_Ul89VI7"


                            const identifiers = client.identifiers()
                            const operations = client.operations()
                            const oobis = client.oobis()

                            const resolveOp = await oobis.resolve("http://127.0.0.1:5642/oobi/"+delpre+"/witness")
                            await operations.wait(resolveOp, { minSleep: 1000 })

                            const createResult = await identifiers.create('aid1', {delpre: delpre})
                            const pre = createResult.serder.pre

                            const createOp = await createResult.op()
                            const completedCreateOp = await operations.wait(createOp, { minSleep: 1000 })

                            const icp1 = new Serder(completedCreateOp.response)
                            // assert.equal(icp1.pre, pre)

                            setTestResult("Passed")
                        }
                        catch (e) {
                            console.log(e)
                            setTestResult("Failed")
                        }
                    }} >Delegation Integration Test</button>{testResult}
            </div>
        </>
    )
}
