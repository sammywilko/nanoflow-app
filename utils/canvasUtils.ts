
import { Point, ViewState, CanvasItem, Size } from "../types";

export const screenToWorld = (screenPoint: Point, viewState: ViewState): Point => {
  return {
    x: (screenPoint.x - viewState.x) / viewState.scale,
    y: (screenPoint.y - viewState.y) / viewState.scale,
  };
};

export const worldToScreen = (worldPoint: Point, viewState: ViewState): Point => {
  return {
    x: worldPoint.x * viewState.scale + viewState.x,
    y: worldPoint.y * viewState.scale + viewState.y,
  };
};

export const getSmartPosition = (index: number, total: number, category?: string): Point => {
  // Deterministic grid layout to allow concurrent generation without overlaps
  const spacingX = 500; // Wide enough for 16:9
  const spacingY = 400; 
  const cols = 4; // Fixed columns for predictability
  
  const col = index % cols;
  const row = Math.floor(index / cols);

  // Position relative to a center start point
  return {
    x: col * spacingX,
    y: row * spacingY,
  };
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const isIntersecting = (box: {x: number, y: number, w: number, h: number}, item: CanvasItem): boolean => {
  const itemLeft = item.position.x - item.size.width / 2;
  const itemRight = item.position.x + item.size.width / 2;
  const itemTop = item.position.y - item.size.height / 2;
  const itemBottom = item.position.y + item.size.height / 2;

  const boxLeft = Math.min(box.x, box.x + box.w);
  const boxRight = Math.max(box.x, box.x + box.w);
  const boxTop = Math.min(box.y, box.y + box.h);
  const boxBottom = Math.max(box.y, box.y + box.h);

  return !(boxRight < itemLeft || 
           boxLeft > itemRight || 
           boxBottom < itemTop || 
           boxTop > itemBottom);
};
