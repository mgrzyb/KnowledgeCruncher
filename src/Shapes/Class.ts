import {Circle, Container, Graphics, Rectangle, Text} from "pixi.js";
import {Board} from "../Board";
import {ClassData} from "../ShapeData";
import {Shape, ShapeBase} from "./Shape";
import {Bounds2D, Point2D} from "../types";

interface Props { 
    title: string;
    members: string 
}

export class Class extends ShapeBase<ClassData, Props> implements Shape {

    get position() { return this.data.get("position") }

    private set position(v) {
        this.data.set("position", v)
        this.updateDisplayObject();
    }

    private _bounds: Bounds2D | undefined;
    get bounds() {
        if (!this._bounds) {
            this._bounds = this.calculateBounds();
        }
        return this._bounds;
    }

    get width() {
        return Math.max(this.title.width, this.members.width, 100) + 20;
    }

    get height() {
        return Math.max(35,
            (this.title.text ? 5 + this.title.height + 5: 0) + 
            (this.members.text ? 5 + this.members.height + 5 : 0)
        );
    }

    get displayObject() {
        return this.displayContainer;
    }

    private readonly displayContainer = new Container();

    private readonly border = new Graphics();
    private readonly title = new Text();
    private readonly members = new Text();
    private readonly wAssociationHandle: Graphics;

    private readonly eAssociationHandle: Graphics;
    private readonly sAssociationHandle: Graphics;
    private readonly nAssociationHandle: Graphics;
    
    constructor(board: Board, canvas: Container, data: ClassData, private readonly onBoundsChanged: (shape: Shape) => void) {
        super(board, canvas, data);

        this.displayContainer.eventMode = 'static';
        this.canvas.addChild(this.displayContainer)

        this.displayContainer.addChild(this.border)

        this.title.style.fontSize = 14;
        this.title.anchor.set(0.5, 0);
        this.displayContainer.addChild(this.title)

        this.members.style.fontSize = 14;
        this.members.x = 10;
        this.displayContainer.addChild(this.members);

        this.wAssociationHandle = this.createAssociationHandle(0.5);
        this.nAssociationHandle = this.createAssociationHandle(1.5);
        this.eAssociationHandle = this.createAssociationHandle(2.5);
        this.sAssociationHandle = this.createAssociationHandle(3.5);

        this.update()
    }


    update() {
        super.update();
        this.updateDisplayObject();
    }
    
    protected onPropertiesChanged() {
        this.updateDisplayObject()
        this.onBoundsChanged(this);
    }

    remove(): void {
        this.hideControls();
        this.canvas.removeChild(this.displayContainer)
    }

    startInteractiveMove() {
        return {
            move: (dx: number, dy: number) => {
                this.hideControls();
                this.relativeMove(dx, dy);
            },
            endMove: () => {
                this.focused && this.showControls()
            }
        };
    }

    align(p: { left?: number | undefined; right?: number; top?: number; bottom?: number }): boolean {
        let x = this.position.x;
        let y = this.position.y;

        if (p.left !== undefined)
            x = p.left;
        else if (p.right !== undefined)
            x = p.right - this.width

        if (p.top != undefined)
            y = p.top;
        else if (p.bottom != undefined)
            y = p.bottom - this.height

        if (this.position.x != x || this.position.y != y) {
            this.position = {x, y}
            return true;
        }

        return false;
    }

    override onSelected() {
        this.title.style.fill = "blue";
        this.members.style.fill = "blue";
        this.redrawBorder()
    }

    protected override onDeselected() {
        this.title.style.fill = "black";
        this.members.style.fill = "black";
        this.redrawBorder()
    }

    protected override onFocused() {
        this.showControls();
    }

    protected override onBlurred() {
        this.hideControls()
    }

    getAnchorPoint(position: number) {
        const {x, y} = this.position;

        if (position < 1)
            return {x, y: y + (this.height * position)};
        if (position < 2)
            return {x: x + this.width * (position - 1), y};
        if (position < 3)
            return {x: x + this.width, y: y + (this.height * (position - 2))};
        return {x: x + this.width * (position - 3), y: y + this.height};
    }

    getSnapPosition(px: number, py: number): number | undefined {
        const {x, y} = this.position;

        if (py > y && py < y + this.height && Math.abs(px - x) < 5) {
            return (py - y) / this.height
        } else if (px > x && px < x + this.width && Math.abs(py - y) < 5) {
            return 1 + (px - x) / this.width
        } else if (py > y && py < y + this.height && Math.abs(px - (x + this.width)) < 5) {
            return 2 + (py - y) / this.height
        } else if (px > x && px < x + this.width && Math.abs(py - (y + this.height)) < 5) {
            return 3 + (px - x) / this.width
        }
    }

    private showControls() {
        this.canvas.addChild(this.wAssociationHandle);
        this.canvas.addChild(this.nAssociationHandle);
        this.canvas.addChild(this.eAssociationHandle);
        this.canvas.addChild(this.sAssociationHandle);
    }

    private hideControls() {
        this.canvas.removeChild(this.wAssociationHandle);
        this.canvas.removeChild(this.nAssociationHandle);
        this.canvas.removeChild(this.eAssociationHandle);
        this.canvas.removeChild(this.sAssociationHandle);
    }

    private updateDisplayObject() {
        this._bounds = undefined;

        // Update the texts first as they are used in calculating bounds
        this.title.text = this.properties.title;
        this.members.text = this.properties.members;

        this.displayContainer.x = this.position.x
        this.displayContainer.y = this.position.y
        this.displayContainer.hitArea = new Rectangle(0, 0, this.width, this.height)

        this.title.x = this.width / 2;
        this.title.y = 5;

        this.members.y = this.title.y + this.title.height + 10;

        this.redrawBorder()
        this.moveControls()
    }

    private redrawBorder() {
        const color = this.selected ? "blue" : "black";

        this.border.clear();
        this.border.lineStyle({width: 1, color: color, alpha: 1})
        this.border.drawRect(0, 0, this.width, this.height)

        if (this.members.text) {
            this.border.moveTo(0, this.title.height + 10)
            this.border.lineTo(this.width, this.title.height + 10)
        }

    }

    private moveControls() {
        this.wAssociationHandle.x = this.displayContainer.x - 15;
        this.wAssociationHandle.y = this.displayContainer.y + this.height / 2;
        this.nAssociationHandle.x = this.displayContainer.x + this.width / 2;
        this.nAssociationHandle.y = this.displayContainer.y - 15;
        this.eAssociationHandle.x = this.displayContainer.x + this.width + 15;
        this.eAssociationHandle.y = this.displayContainer.y + this.height / 2;
        this.sAssociationHandle.x = this.displayContainer.x + this.width / 2;
        this.sAssociationHandle.y = this.displayContainer.y + this.height + 15;
    }

    protected override parseProperties(properties: string) {
        const props = properties.split("\n").reverse()

        const title: string[] = []
        const members: string[] = []

        let parsingMembers = false;
        let p: string | undefined
        while ((p = props.pop()) !== undefined) {
            if (p == "-" || p.startsWith("--")) {
                parsingMembers = true;
                continue;
            }

            if (parsingMembers) {
                members.push(p)
            } else {
                title.push(p)
            }
        }
        return {title: title.join("\n"), members: members.join("\n")};
    }

    private relativeMove(dx: number, dy: number) {
        this.position = {x: this.displayContainer.x + dx, y: this.displayContainer.y + dy}
        this.onBoundsChanged(this);
    }

    private createAssociationHandle(anchorPosition: number) {
        const handle = new Graphics()
        handle.lineStyle({width: 1, color: "blue", alpha: 1})
        handle.beginFill('blue')
        handle.drawCircle(0, 0, 6);
        handle.endFill()
        handle.eventMode = 'static';
        handle.cursor = 'pointer';
        handle.hitArea = new Circle(0, 0, 6)
        handle.on('pointerdown', e => {
            e.stopPropagation()
            this.board.discardSelection()
            const anchorPoint = this.getAnchorPoint(anchorPosition);
            const a = this.board.addAssociation(
                {x: anchorPoint.x, y: anchorPoint.y},
                {x: e.x, y: e.y},
                {
                    key: this.key,
                    position: anchorPosition
                });
            this.board.focus(a)
            a.handlePointHandleMove(1, e)
        })
        return handle;
    }

    private calculateBounds() {
        const p = this.position;
        return {
            top: p.y,
            left: p.x,
            right: p.x + this.width,
            bottom: p.y + this.height
        }
    }
}