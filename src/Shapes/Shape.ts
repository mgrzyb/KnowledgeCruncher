import {Container, DisplayObject} from "pixi.js";
import {Board} from "../Board";
import {ShapeData} from "../ShapeData";
import {Bounds2D, Point2D} from "../types";
import {Text as YText} from "yjs";

export interface Shape {
    get key(): string;
    get data(): ShapeData;
    get rawProperties() : YText
    get bounds(): Bounds2D;
    get displayObject(): DisplayObject;

    getSnapPosition(x: number, y: number): number | undefined;
    getAnchorPoint(position: number): Point2D;


    focus(): void;
    blur(): void;
    select(): void;
    deselect(): void;

    align(p: { left?: number | undefined; right?: number; top?: number; bottom?: number }) : boolean

    startInteractiveMove(selection: { has: (key: string) => boolean }) : { move: (dx: number, dy: number)=>void, endMove: () => void }

    remove(): void;

    
    update(): void;
}

export abstract class ShapeBase<TData extends ShapeData, TProperties> {

    get key() {
        return this.data.get("key");
    }

    get rawProperties() {
        return this.data.get("properties");
    }

    private _properties: TProperties | undefined;
    get properties() {
        if (!this._properties) {
            this._properties = this.parseProperties(this.rawProperties.toString());
        }
        return this._properties;
    }
    
    get data() { return this._data; }
    
    private _focused: boolean = false;
    protected get focused() { return this._focused; }
    
    private _selected: boolean = false;
    protected get selected() { return this._selected; }

    abstract get displayObject(): DisplayObject;
    
    protected constructor(protected readonly board: Board, protected readonly canvas: Container, private readonly _data: TData) {
        this.rawProperties.observe(e => {
            if (e.transaction.local) {
                this._properties = undefined;
                this.onPropertiesChanged();
            }
        })
    }

    move(dx: number, dy: number) {
    }

    select() {
        this._selected = true;
        this.onSelected();
    };

    deselect() {
        this._selected = false;
        this.onDeselected();
    }

    focus(): void {
        this._focused = true;
        this.onFocused();
    }

    blur(): void {
        this._focused = false;
        this.onBlurred();
    }

    update() {
    }

    getSnapPosition(x: number, y: number): number | undefined {
        return undefined;
    }

    getAnchorPoint(position: number): { x: number; y: number } {
        return {x: this.displayObject.x, y: this.displayObject.y}
    }

    protected onSelected() {
        
    }

    protected onDeselected() {
        
    }

    protected onFocused() {
        
    }

    protected onBlurred() {
        
    }

    protected onPropertiesChanged() {
        
    }

    protected abstract parseProperties(rawProperties: string) : TProperties;
}