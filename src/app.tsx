import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {Application} from "pixi.js";
import {Board} from "./Board";
import {ShapeData} from "./ShapeData";
import {UndoManager} from "yjs";
import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {Shape} from "./Shapes/Shape";
import {nanoid} from "nanoid";

const segments = window.location.pathname.split("/").filter(s => !!s)
console.log(segments);
let roomName: string;
if (segments.length > 0) {
    roomName = segments.pop()!
} else {
    window.location.replace("/" + nanoid(6))
}

const ydoc = new Y.Doc({})
const websocketProvider = new WebsocketProvider('ws://localhost:1234', roomName, ydoc)
websocketProvider.on("sync", () => {
    console.log("Synced")
});

const elements = ydoc.getArray<Y.Map<any>>("elements_array") as unknown as Y.Array<ShapeData>

const undoManager = new UndoManager(elements);

const pixiApp = new Application<HTMLCanvasElement>({
    background: 'white',
    resizeTo: document.getElementById("pixiApp") || undefined,
    antialias: true
});

const board = new Board(pixiApp, elements, websocketProvider.awareness)

pixiApp.view.addEventListener('contextmenu', e => e.preventDefault())

document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLTextAreaElement)
        return;
    if (e.target instanceof HTMLInputElement)
        return;
    
    if (e.key == "z" && e.ctrlKey) {
        undoManager.undo()
    }
    if (e.key == "y" && e.ctrlKey) {
        undoManager.redo()
    }
    if (e.key == "a" && e.ctrlKey) {
        e.preventDefault();
        e.stopImmediatePropagation()
        board.selectAll()
    }
    if (e.key === "Delete") {
        board.deleteSelection();
    }
    if (e.code === "Numpad4" && e.ctrlKey) {
        board.alignSelectionLeft()
    }

    if (e.code === "Numpad6" && e.ctrlKey) {
        board.alignSelectionRight();
    }

    if (e.code === "Numpad8" && e.ctrlKey) {
        board.alignSelectionTop()
    }

    if (e.code === "Numpad2" && e.ctrlKey) {
        board.alignSelectionBottom()
    }
})

document.getElementById("pixiApp")!.appendChild(pixiApp.view);

const App = ({board}: { board: Board }) => {
    const [focusedShape, setFocusedShape] = useState(board.focusedShape)
    useEffect(() => {
        return board.selectionChanged.addListener((selection, focusedShape) => {
            setFocusedShape(focusedShape);
        })
    }, [board]);

    return (
        <>
            {focusedShape &&
                <div style={{position: "absolute", right: 20, bottom: 20, pointerEvents: "all"}}>
                    <PropertiesEditor shape={focusedShape} />
                </div>
            }
        </>
    )
}

const PropertiesEditor = ({ shape } : { shape : Shape }) => {

    const [c, setC] = useState(0);
    useEffect(() => {
        const observer = () => setC(c => c + 1);
        shape.rawProperties.observe(observer)
        return () => {
            shape.rawProperties?.unobserve(observer)
        }
    }, [shape]);
    
    return (<textarea rows={15} style={{width: 300}}
        value={shape.rawProperties.toString()}
        onChange={e => {
            shape.rawProperties.doc?.transact(() => {
                shape.rawProperties.delete(0, shape.rawProperties.length);
                shape.rawProperties.insert(0, e.target.value);
            })
        }}
    />);
}

createRoot(document.getElementById("root")!).render(<App board={board}/>)