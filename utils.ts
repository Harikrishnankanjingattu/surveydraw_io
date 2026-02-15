
import { Point } from './types';

export const calculateArea = (p1: Point, p2: Point, p3: Point): number => {
  // Area = |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)| / 2
  return Math.abs(
    p1.x * (p2.y - p3.y) +
    p2.x * (p3.y - p1.y) +
    p3.x * (p1.y - p2.y)
  ) / 2;
};

export const calculateDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getMidpoint = (p1: Point, p2: Point): { x: number; y: number } => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

export const generateId = (prefix: string, count: number): string => {
  return `${prefix}${count + 1}`;
};

export const worldToCanvas = (
  wx: number,
  wy: number,
  offset: { x: number, y: number },
  scale: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  return {
    x: canvasWidth / 2 + (wx + offset.x) * scale,
    y: canvasHeight / 2 - (wy + offset.y) * scale, // Cartesian flip
  };
};

export const canvasToWorld = (
  cx: number,
  cy: number,
  offset: { x: number, y: number },
  scale: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  return {
    x: (cx - canvasWidth / 2) / scale - offset.x,
    y: (canvasHeight / 2 - cy) / scale - offset.y,
  };
};

export const getSheetDimensions = (mode: string): { w: number, h: number } => {
  if (mode === 'A4_PORTRAIT') return { w: 21, h: 29.7 };
  if (mode === 'A4_LANDSCAPE') return { w: 29.7, h: 21 };
  if (mode === 'A6_PORTRAIT') return { w: 10.5, h: 14.8 };
  if (mode === 'A6_LANDSCAPE') return { w: 14.8, h: 10.5 };
  return { w: Infinity, h: Infinity };
};

export const clampPointToSheet = (x: number, y: number, mode: string) => {
  const { w, h } = getSheetDimensions(mode);
  if (w === Infinity) return { x, y };
  return {
    x: Math.max(-w / 2, Math.min(w / 2, x)),
    y: Math.max(-h / 2, Math.min(h / 2, y))
  };
};

export const rotatePoint = (px: number, py: number, cx: number, cy: number, angleDegrees: number): { x: number, y: number } => {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;

  return {
    x: cx + (dx * cos - dy * sin),
    y: cy + (dx * sin + dy * cos)
  };
};

export const calculateSSSVertex = (p1: { x: number, y: number }, p2: { x: number, y: number }, b: number, c: number, side: number = 1): { x: number, y: number } | null => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const a = Math.sqrt(dx * dx + dy * dy);

  if (a === 0 || b + c < a || Math.abs(b - c) > a) return null;

  const cosA = Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  const ux = dx / a;
  const uy = dy / a;

  // Use 'side' to determine which way the vertex points (1 or -1)
  return {
    x: p1.x + b * (ux * cosA - (uy * sinA * side)),
    y: p1.y + b * (ux * sinA * side + uy * cosA)
  };
};

export const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const clampPointWithDirection = (x0: number, y0: number, x1: number, y1: number, mode: string) => {
  const { w, h } = getSheetDimensions(mode);
  if (w === Infinity) return { x: x1, y: y1 };

  const xMin = -w / 2, xMax = w / 2;
  const yMin = -h / 2, yMax = h / 2;

  // If inside, no clamping
  if (x1 >= xMin && x1 <= xMax && y1 >= yMin && y1 <= yMax) {
    return { x: x1, y: y1 };
  }

  const dx = x1 - x0;
  const dy = y1 - y0;

  let tMinX = Infinity, tMinY = Infinity;
  let tMaxX = Infinity, tMaxY = Infinity;

  if (dx > 0) tMaxX = (xMax - x0) / dx;
  else if (dx < 0) tMinX = (xMin - x0) / dx;

  if (dy > 0) tMaxY = (yMax - y0) / dy;
  else if (dy < 0) tMinY = (yMin - y0) / dy;

  const t = Math.min(tMinX, tMaxX, tMinY, tMaxY);

  // Intersection point
  return {
    x: x0 + t * dx,
    y: y0 + t * dy
  };
};
