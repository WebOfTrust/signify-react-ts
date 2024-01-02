import { useEffect } from 'react'
import './App.css'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {SignifyClient, ready} from "@kentbull/signify-ts";
import MainComponent from './MainComponent';

function App() {

    useEffect(() => {
        ready().then(() => {
            console.log("signify client is ready")
        })
    }, [])



    return (
        <>
            <MainComponent/>
        </>
    )
}

export default App
