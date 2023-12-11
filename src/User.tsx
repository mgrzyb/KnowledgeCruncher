import {Container, Graphics} from "pixi.js";
import {Point2D} from "./types";
import {Board} from "./Board";

export class User {

    private readonly cursor = new Graphics();

    constructor(private readonly board: Board, private readonly layer: Container, readonly clientId: number, state: {cursor?: Point2D }) {
        this.cursor.beginFill(this.clientId%0xFFFFFF)
        this.cursor.drawCircle(0, 0, 5)
        this.cursor.endFill()
        this.layer.addChild(this.cursor)
        this.update(state)
    }

    update(state: { cursor?: Point2D }) {
        if (state.cursor) {
            const p = this.board.fromCanvasCoordinates(state.cursor);
            this.cursor.x = state.cursor.x;
            this.cursor.y = state.cursor.y;
        }
    }

    remove() {
        this.layer.removeChild(this.cursor);
    }
}