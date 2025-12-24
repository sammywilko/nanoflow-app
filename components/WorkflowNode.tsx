import React, { useRef, useState } from 'react';
import { WorkflowNode as WorkflowNodeType, NodeType, NODE_DEFINITIONS, NodePort, PortType } from '../types';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react';

interface WorkflowNodeProps {
  node: WorkflowNodeType;
  isSelected: boolean;
  scale: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onPortDragStart: (nodeId: string, portId: string, isInput: boolean, e: React.MouseEvent) => void;
  onPortDrop: (nodeId: string, portId: string, isInput: boolean) => void;
  onConfigChange: (nodeId: string, config: Record<string, any>) => void;
  onImageUpload: (nodeId: string, imageData: string) => void;
  connectedPorts: Set<string>;
  isPortValid: (portType: PortType, isInput: boolean) => boolean;
  isDraggingConnection: boolean;
}

const PORT_COLORS: Record<PortType, string> = {
  image: 'bg-purple-500',
  text: 'bg-blue-500',
  style: 'bg-pink-500',
  mask: 'bg-orange-500',
  palette: 'bg-emerald-500',
  imageArray: 'bg-purple-400',
  textArray: 'bg-blue-400'
};

const STATUS_ICONS = {
  idle: null,
  running: <Loader2 className="w-4 h-4 animate-spin text-blue-400" />,
  complete: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />
};

export const WorkflowNodeComponent: React.FC<WorkflowNodeProps> = ({
  node,
  isSelected,
  scale,
  onSelect,
  onDelete,
  onDragStart,
  onPortDragStart,
  onPortDrop,
  onConfigChange,
  onImageUpload,
  connectedPorts,
  isPortValid,
  isDraggingConnection
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const definition = NODE_DEFINITIONS[node.type];
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
    if (e.button === 0) {
      onDragStart(node.id, e);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      onImageUpload(node.id, base64);
    };
    reader.readAsDataURL(file);
  };

  const renderPort = (port: NodePort, index: number) => {
    const isConnected = connectedPorts.has(port.id);
    const canConnect = isDraggingConnection && isPortValid(port.type, port.isInput);

    return (
      <div
        key={port.id}
        className={`absolute flex items-center gap-2 ${port.isInput ? '-left-3' : '-right-3'}`}
        style={{ top: `${40 + index * 28}px` }}
      >
        {port.isInput && (
          <span className="text-[10px] text-gray-400 mr-1 select-none">{port.name}</span>
        )}
        {/* Larger invisible hit area for easier connection */}
        <div
          className="relative"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortDragStart(node.id, port.id, port.isInput, e);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onPortDrop(node.id, port.id, port.isInput);
          }}
        >
          {/* Invisible larger hit area */}
          <div className="absolute -inset-3 cursor-crosshair" />
          {/* Visible port */}
          <div
            className={`w-5 h-5 rounded-full cursor-crosshair border-2 transition-all relative z-10
              ${PORT_COLORS[port.type]}
              ${isConnected ? 'border-white' : 'border-gray-700'}
              ${canConnect ? 'ring-4 ring-white ring-opacity-50 scale-150 animate-pulse' : ''}
              hover:scale-125 hover:border-white`}
            title={`${port.name} (${port.type})`}
          />
        </div>
        {!port.isInput && (
          <span className="text-[10px] text-gray-400 ml-1 select-none">{port.name}</span>
        )}
      </div>
    );
  };

  const renderNodeContent = () => {
    switch (node.type) {
      case NodeType.IMAGE_INPUT:
        return (
          <div className="p-2">
            {node.config.imageData ? (
              <div className="relative">
                <img
                  src={node.config.imageData}
                  alt="Input"
                  className="w-full h-24 object-cover rounded"
                />
                <button
                  onClick={() => onConfigChange(node.id, { imageData: null })}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded hover:bg-black/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center gap-2 hover:border-gray-400 transition-colors"
              >
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400">Upload Image</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        );

      case NodeType.TEXT_INPUT:
        return (
          <div className="p-2">
            <textarea
              value={node.config.text || ''}
              onChange={(e) => onConfigChange(node.id, { text: e.target.value })}
              placeholder="Enter prompt..."
              className="w-full h-16 bg-gray-800 border border-gray-600 rounded p-2 text-xs resize-none focus:border-blue-500 focus:outline-none"
            />
          </div>
        );

      case NodeType.GENERATE:
        return (
          <div className="p-2 space-y-2">
            <textarea
              value={node.config.prompt || ''}
              onChange={(e) => onConfigChange(node.id, { ...node.config, prompt: e.target.value })}
              placeholder="Enter prompt... (or connect a Prompt node)"
              className="w-full h-12 bg-gray-800 border border-gray-600 rounded p-2 text-xs resize-none focus:border-purple-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={node.config.aspectRatio || '1:1'}
                onChange={(e) => onConfigChange(node.id, { ...node.config, aspectRatio: e.target.value })}
                className="flex-1 bg-gray-800 border border-gray-600 rounded p-1 text-xs"
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
              <select
                value={node.config.quality || '2K'}
                onChange={(e) => onConfigChange(node.id, { ...node.config, quality: e.target.value })}
                className="flex-1 bg-gray-800 border border-gray-600 rounded p-1 text-xs"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </div>
            {node.result && (
              <img src={node.result} alt="Result" className="w-full h-20 object-cover rounded" />
            )}
          </div>
        );

      case NodeType.UPSCALE:
        return (
          <div className="p-2">
            <select
              value={node.config.targetSize || '4K'}
              onChange={(e) => onConfigChange(node.id, { targetSize: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded p-1 text-xs"
            >
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
            {node.result && (
              <img src={node.result} alt="Result" className="w-full h-16 object-cover rounded mt-2" />
            )}
          </div>
        );

      case NodeType.OUTPUT:
        return (
          <div className="p-2">
            {node.result ? (
              <div className="space-y-2">
                <img src={node.result} alt="Output" className="w-full h-48 object-cover rounded" />
                <a
                  href={node.result}
                  download="output.png"
                  className="block w-full text-center py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                >
                  Download
                </a>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
                Connect an image input
              </div>
            )}
          </div>
        );

      case NodeType.TEXT_ARRAY_INPUT:
        return (
          <div className="p-2 space-y-2">
            <div className="text-xs text-gray-400 mb-1">One prompt per line:</div>
            <textarea
              value={(node.config.prompts || ['']).join('\n')}
              onChange={(e) => onConfigChange(node.id, {
                prompts: e.target.value.split('\n')
              })}
              placeholder="A red apple&#10;A blue apple&#10;A green apple"
              className="w-full h-32 bg-gray-800 border border-gray-600 rounded p-2 text-xs resize-none font-mono focus:border-blue-500 focus:outline-none"
            />
            <div className="text-[10px] text-gray-500">
              {(node.config.prompts || []).filter((p: string) => p.trim()).length} prompts
            </div>
          </div>
        );

      case NodeType.BATCH_GENERATE: {
        const images = Array.isArray(node.result) ? node.result : [];
        return (
          <div className="p-2 space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={node.config.useVariables || false}
                onChange={(e) => onConfigChange(node.id, { ...node.config, useVariables: e.target.checked })}
                className="rounded"
              />
              <span>Use {'{{variable}}'} syntax</span>
            </label>

            {node.config.useVariables ? (
              <>
                <textarea
                  value={node.config.promptText || ''}
                  onChange={(e) => onConfigChange(node.id, { ...node.config, promptText: e.target.value })}
                  placeholder="A {{color}} {{subject}} in {{style}} style"
                  className="w-full h-12 bg-gray-800 border border-gray-600 rounded p-2 text-xs resize-none focus:border-purple-500 focus:outline-none"
                />
                <div className="space-y-1">
                  {Object.entries(node.config.variables || {}).map(([name, values]: [string, any]) => (
                    <div key={name} className="bg-gray-800 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-purple-400">{`{{${name}}}`}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const copy = { ...node.config.variables };
                            delete copy[name];
                            onConfigChange(node.id, { ...node.config, variables: copy });
                          }}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        value={(values || []).join(', ')}
                        onChange={(e) => onConfigChange(node.id, {
                          ...node.config,
                          variables: {
                            ...node.config.variables,
                            [name]: e.target.value.split(',').map((s: string) => s.trim())
                          }
                        })}
                        placeholder="value1, value2, value3"
                        className="w-full bg-gray-700 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const name = prompt('Variable name (e.g., "color"):');
                      if (name && !(node.config.variables || {})[name]) {
                        onConfigChange(node.id, {
                          ...node.config,
                          variables: { ...node.config.variables, [name]: [''] }
                        });
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                  >
                    + Add Variable
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-400">
                Connect a Prompt List node
              </div>
            )}

            <div className="flex gap-2">
              <select
                value={node.config.aspectRatio || '1:1'}
                onChange={(e) => onConfigChange(node.id, { ...node.config, aspectRatio: e.target.value })}
                className="flex-1 bg-gray-800 border border-gray-600 rounded p-1 text-xs"
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
              <select
                value={node.config.quality || '2K'}
                onChange={(e) => onConfigChange(node.id, { ...node.config, quality: e.target.value })}
                className="flex-1 bg-gray-800 border border-gray-600 rounded p-1 text-xs"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
              </select>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-1 mt-2">
                {images.slice(0, 9).map((img: string, i: number) => (
                  <img key={i} src={img} alt={`Result ${i}`}
                    className="w-full aspect-square object-cover rounded" />
                ))}
                {images.length > 9 && (
                  <div className="flex items-center justify-center bg-gray-800 rounded text-xs aspect-square">
                    +{images.length - 9}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case NodeType.COMPARE_GRID: {
        const images: string[] = node.result?.images || (Array.isArray(node.result) ? node.result : []);
        const selectedIndex = node.config.selectedIndex;
        const cols = node.config.gridColumns || 2;

        return (
          <div className="p-2">
            {images.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 text-xs">
                Connect a Batch Generate node
              </div>
            ) : (
              <>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                  {images.map((img: string, i: number) => (
                    <div
                      key={i}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                        ${selectedIndex === i
                          ? 'border-green-500 ring-2 ring-green-500/50'
                          : 'border-gray-700 hover:border-gray-500'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfigChange(node.id, { ...node.config, selectedIndex: i });
                      }}
                    >
                      <img src={img} alt={`Option ${i}`} className="w-full aspect-square object-cover" />
                      {node.config.showLabels && (
                        <div className="absolute top-1 left-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-xs font-bold">
                          {String.fromCharCode(65 + i)}
                        </div>
                      )}
                      {selectedIndex === i && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                            PROMOTED
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-400">Grid:</span>
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfigChange(node.id, { ...node.config, gridColumns: n });
                      }}
                      className={`w-6 h-6 text-xs rounded ${cols === n ? 'bg-purple-600' : 'bg-gray-700'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      }

      default:
        return (
          <div className="p-2">
            {node.result && (
              <img src={node.result} alt="Result" className="w-full h-20 object-cover rounded" />
            )}
            {node.error && (
              <div className="text-xs text-red-400 mt-1">{node.error}</div>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={`absolute bg-gray-900 rounded-lg border-2 shadow-xl transition-shadow
        ${isSelected ? 'border-yellow-400 shadow-yellow-400/20' : 'border-gray-700'}
        ${isHovering ? 'shadow-lg' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        minHeight: node.size.height,
        transform: `scale(${1})`,
        transformOrigin: 'top left'
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-base">{definition.icon}</span>
          <span className="text-sm font-medium text-gray-200">{definition.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {node.config._cached && (
            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-medium rounded">
              CACHED
            </span>
          )}
          {STATUS_ICONS[node.status]}
          {isHovering && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="p-1 hover:bg-red-500/20 rounded"
            >
              <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Ports */}
      {node.inputs.map((port, i) => renderPort(port, i))}
      {node.outputs.map((port, i) => renderPort(port, i))}

      {/* Content */}
      {renderNodeContent()}
    </div>
  );
};

export default WorkflowNodeComponent;
