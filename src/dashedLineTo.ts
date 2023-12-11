import {Graphics} from "pixi.js";

export function dashedLineTo(g: Graphics, toX: number, toY: number, dash = 16, gap = 8) {
    const fromX = g.currentPath.points[g.currentPath.points.length - 2];
    const fromY = g.currentPath.points[g.currentPath.points.length - 1];
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const normalX = dx / len;
    const normalY = dy / len;
    let dist = 0;
    let x = fromX;
    let y = fromY;
    while (dist < len) {
        const d = Math.min(len - dist, dash);
        dist += dash;
        g.lineTo(x + normalX * d, y + normalY * d);
        x += normalX * d;
        y += normalY * d;

        dist += gap;
        g.moveTo(x + normalX * gap, y + normalY * gap);
        x += normalX * gap;
        y += normalY * gap;
    }
}