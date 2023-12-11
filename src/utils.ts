import {Point2D} from "./types";

export function snapValueTo(v: number, snapTarget: number) {
    return Math.abs(v - snapTarget) < 5 ? snapTarget : v;
}

export function snapPointToPoint(v: Point2D, snapTarget: Point2D) {
    return { 
        x: snapValueTo(v.x, snapTarget.x),
        y: snapValueTo(v.y, snapTarget.y)
    }
}