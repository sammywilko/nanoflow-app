

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum ItemType {
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  PALETTE = 'PALETTE',
  NOTE = 'NOTE',
}

export enum CompositionRole {
  NONE = 'NONE',
  BLOCKING = 'BLOCKING',
  CHARACTER = 'CHARACTER',
  BACKGROUND = 'BACKGROUND',
}

export interface PaletteData {
  colors: string[];
  name?: string;
}

export interface CanvasItem {
  id: string;
  type: ItemType;
  position: Point;
  size: Size;
  content: string; // URL/Base64 for Image, Text content for Text
  metadata?: {
    tags?: string[];
    palette?: string[];
    originalPrompt?: string;
    description?: string;
    role?: CompositionRole;
    roleDescription?: string;
  };
  zIndex: number;
  selected?: boolean;
  groupId?: string; 
  locked?: boolean;
}

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export interface ShotConcept {
  id: string;
  title: string; // e.g., "Hero Shot"
  description: string; // "A wide angle shot of..."
  status: 'pending' | 'generating' | 'done';
}

export interface ProjectPlan {
  themeName: string;
  palette: string[];
  styleKeywords: string[];
  shots: ShotConcept[];
}

export interface AnalysisResponse {
  colors: string[];
  keywords: string[];
  description: string;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}