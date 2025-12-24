

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

// ============================================
// NODE-BASED WORKFLOW SYSTEM (Weavy-style)
// ============================================

export enum NodeType {
  IMAGE_INPUT = 'IMAGE_INPUT',      // Upload/reference image
  TEXT_INPUT = 'TEXT_INPUT',        // Prompt text
  TEXT_ARRAY_INPUT = 'TEXT_ARRAY_INPUT', // Multiple prompts (one per line)
  GENERATE = 'GENERATE',            // Text → Image
  BATCH_GENERATE = 'BATCH_GENERATE',// Multiple prompts → Multiple images
  STYLE_TRANSFER = 'STYLE_TRANSFER',// Image + Style → Image
  INPAINT = 'INPAINT',              // Image + Mask + Prompt → Image
  UPSCALE = 'UPSCALE',              // Image → 4K Image
  ANALYZE = 'ANALYZE',              // Image → Palette + Keywords
  COMPOSITE = 'COMPOSITE',          // Multiple Images → Merged Image
  COMPARE_GRID = 'COMPARE_GRID',    // Display grid, select winner
  OUTPUT = 'OUTPUT'                 // Display result
}

export type PortType = 'image' | 'text' | 'style' | 'mask' | 'palette' | 'imageArray' | 'textArray';

export interface NodePort {
  id: string;
  name: string;
  type: PortType;
  isInput: boolean;
}

export type NodeStatus = 'idle' | 'running' | 'complete' | 'error';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Point;
  size: Size;
  inputs: NodePort[];
  outputs: NodePort[];
  config: Record<string, any>; // Node-specific settings (aspectRatio, quality, prompt, etc.)
  status: NodeStatus;
  result?: string; // Base64 output for image nodes
  error?: string;  // Error message if status is 'error'
}

export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: NodeConnection[];
  createdAt: number;
  updatedAt: number;
}

// Node factory helpers - defines default ports per node type
export const NODE_DEFINITIONS: Record<NodeType, {
  name: string;
  icon: string;
  inputs: Omit<NodePort, 'id'>[];
  outputs: Omit<NodePort, 'id'>[];
  defaultSize: Size;
  defaultConfig: Record<string, any>;
}> = {
  [NodeType.IMAGE_INPUT]: {
    name: 'Image Input',
    icon: '📷',
    inputs: [],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 200, height: 160 },
    defaultConfig: { imageData: null }
  },
  [NodeType.TEXT_INPUT]: {
    name: 'Prompt',
    icon: '✏️',
    inputs: [],
    outputs: [{ name: 'text', type: 'text', isInput: false }],
    defaultSize: { width: 220, height: 140 },
    defaultConfig: { text: '' }
  },
  [NodeType.TEXT_ARRAY_INPUT]: {
    name: 'Prompt List',
    icon: '📝',
    inputs: [],
    outputs: [{ name: 'prompts', type: 'textArray', isInput: false }],
    defaultSize: { width: 240, height: 200 },
    defaultConfig: { prompts: [''] }
  },
  [NodeType.GENERATE]: {
    name: 'Generate',
    icon: '✨',
    inputs: [
      { name: 'prompt', type: 'text', isInput: true },
      { name: 'reference', type: 'image', isInput: true }
    ],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 220, height: 240 },
    defaultConfig: {
      aspectRatio: '1:1',
      quality: '2K',
      prompt: '',
      sweepEnabled: false,
      sweepAspectRatios: ['1:1'],
      sweepQualities: ['2K'],
      sweepVariables: {}
    }
  },
  [NodeType.BATCH_GENERATE]: {
    name: 'Batch Generate',
    icon: '📦',
    inputs: [
      { name: 'prompts', type: 'textArray', isInput: true }
    ],
    outputs: [{ name: 'images', type: 'imageArray', isInput: false }],
    defaultSize: { width: 280, height: 320 },
    defaultConfig: {
      prompts: [],
      promptText: '',
      useVariables: false,
      variables: {},
      aspectRatio: '1:1',
      quality: '2K',
      parallelLimit: 3
    }
  },
  [NodeType.STYLE_TRANSFER]: {
    name: 'Style Transfer',
    icon: '🎨',
    inputs: [
      { name: 'content', type: 'image', isInput: true },
      { name: 'style', type: 'image', isInput: true }
    ],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 200, height: 180 },
    defaultConfig: {}
  },
  [NodeType.INPAINT]: {
    name: 'Inpaint',
    icon: '🖌️',
    inputs: [
      { name: 'image', type: 'image', isInput: true },
      { name: 'mask', type: 'mask', isInput: true },
      { name: 'prompt', type: 'text', isInput: true }
    ],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 200, height: 200 },
    defaultConfig: { quality: '2K' }
  },
  [NodeType.UPSCALE]: {
    name: 'Upscale',
    icon: '🔍',
    inputs: [{ name: 'image', type: 'image', isInput: true }],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 180, height: 140 },
    defaultConfig: { targetSize: '4K' }
  },
  [NodeType.ANALYZE]: {
    name: 'Analyze',
    icon: '🔬',
    inputs: [{ name: 'image', type: 'image', isInput: true }],
    outputs: [
      { name: 'palette', type: 'palette', isInput: false },
      { name: 'keywords', type: 'text', isInput: false },
      { name: 'description', type: 'text', isInput: false }
    ],
    defaultSize: { width: 200, height: 180 },
    defaultConfig: {}
  },
  [NodeType.COMPOSITE]: {
    name: 'Composite',
    icon: '🧩',
    inputs: [
      { name: 'image1', type: 'image', isInput: true },
      { name: 'image2', type: 'image', isInput: true },
      { name: 'prompt', type: 'text', isInput: true }
    ],
    outputs: [{ name: 'image', type: 'image', isInput: false }],
    defaultSize: { width: 200, height: 200 },
    defaultConfig: {}
  },
  [NodeType.COMPARE_GRID]: {
    name: 'Compare Grid',
    icon: '🏆',
    inputs: [{ name: 'images', type: 'imageArray', isInput: true }],
    outputs: [{ name: 'selected', type: 'image', isInput: false }],
    defaultSize: { width: 400, height: 400 },
    defaultConfig: {
      selectedIndex: null,
      gridColumns: 2,
      showLabels: true
    }
  },
  [NodeType.OUTPUT]: {
    name: 'Output',
    icon: '📤',
    inputs: [{ name: 'image', type: 'image', isInput: true }],
    outputs: [],
    defaultSize: { width: 300, height: 280 },
    defaultConfig: {}
  }
};