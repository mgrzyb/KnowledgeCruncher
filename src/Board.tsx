import {
    AssociationData,
    ClassData,
    createAssociationData,
    createClassData,
    matchShapeData,
    ShapeData
} from "./ShapeData"
import {Application, Container, FederatedPointerEvent, Graphics, Rectangle} from "pixi.js";
import * as Y from "yjs";
import {Transaction, UndoManager, YEvent} from "yjs";
import {Event, IEvent} from "./Event"
import {Association} from "./Shapes/Association";
import {Class} from "./Shapes/Class";
import {Shape} from "./Shapes/Shape";
import {Bounds2D, Point2D} from "./types";
import {Awareness} from "y-protocols/awareness";
import {User} from "./User";

export class Board {

    private users = new Map<number, User>;
    private shapes: Map<ShapeData, Shape> = new Map<ShapeData, Shape>()

    private readonly canvas = new Container();
    private readonly selectionLayer = new Container();
    private readonly awarenessLayer = new Container();
    
    private readonly _shapeBoundsChanged = new Event<[Shape]>();
    get shapeBoundsChanged() : IEvent<[Shape]> { return this._shapeBoundsChanged }

    private _focusedShape: Shape | undefined;
    get focusedShape() { return this._focusedShape }
    
    private _selection = new Set<Shape>();
    get selection() { return this._selection; }

    private readonly _selectionChanged = new Event<[Set<Shape>, Shape | undefined]>();
    get selectionChanged() : IEvent<[Set<Shape>, Shape | undefined]> { return this._selectionChanged; }

    constructor(private readonly pixiApp: Application, private readonly shapeData: Y.Array<ShapeData>, private readonly awareness: Awareness ) {
        this.adaptShapes();
        this.adaptUsers();

        this.pixiApp.stage.eventMode = 'static'
        this.pixiApp.stage.hitArea = this.pixiApp.screen;
        this.pixiApp.stage.on('click', e => {
            if (e.detail === 2) {
                const c = this.addClass(e.x, e.y, "SimpleClass");
                this.focus(c);
            }
        })
        
        this.pixiApp.stage.on('pointermove', e => {
            this.awareness.setLocalStateField('cursor', this.toCanvasCoordinates(e));
        });
        
        this.pixiApp.stage.on('pointerdown', e => {
            if (e.button === 0) {
                this.discardSelection();

                const selectionGraphics = new Graphics();
                this.selectionLayer.addChild(selectionGraphics);

                const originX = e.x;
                const originY = e.y;
                this.trackPointerMove(e, {
                    move: (e) => {
                        const minX = Math.min(originX, e.x);
                        const minY = Math.min(originY, e.y);

                        selectionGraphics.clear();
                        selectionGraphics.beginFill("blue", 0.5)
                        selectionGraphics.drawRect(minX, minY, Math.abs(e.x - originX), Math.abs(e.y - originY))
                        selectionGraphics.endFill()
                    },
                    moveEnd: (e) => {
                        this.selectionLayer.removeChild(selectionGraphics)
                        const selectionOrigin = this.toCanvasCoordinates({x: Math.min(originX, e.x), y: Math.min(originY, e.y)});
                        const selectionRect = new Rectangle(
                            selectionOrigin.x,
                            selectionOrigin.y,
                            Math.abs(e.x - originX)/this.canvas.scale.x, 
                            Math.abs(e.y - originY)/this.canvas.scale.y);
                        this
                            .addToSelection(...[...this.shapes.values()]
                            .filter(s => selectionRect.intersects(new Rectangle(s.bounds.left, s.bounds.top, s.bounds.right-s.bounds.left+1, s.bounds.bottom - s.bounds.top+1))));
                    }
                })
            }
        })

        this.pixiApp.stage.on('rightdown', e => {
            this.trackPointerMove(e, {
                screenRelativeMove: (dx, dy) => this.translateCanvas(dx, dy)
            })
        })

        this.pixiApp.stage.on('wheel', e => {
            this.zoomCanvas(e.deltaY < 0 ? 0.1 : -0.1, e.client);
        })        
        
        this.pixiApp.stage.addChild(this.canvas)
        this.pixiApp.stage.addChild(this.selectionLayer);
        this.pixiApp.stage.addChild(this.awarenessLayer);
    }

    private zoomCanvas(factor: number, focusPoint: Point2D) {
        const originalScale = this.canvas.scale.x;
        const newScale = originalScale + factor;
        if (newScale >= 0.3 && newScale <= 2) {
            this.canvas.scale.set(newScale, newScale);
            this.translateCanvas(
                -(focusPoint.x - this.canvas.x) * factor / originalScale, 
                -(focusPoint.y - this.canvas.y) * factor / originalScale)
        }         
    }

    private adaptUsers() {
        for (const [clientId, state] of this.awareness.getStates()) {
            if (clientId === this.awareness.clientID)
                continue;

            this.users.set(clientId, new User(this, this.awarenessLayer, clientId, state as { cursor: Point2D }))
        }

        this.awareness.on('change', ({added, updated, removed}: {
            added: number[],
            updated: number[],
            removed: number[]
        }) => {

            for (const clientId of added) {
                const state = this.awareness.getStates().get(clientId) as { cursor: Point2D };
                this.users.set(clientId, new User(this, this.awarenessLayer, clientId, state))
            }

            for (const clientId of updated) {
                const state = this.awareness.getStates().get(clientId) as { cursor: Point2D };
                this.users.get(clientId)?.update(state);
            }

            for (const clientId of removed) {
                this.users.get(clientId)?.remove();
                this.users.delete(clientId);
            }
        })
    }

    private adaptShapes() {
        for (const e of this.shapeData) {
            this.adapt(e)
        }

        const observer = (arg0: Array<YEvent<any>>, arg1: Transaction) => {
            if (arg1.local && !(arg1.origin instanceof UndoManager))
                return;

            console.log("Handling change events: ", arg0.length)

            for (const e of arg0) {
                const path = [...e.path].reverse();
                const pathSegment = path.pop();

                if (!pathSegment) {
                    // List of shapeData changed
                    for (const change of e.changes.deleted) {
                        // @ts-ignore
                        const data = change.content.type as ShapeData;
                        const shape = this.shapes.get(data);
                        shape && this.removeShape(shape, {remote: true});
                    }

                    for (const change of e.changes.added) {
                        // @ts-ignore
                        const data = change.content.type as ShapeData;
                        this.adapt(data)
                    }
                }

                if (pathSegment !== undefined && typeof pathSegment === 'number') {
                    const data = this.shapeData.get(pathSegment);
                    const shape = this.shapes.get(data);
                    shape && shape.update();
                }
            }
        };
        this.shapeData.observeDeep(observer)
    }

    deleteSelection() {
        if (!this.selection.size) return;
        for (const shape of this.selection) {
            this.removeShape(shape)
        }
    }

    addClass(x: number, y: number, title: string) {
        return this.adapt(createClassData({x, y}, title))
    }

    addAssociation(start: Point2D, end: Point2D, anchor1?: {  key: string, position: number }) {
        return this.adapt(createAssociationData(start, end, anchor1))
    }

    discardSelection() {
        const previouslySelected = [...this.selection];
        this._selection.clear()
        for (const s of previouslySelected) {
            s.deselect()
        }
        this._focusedShape?.blur();
        this._focusedShape = undefined;
        
        this._selectionChanged.emit(this.selection, this.focusedShape)
    }

    removeFromSelection(shape: Shape) {
        if (!this._selection.has(shape)) return;
        
        this._selection.delete(shape);
        shape.deselect();
        if (this._focusedShape === shape) {
            shape.blur();
            this._focusedShape = undefined;
        }
        if (this._selection.size === 1) {
            for (const shape of this._selection) {
                this._focusedShape = shape;
                shape.focus();
                break;
            }
        }

        this._selectionChanged.emit(this.selection, this.focusedShape)
    }

    addToSelection(...shapes: Shape[]) {
        for (const s of shapes) {
            if (this._selection.has(s)) continue;

            if (this._focusedShape) {
                this._focusedShape.blur();
                this._focusedShape = undefined;
            }

            this._selection.add(s);
            s.select();
        }
        
        if (this._selection.size === 1) {
            for (const shape of this._selection) {
                this._focusedShape = shape;
                shape.focus();
                break;
            }
        }
    
        this._selectionChanged.emit(this.selection, this.focusedShape)
    }

    selectAll() {
        this.addToSelection(...this.shapes.values())
    }

    focus(shape: Shape) {
        this.discardSelection()
        this.addToSelection(shape);
    }
    
    private adapt(e: ClassData) : Class
    private adapt(e: AssociationData) : Association
    private adapt(e: ShapeData) : Class | Association

    private adapt(e: ShapeData) : Class | Association {
        if (!e.doc)
            this.shapeData.push([e]);
        
        const shape = this.createShape(e);
        if (shape)
        {
            this.shapes.set(e, shape);
            shape?.displayObject.on('pointerdown', e => {
                e.stopPropagation()
                e.stopImmediatePropagation()
                if (e.button === 0) {
                    if (e.ctrlKey) {
                        if (this._selection.has(shape)) {
                            this.removeFromSelection(shape)
                            return;
                        } else {
                            this.addToSelection(shape)
                        }
                    } else if (!this._selection.has(shape)) {
                        this.discardSelection()
                        this.addToSelection(shape)
                    }
                    
                    const selectionKeys = new Set([...this._selection].map(s => s.key));
                    const transactions : [Shape, { move: (dx: number, dy: number)=>void, endMove: () => void }][] = [...this._selection].map(s => [s, s.startInteractiveMove(selectionKeys)]);
                    this.trackPointerMove(e, {
                        canvasRelativeMove: (dx, dy) => {
                            for (const t of transactions) {
                                t[1].move(dx, dy);
                            }
                        },
                        moveEnd: () => {
                            for (const t of transactions) {
                                t[1].endMove();
                            }
                        }
                    })
                }
            })
        }
        
        return shape;
    }

    private translateCanvas(dx: number, dy: number) {
        this.canvas.x += dx;
        this.canvas.y += dy;
    }

    private createShape(e : ShapeData) {
        return matchShapeData(e, {
            class: e => new Class(this, this.canvas, e, (shape) => this._shapeBoundsChanged.emit(shape)),
            association: e => new Association(this, this.canvas, e)
        })!
    }

    private removeShape(shape: Shape, options?: { remote: boolean }) {
        shape && shape.remove();
        this.removeFromSelection(shape)
        this.shapes.delete(shape.data)
        if (!options?.remote) {
            for (let i = 0; i < this.shapeData.length; i++) {
                if (this.shapeData.get(i) === shape.data) {
                    this.shapeData.delete(i);
                    break;
                }
            }
        }
    }

    trackPointerMove(e: FederatedPointerEvent, handlers: 
        {
            moveBegin?: (e: FederatedPointerEvent) => void,
            canvasRelativeMove?: (dx: number, dy: number) => void;
            screenRelativeMove?: (dx: number, dy: number) => void;
            move?: (e: FederatedPointerEvent, x: number, y: number) => void, 
            moveEnd?: (e: FederatedPointerEvent) => void }) {
    
        const upEvent = e.type === "pointerdown" ? "pointerup" : "rightup";
        
        const target = e.target;
        
        let prevX = e.clientX;
        let prevY = e.clientY;
    
        let firstMove = true;
        
        const drag = (e1 : FederatedPointerEvent) => {
            if (firstMove) {
                firstMove = false;
                handlers.moveBegin?.(e1)
            }

            const dx = e1.clientX - prevX;
            const dy = e1.clientY - prevY;
            prevX = e1.clientX;
            prevY = e1.clientY;

            if (handlers.canvasRelativeMove) {
                handlers.canvasRelativeMove(dx / this.canvas.scale.x, dy / this.canvas.scale.y);
            }
            
            if (handlers.screenRelativeMove) {
                handlers.screenRelativeMove(dx, dy);
            }
            
            if (handlers.move) {
                handlers.move(e1, (e1.clientX - this.canvas.x) / this.canvas.scale.x, (e1.clientY - this.canvas.y) / this.canvas.scale.y);
            }
        };

        const endDrag = (e : FederatedPointerEvent) => {
            this.pixiApp.stage.off('pointermovecapture', drag)
            this.pixiApp.stage.off(upEvent+'capture', endDrag)
            this.pixiApp.stage.off(upEvent+'outsidecapture', endDrag)
            handlers.moveEnd?.(e)
        }

        this.pixiApp.stage.hitArea = this.pixiApp.screen;
        this.pixiApp.stage.on('pointermovecapture', drag)
        this.pixiApp.stage.on(upEvent+'capture', endDrag)
        this.pixiApp.stage.on(upEvent+'outsidecapture', endDrag)
    }

    getAnchorCandidate(x: number, y: number) {
        for (const a of this.shapes.values()) {
            const snapPosition = a.getSnapPosition(x, y);
            if (snapPosition) {
                return {
                    element: a,
                    position: snapPosition
                }
            }
        }
    }
    
    alignSelection(p: keyof Bounds2D, v: number) {
        for (const shape of this.selection) {
            if (shape.align({[p]: v}))
                this._shapeBoundsChanged.emit(shape);
        }
    }
    
    alignSelectionLeft() {
        if (this.selection.size < 2)
            return;
        const v = [...this.selection].reduce((min, s)=>Math.min(min, s.bounds.left), Number.MAX_VALUE);
        this.alignSelection('left', v)
    }

    alignSelectionRight() {
        if (this.selection.size < 2)
            return;
        const v = [...this.selection].reduce((max, s)=>Math.max(max, s.bounds.right), Number.MIN_VALUE);
        this.alignSelection('right', v)
    }

    alignSelectionTop() {
        if (this.selection.size < 2)
            return;
        const v = [...this.selection].reduce((min, s)=>Math.min(min, s.bounds.top), Number.MAX_VALUE);
        this.alignSelection('top', v)
    }

    alignSelectionBottom() {
        if (this.selection.size < 2)
            return;
        const v = [...this.selection].reduce((max, s)=>Math.max(max, s.bounds.bottom), Number.MIN_VALUE);
        this.alignSelection('bottom', v)
    }

    fromCanvasCoordinates(p: Point2D) {
        return {
            x: p.x * this.canvas.scale.x + this.canvas.x,
            y: p.y * this.canvas.scale.y + this.canvas.y
        }
    }
    
    toCanvasCoordinates(p: Point2D) {
        return {
            x: (p.x - this.canvas.x) / this.canvas.scale.x,
            y: (p.y - this.canvas.y) / this.canvas.scale.y
        }
    }
}
