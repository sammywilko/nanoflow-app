import React from 'react';
import { NodeType, NODE_DEFINITIONS } from '../types';

interface NodePaletteProps {
  onAddNode: (type: NodeType, x: number, y: number) => void;
}

const NODE_CATEGORIES = [
  {
    name: 'Inputs',
    nodes: [NodeType.IMAGE_INPUT, NodeType.TEXT_INPUT, NodeType.TEXT_ARRAY_INPUT]
  },
  {
    name: 'Generation',
    nodes: [NodeType.GENERATE, NodeType.BATCH_GENERATE]
  },
  {
    name: 'Processing',
    nodes: [NodeType.STYLE_TRANSFER, NodeType.INPAINT, NodeType.UPSCALE]
  },
  {
    name: 'Exploration',
    nodes: [NodeType.COMPARE_GRID]
  },
  {
    name: 'Analysis',
    nodes: [NodeType.ANALYZE, NodeType.COMPOSITE]
  },
  {
    name: 'Output',
    nodes: [NodeType.OUTPUT]
  }
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const handleDragStart = (e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-bold text-gray-200">Node Palette</h2>
        <p className="text-[10px] text-gray-500 mt-1">Drag nodes onto canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {NODE_CATEGORIES.map(category => (
          <div key={category.name}>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.nodes.map(nodeType => {
                const def = NODE_DEFINITIONS[nodeType];
                return (
                  <div
                    key={nodeType}
                    draggable
                    onDragStart={(e) => handleDragStart(e, nodeType)}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg cursor-grab
                      hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600
                      active:cursor-grabbing"
                  >
                    <span className="text-lg">{def.icon}</span>
                    <div>
                      <div className="text-sm text-gray-200">{def.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {def.inputs.length} in / {def.outputs.length} out
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800 bg-gray-900/50">
        <div className="text-[10px] text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Image</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Text</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pink-500" />
            <span>Style</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Image Array</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Text Array</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodePalette;
