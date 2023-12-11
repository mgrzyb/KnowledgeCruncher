import {Circle, Container, FederatedPointerEvent, Graphics, Point, Text} from "pixi.js";
import {Board} from "../Board";
import {AssociationData, createPointData, PointData} from "../ShapeData";
import {Shape, ShapeBase} from "./Shape";
import {Bounds2D, Point2D} from "../types";
import {Array as YArray} from "yjs";
import {snapPointToPoint} from "../utils";
import {dashedLineTo} from "../dashedLineTo";

type LineType = 'solid' | 'dotted' | 'dashed';
type ArrowheadType = 'none' | 'arrow' | 'triangle';

interface Props {
    lineType: LineType;
    startArrowheadType: ArrowheadType;
    endArrowheadType: ArrowheadType;
    startMultiplicity?: string;
    endMultiplicity?: string;
}

export class Association extends ShapeBase<AssociationData, Props> implements Shape {

    private _bounds: Bounds2D | undefined;
    get bounds() {
        if (!this._bounds) {
            this._bounds = this.calculateBounds()
        }
        return this._bounds;
    }

    private readonly startPointIndex = 0;

    get startPoint() { return this.points.get(this.startPointIndex); }

    get endPointIndex() { return this.points.length - 1; }

    get endPoint() { return this.points.get(this.points.length - 1); }

    get points() { return this.data.get("points"); }

    get anchor1() { return this.data.get('anchor1'); }

    get anchor2() { return this.data.get('anchor2'); }

    get displayObject() { return this.line; }

    private readonly line = new Graphics();

    private readonly startArrowHead = new Graphics();
    private readonly endArrowHead = new Graphics();
    private readonly startMultiplicity = new Text();
    private readonly endMultiplicity = new Text();
    
    private readonly pointHandles: Graphics[];
    private readonly midpointHandles: Graphics[];

    private controlsVisible = false;
    private suppressAnchor1: boolean = false;
    private suppressAnchor2: boolean = false;
    
    constructor(board: Board, canvas: Container, data: AssociationData) {
        super(board, canvas, data);
        this.pointHandles = this.createPointHandles();
        this.midpointHandles = this.createMidpointHandles();

        this.line.eventMode = 'static'
        this.line.cursor = 'pointer'
        this.canvas.addChild(this.line);
        
        this.canvas.addChild(this.startArrowHead)
        this.canvas.addChild(this.endArrowHead)
        
        this.startMultiplicity.style.fontSize = 14;
        this.endMultiplicity.style.fontSize = 14;
        this.canvas.addChild(this.startMultiplicity)
        this.canvas.addChild(this.endMultiplicity)
        this.updateDisplayObject()

        this.board.shapeBoundsChanged.addListener(e => {
            if (!this.suppressAnchor1 && e.key === this.anchor1?.key) {
                const p = e.getAnchorPoint(this.anchor1.position);
                p && this.absoluteMovePoint(this.startPointIndex, p.x, p.y)
            }

            if (!this.suppressAnchor2 && e.key === this.anchor2?.key) {
                const p = e.getAnchorPoint(this.anchor2.position);
                p && this.absoluteMovePoint(this.endPointIndex, p.x, p.y)
            }
        })
    }

    private redraw() {
        const color = this.selected ? 'blue' : 'black';

        this.line.clear();
        this.line.lineStyle({width: 1, color: color, alpha: 1, native: true})

        this.line.moveTo(this.startPoint.get("x"), this.startPoint.get("y"))
        
        for (let i = 1; i < this.points.length; i++) {
            const p = this.points.get(i);

            switch(this.properties.lineType){
                case "dotted":
                    dashedLineTo(this.line, p.get("x"), p.get("y"), 2, 2);
                    break;
                case "dashed":
                    dashedLineTo(this.line, p.get("x"), p.get("y"), 6, 4);
                    break;
                default:
                    this.line.lineTo(p.get("x"), p.get("y"))
            }
        }

        this.line.hitArea = this;
        this.drawArrowhead(this.startArrowHead, this.properties.startArrowheadType, color);
        this.drawArrowhead(this.endArrowHead, this.properties.endArrowheadType, color);

        const p11 = this.points.get(this.endPointIndex);
        const p12 = this.points.get(this.endPointIndex - 1);
        this.startArrowHead.x = p11.get("x");
        this.startArrowHead.y = p11.get("y");
        this.startArrowHead.rotation = -Math.atan2((p12.get("x") - p11.get("x")), (p12.get("y") - p11.get("y")))

        const p21 = this.points.get(this.startPointIndex);
        const p22 = this.points.get(this.startPointIndex + 1);
        this.endArrowHead.x = p21.get("x");
        this.endArrowHead.y = p21.get("y");
        this.endArrowHead.rotation = -Math.atan2((p22.get("x") - p21.get("x")), (p22.get("y") - p21.get("y")))

        this.startMultiplicity.visible = !!this.properties.startMultiplicity;
        if (this.properties.startMultiplicity) {
            this.startMultiplicity.text = this.properties.startMultiplicity;
            
            const dx = this.points.get(this.startPointIndex).get("x") - this.points.get(this.startPointIndex + 1).get("x");
            const dy = this.points.get(this.startPointIndex).get("y") - this.points.get(this.startPointIndex + 1).get("y");
            const angle = Math.atan2(dy, dx);
            const foo = this.getMultiplicityAnnotationOffset(angle, this.anchor1?.position);
            this.startMultiplicity.anchor.set(foo.textAnchor.x, foo.textAnchor.y);
            this.startMultiplicity.x = this.startPoint.get("x") + foo.textOffset.x;
            this.startMultiplicity.y = this.startPoint.get("y") + foo.textOffset.y;
        }
        
        this.endMultiplicity.visible = !!this.properties.endMultiplicity;
        if (this.properties.endMultiplicity) {
            this.endMultiplicity.text = this.properties.endMultiplicity;

            const dx = this.points.get(this.endPointIndex).get("x") - this.points.get(this.endPointIndex - 1).get("x");
            const dy = this.points.get(this.endPointIndex).get("y") - this.points.get(this.endPointIndex - 1).get("y");
            const angle = Math.atan2(dy, dx);
            const foo = this.getMultiplicityAnnotationOffset(angle, this.anchor2?.position);
            this.endMultiplicity.anchor.set(foo.textAnchor.x, foo.textAnchor.y);
            this.endMultiplicity.x = this.endPoint.get("x") + foo.textOffset.x;
            this.endMultiplicity.y = this.endPoint.get("y") + foo.textOffset.y;
        }
    }

    private getMultiplicityAnnotationOffset(angle: number, anchorPosition: number | undefined): { textAnchor: Point2D, textOffset: Point2D } {
        if (angle < -Math.PI / 2) {
            console.log("Ange: 1")
            if (anchorPosition && Math.floor(anchorPosition) === 3) {
                return { textAnchor: {x:1, y: 0}, textOffset: {x: -5, y: 5 }}
            } else {
                return { textAnchor: {x:0, y: 1}, textOffset: {x: 5, y: -5 }}
            }
        } else if (angle < 0) {
            console.log("Ange: 2")
            if (anchorPosition && Math.floor(anchorPosition) === 3) {
                return { textAnchor: {x:0, y: 0}, textOffset: {x: 5, y: 5 }}
            } else {
                return { textAnchor: {x:1, y: 1}, textOffset: {x: -5, y: -5 }}
            }
        } else if (angle < Math.PI / 2) {
            console.log("Ange: 3")
            if (anchorPosition && Math.floor(anchorPosition) === 1) {
                return { textAnchor: {x:0, y: 1}, textOffset: {x: 5, y: -5 }}
            } else {
                return { textAnchor: {x:1, y: 0}, textOffset: {x: -5, y: 5 }}
            }
        } else {
            console.log("Ange: 4")
            if (anchorPosition && Math.floor(anchorPosition) === 1) {
                return { textAnchor: {x:1, y: 1}, textOffset: {x: -5, y: -5 }}
            } else {
                return { textAnchor: {x:0, y: 0}, textOffset: {x: 5, y: 5 }}
            }
        }
    }

    private drawArrowhead(g: Graphics, type: ArrowheadType, color: string) {
        g.clear()
        switch (type) {
            case "arrow":
                g.lineStyle({width: 1, color: color, alpha: 1, native: true})
                g.pivot = {x: 10, y: 0}
                g.moveTo(10, 0)
                g.lineTo(3, 10)
                g.moveTo(10, 0)
                g.lineTo(17, 10)
                break;
            case "triangle":
                g.lineStyle({width: 1, color: color, alpha: 1, native: true})
                g.beginFill('white')
                g.drawPolygon([new Point(10, 0), new Point(3, 10), new Point(17, 10)])
                g.endFill()
                break;
        }
    }

    contains(x: number, y: number) {
        function segmentContains(aData: PointData, bData: PointData) {
            const a = { x: aData.get("x"), y: aData.get("y") };
            const b = { x: bData.get("x"), y: bData.get("y") };
            
            const _a = x >= a.x - 2 && x <= b.x + 2 || x >= b.x - 2 && x <= a.x + 2;
            const _b = y >= a.y - 2 && y <= b.y + 2 || y >= b.y - 2 && y <= a.y + 2;

            if (!(_a && _b)) return false;

            return dist2d(x, y, a.x, a.y, b.x, b.y) < 5
        }

        for (let i = 0; i < this.points.length - 1; i++) {
            if (segmentContains(this.points.get(i), this.points.get(i + 1))) return true;

        }

        return false;

        function dist2d(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
            let v1 = [x2 - x1, y2 - y1];
            let v2 = [x - x1, y - y1];
            let m = [v1, v2];
            let d = Math.abs(m[0][0] * m[1][1] - m[0][1] * m[1][0]) / Math.sqrt(Math.pow(v1[0], 2) + Math.pow(v1[1], 2));
            return d;
        }
    }

    update() {
        super.update();
        this.updateDisplayObject();
    }

    override onPropertiesChanged() {
        this.redraw();
    }
    
    override onSelected() {
        this.redraw()
    }

    override onDeselected() {
        this.redraw()
    }

    override onFocused() {
        this.showControls();
    }

    override onBlurred() {
        this.hideControls()
    }

    remove(): void {
        this.hideControls();
        this.canvas.removeChild(this.line)
        this.canvas.removeChild(this.startArrowHead)
    }

    startInteractiveMove(selection: { has: (key: string) => boolean }) {
        this.hideControls()
        return {
            move: (dx: number, dy: number) => {
                if (this.anchor1) {
                    if (selection.has(this.anchor1.key))
                        this.suppressAnchor1 = true;
                    else
                        this.data.set('anchor1', undefined)
                }
                if (this.anchor2) {
                    if (selection.has(this.anchor2.key))
                        this.suppressAnchor2 = true;
                    else
                        this.data.set('anchor2', undefined)
                }

                this.relativeMove(dx, dy);
                this.redraw()
            },
            endMove: () => {
                this.suppressAnchor1 = false;
                this.suppressAnchor2 = false;
                this.focused && this.showControls()
            }
        };
    }

    private relativeMove(dx: number, dy: number) {
        this.mutatePoints(points => points.forEach(p => { 
            p.set("x", p.get("x") + dx);
            p.set("y", p.get("y") + dy);
        }))
        this.updateDisplayObject();
    }

    align(p: { left?: number | undefined; right?: number; top?: number; bottom?: number }): boolean {
        if (this.anchor1 || this.anchor2)
            return false;

        let dx = 0;
        let dy = 0;
        if (p.left !== undefined)
            dx = p.left - this.bounds.left;
        else if (p.right !== undefined)
            dx = p.right - this.bounds.right

        if (p.top !== undefined)
            dy = p.top - this.bounds.top;
        else if (p.bottom !== undefined)
            dy = p.bottom - this.bounds.bottom

        this.relativeMove(dx, dy);
        return true;
    }

    absoluteMovePoint(pointIndex: number, x: number, y: number) {
        this.mutatePoints(p => {
            p.get(pointIndex).set("x", x);
            p.get(pointIndex).set("y", y);
        })
        this.updateDisplayObject();
    }


    private mutatePoints(a: (points: YArray<PointData>) => void) {
        this.points.doc?.transact(() => {
            a(this.points);
        })
        this._bounds = undefined;
    }

    private showControls() {
        if (this.controlsVisible) return;
        this.canvas.addChild(...this.pointHandles)
        this.canvas.addChild(...this.midpointHandles)
        this.controlsVisible = true;
        this.moveControls()
    }

    private updateDisplayObject() {
        this.redraw();
        this.moveControls()
    }

    private moveControls() {
        if (!this.controlsVisible)
            return;

        if (this.pointHandles.length != this.points.length || this.midpointHandles.length != this.points.length - 1)
            this.recreateControls()

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points.get(i);

            const h = this.pointHandles[i];
            h.x = p.get("x");
            h.y = p.get("y");
        }

        for (let i = 0; i < this.points.length - 1; i++) {
            const p = { x: this.points.get(i).get("x"), y: this.points.get(i).get("y") }
            const q = { x: this.points.get(i + 1).get("x"), y: this.points.get(i + 1).get("y") }

            const h = this.midpointHandles[i];
            h.x = p.x + (q.x - p.x) / 2;
            h.y = p.y + (q.y - p.y) / 2;
        }

    }

    private hideControls() {
        if (!this.controlsVisible) return;
        this.canvas.removeChild(...this.pointHandles)
        this.canvas.removeChild(...this.midpointHandles)
        this.controlsVisible = false;
    }

    private recreateControls() {
        const controlsVisible = this.controlsVisible;
        this.hideControls()
        this.pointHandles.splice(0, this.pointHandles.length, ...this.createPointHandles())
        this.midpointHandles.splice(0, this.midpointHandles.length, ...this.createMidpointHandles())
        controlsVisible && this.showControls()
    }

    private createPointHandles() {
        return this.points.map((p, i) => this.createPointHandle(i))
    }

    private createPointHandle(pointIndex: number) {

        const h = new Graphics();
        h.eventMode = 'static';
        h.cursor = "move"
        h.hitArea = new Circle(0, 0, 10)
        h.lineStyle({width: 1, color: 'blue', alpha: 1})
        h.drawCircle(0, 0, 10);
        h.on('pointerdown', e => {
            e.stopPropagation()
            this.handlePointHandleMove(pointIndex, e);
        })

        h.on('click', e => {
            if (pointIndex !== this.startPointIndex && pointIndex !== this.endPointIndex && e.detail === 2) {
                e.stopImmediatePropagation()
                this.points.delete(pointIndex);
                this.redraw()
                this.moveControls()
            }
        });

        return h;
    }

    private createMidpointHandles() {
        const handles: Graphics[] = []
        for (let i = 1; i < this.points.length; i++) {
            handles.push(this.createMidpointHandle(i));
        }
        return handles;
    }

    private createMidpointHandle(i: number) {
        const h = new Graphics();
        h.eventMode = 'static';
        h.cursor = "move"
        h.hitArea = new Circle(0, 0, 8)
        h.lineStyle({width: 1, color: 'blue', alpha: 1})
        h.beginFill('blue')
        h.drawCircle(0, 0, 8);
        h.endFill()
        h.on('pointerdown', e => {
            e.stopPropagation()
            this.points.insert(i, [createPointData(e.x, e.y)])
            this.handlePointHandleMove(i, e)
        })
        return h;
    }

    handlePointHandleMove(pointIndex: number, e: FederatedPointerEvent) {
        const prevPoint = pointIndex > this.startPointIndex && { x: this.points.get(pointIndex - 1).get("x"), y: this.points.get(pointIndex - 1).get("y") };
        const nextPoint = pointIndex < this.endPointIndex && { x: this.points.get(pointIndex + 1).get("x"), y: this.points.get(pointIndex + 1).get("y") };

        const controlsVisible = this.controlsVisible;
        this.board.trackPointerMove(e, {
            moveBegin: e => this.hideControls(),
            move: (e, x, y) => {
                let c = {x, y}
                if (pointIndex === this.startPointIndex || pointIndex === this.endPointIndex) {
                    c = this.snapPointToAnchor(c, pointIndex);
                }
                for (const p of [prevPoint, nextPoint]) {
                    if (!p) continue;
                    c = snapPointToPoint(c, p)
                }
                this.absoluteMovePoint(pointIndex, c.x, c.y);
            },
            moveEnd: e => {
                controlsVisible && this.showControls();
            }
        })
    }

    private calculateBounds() {
        return [...this.points].reduce((bounds, p) => ({
            top: Math.min(bounds.top, p.get("y")),
            left: Math.min(bounds.left, p.get("x")),
            bottom: Math.max(bounds.bottom, p.get("y")),
            right: Math.max(bounds.right, p.get("x"))
        }), {
            top: Number.MAX_VALUE,
            left: Number.MAX_VALUE,
            bottom: Number.MIN_VALUE,
            right: Number.MIN_VALUE
        });
    }

    private snapPointToAnchor(c: Point2D, pointIndex: number) {
        if (pointIndex !== this.startPointIndex && pointIndex !== this.endPointIndex)
            throw Error("Only start or end point can be snapped to anchors")

        const anchor = this.board.getAnchorCandidate(c.x, c.y);
        if (anchor) {
            const snapPoint = anchor.element.getAnchorPoint(anchor.position);
            if (pointIndex === this.startPointIndex)
                this.data.set('anchor1', {key: anchor.element.key, position: anchor.position})
            if (pointIndex === this.endPointIndex)
                this.data.set('anchor2', {key: anchor.element.key, position: anchor.position})
            return snapPoint;
        } else {
            if (pointIndex === this.startPointIndex && this.anchor1)
                this.data.set('anchor1', undefined)
            if (pointIndex === this.endPointIndex && this.anchor2)
                this.data.set('anchor2', undefined)
            return c;
        }
    }

    protected parseProperties(rawProperties: string): Props {
        let lineType : LineType = 'solid';
        let startArrowHead: ArrowheadType = 'none';
        let endArrowHead: ArrowheadType = 'none';
        let startMultiplicity = "";
        let endMultiplicity = "";
        
        const lineTypeLookup : { [k: string] : LineType } = {
            '-': 'solid',
            '.': 'dashed',
            '..': 'dotted'
        }
        
        const startArrowHeadLookup : { [k: string] : ArrowheadType } = {
            '>': 'arrow',
            '>>': 'triangle'
        }
        
        const endArrowHeadLookup : { [k: string] : ArrowheadType } = {
            '<': 'arrow',
            '<<': 'triangle'
        }
        
        const ltRegex = /lt=(?<endArrowHead>[<]{0,2})(?<lineType>-|\.{1,2})(?<startArrowHead>[>]{0,2})/g;
        const ltMatch = ltRegex.exec(rawProperties)
        if (ltMatch) {
            startArrowHead = startArrowHeadLookup[ltMatch.groups?.startArrowHead ?? '>'];
            lineType = lineTypeLookup[ltMatch.groups?.lineType ?? '-'];
            endArrowHead = endArrowHeadLookup[ltMatch.groups?.endArrowHead ?? '<'];
        }

        const m1Regex = /m1=(?<multiplicity1>.+)/g;
        const m1Match = m1Regex.exec(rawProperties)
        if (m1Match) {
            startMultiplicity = m1Match.groups?.multiplicity1 ?? "";
        }

        const m2Regex = /m2=(?<multiplicity1>.+)/g;
        const m2Match = m2Regex.exec(rawProperties)
        if (m2Match) {
            endMultiplicity = m2Match.groups?.multiplicity1 ?? "";
        }

        return {
            lineType,
            startArrowheadType: startArrowHead,
            endArrowheadType: endArrowHead,
            startMultiplicity: startMultiplicity,
            endMultiplicity: endMultiplicity
        }
    }
}