import * as Y from "yjs";
import {nanoid} from "nanoid";
import {Array as YArray} from "yjs";
import {Point2D} from "./types";

export type ShapeData = (ClassData | AssociationData)

interface CommonShapeData extends Pick<Y.Map<any>, 'doc'> {
}

export interface ClassData extends CommonShapeData {
    get(kind: 'kind'): 'class'

    get(key: 'key'): string

    get(k: 'position'): Point2D;

    get(k: 'properties'): Y.Text

    set(k: 'position', v: Point2D) : void

    set(k: 'content'): Y.Text
}

export interface PointData {
    get(k: 'x' | 'y'): number
    set(k: 'x' | 'y', v: number): void
}

export interface AssociationData extends CommonShapeData {
    get(kind: 'kind'): 'association'

    get(key: 'key'): string

    get(k: 'points'): YArray<PointData>;
    
    get(k: 'anchor1' | 'anchor2'): {  key: string, position: number } | undefined

    get(k: 'properties'): Y.Text;
    
    set(k: 'anchor1' | 'anchor2', v: {  key: string, position: number } | undefined): void
}

export function createPointData(x: number, y: number): PointData {
    return new Y.Map([[ 'x', x ], [ 'y', y ]]) as unknown as PointData;
}

export function createClassData(position: Point2D, properties: string): ClassData {
    return new Y.Map([
        ['key', nanoid(4)],
        ['kind', 'class'],
        ['position', position],
        ['properties', new Y.Text(properties)]
    ]) as unknown as ClassData;
}

export function createAssociationData(start: Point2D, end: Point2D, anchor1?: {
    key: string,
    position: number
}, anchor2?: {
    key: string,
    position: number
}): AssociationData {
    return new Y.Map([
        ['key', nanoid(4)],
        ['kind', 'association'],
        ['points', YArray.from([createPointData(start.x, start.y), createPointData(end.x, end.y)])],
        ['anchor1', anchor1],
        ['anchor2', anchor2],
        ['properties', new Y.Text('lt=->')]
    ]) as unknown as AssociationData;
}

export function isClassData(e: ShapeData): e is ClassData {
    return e.get('kind') === 'class';
}

export function isAssociationData(e: ShapeData): e is ClassData {
    return e.get('kind') === 'association';
}

export function matchShapeData<T, T1 extends T, T2 extends T>(e: ShapeData, cases: {
    class?: (e: ClassData) => T1,
    association?: (e: AssociationData) => T2
}) {
    if (isClassData(e))
        return cases.class?.(e)
    else if (isAssociationData(e))
        return cases.association?.(e)
}
