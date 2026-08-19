// Stub declaration so TypeScript can resolve the implicit type library
// referenced by expo-location's type definitions. The actual @mapbox/point-geometry
// package is not used at runtime in this app.
declare module '@mapbox/point-geometry' {
  export default class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
    clone(): Point;
    add(p: Point): Point;
    sub(p: Point): Point;
    multByPoint(p: Point): Point;
    divByPoint(p: Point): Point;
    mult(k: number): Point;
    div(k: number): Point;
    rotate(a: number): Point;
    rotateAround(a: number, p: Point): Point;
    matMult(m: number[]): Point;
    unit(): Point;
    perp(): Point;
    reflect(r: Point): Point;
    angle(): number;
    angleTo(b: Point): number;
    angleWith(b: Point): number;
    angleWithSep(x: number, y: number): number;
    mag(): number;
    equals(other: Point): boolean;
    distSqr(p: Point): number;
    dist(p: Point): number;
    static convert(a: [number, number] | { x: number; y: number } | Point): Point;
  }
}
