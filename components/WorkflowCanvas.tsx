import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WorkflowNode, NodeConnection, NodeType, NODE_DEFINITIONS, PortType, ViewState, Point } from '../types';
import { WorkflowNodeComponent } from './WorkflowNode';
import { ConnectionsSVG } from './ConnectionLine';
import { NodePalette } from './NodePalette';
import { WorkflowEngine } from '../services/workflowEngine';
import { nodeCache } from '../services/nodeCache';
import { Play, Save, FolderOpen, Trash2, ZoomIn, ZoomOut, AlertCircle, CheckCircle2 } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface WorkflowCanvasProps {
  onBack: () => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ onBack }) => {
  // Node State
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // View State
  const [viewState, setViewState] = useState<ViewState>({ x: 280, y: 50, scale: 1 });

  // Drag State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null);

  // Connection Drag State
  const [pendingConnection, setPendingConnection] = useState<{
    startNodeId: string;
    startPortId: string;
    startIsInput: boolean;
    startPortType: PortType;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Create a new node from type
  const createNode = (type: NodeType, position: Point): WorkflowNode => {
    const def = NODE_DEFINITIONS[type];
    return {
      id: generateId(),
      type,
      position,
      size: { ...def.defaultSize },
      inputs: def.inputs.map((p, i) => ({ ...p, id: `in-${generateId()}-${i}` })),
      outputs: def.outputs.map((p, i) => ({ ...p, id: `out-${generateId()}-${i}` })),
      config: { ...def.defaultConfig },
      status: 'idle'
    };
  };

  // Add node at position
  const handleAddNode = (type: NodeType, x: number, y: number) => {
    // Convert screen to world coordinates
    const worldX = (x - viewState.x) / viewState.scale;
    const worldY = (y - viewState.y) / viewState.scale;
    const newNode = createNode(type, { x: worldX, y: worldY });
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Handle drop from palette
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    if (nodeType) {
      handleAddNode(nodeType, e.clientX, e.clientY);
    }
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Delete connection
  const handleDeleteConnection = (connId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connId));
    setSelectedConnectionId(null);
  };

  // Node drag handlers
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y
    };
  };

  // Port drag (for connections)
  const handlePortDragStart = (nodeId: string, portId: string, isInput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const port = isInput
      ? node.inputs.find(p => p.id === portId)
      : node.outputs.find(p => p.id === portId);
    if (!port) return;

    const portIndex = isInput
      ? node.inputs.findIndex(p => p.id === portId)
      : node.outputs.findIndex(p => p.id === portId);

    const startX = isInput ? node.position.x : node.position.x + node.size.width;
    const startY = node.position.y + 40 + portIndex * 28 + 8;

    setPendingConnection({
      startNodeId: nodeId,
      startPortId: portId,
      startIsInput: isInput,
      startPortType: port.type,
      startX,
      startY,
      endX: startX,
      endY: startY
    });
  };

  // Port drop (complete connection)
  const handlePortDrop = (nodeId: string, portId: string, isInput: boolean) => {
    if (!pendingConnection) return;

    // Can't connect to same node
    if (nodeId === pendingConnection.startNodeId) {
      setPendingConnection(null);
      return;
    }

    // Must connect output to input (or vice versa)
    if (isInput === pendingConnection.startIsInput) {
      setPendingConnection(null);
      return;
    }

    // Get target port type
    const targetNode = nodes.find(n => n.id === nodeId);
    const targetPort = isInput
      ? targetNode?.inputs.find(p => p.id === portId)
      : targetNode?.outputs.find(p => p.id === portId);

    // Type check (simple compatibility)
    if (targetPort && !arePortsCompatible(pendingConnection.startPortType, targetPort.type)) {
      setPendingConnection(null);
      return;
    }

    // Remove existing connection to target input
    setConnections(prev => prev.filter(c => !(c.targetNodeId === nodeId && c.targetPortId === portId)));

    // Create connection (output → input)
    const sourceNodeId = pendingConnection.startIsInput ? nodeId : pendingConnection.startNodeId;
    const sourcePortId = pendingConnection.startIsInput ? portId : pendingConnection.startPortId;
    const targetNodeId = pendingConnection.startIsInput ? pendingConnection.startNodeId : nodeId;
    const targetPortId = pendingConnection.startIsInput ? pendingConnection.startPortId : portId;

    const newConnection: NodeConnection = {
      id: generateId(),
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId
    };

    setConnections(prev => [...prev, newConnection]);
    setPendingConnection(null);
  };

  // Check port type compatibility
  const arePortsCompatible = (type1: PortType, type2: PortType): boolean => {
    if (type1 === type2) return true;
    // Allow some conversions
    if (type1 === 'style' && type2 === 'image') return true;
    if (type1 === 'image' && type2 === 'style') return true;
    // Array compatibility - imageArray can connect to image (uses first/selected)
    if (type1 === 'imageArray' && type2 === 'image') return true;
    if (type1 === 'textArray' && type2 === 'text') return true;
    return false;
  };

  // Check if port can be connected (for highlighting)
  const isPortValid = (portType: PortType, isInput: boolean): boolean => {
    if (!pendingConnection) return false;
    if (isInput === pendingConnection.startIsInput) return false;
    return arePortsCompatible(pendingConnection.startPortType, portType);
  };

  // Get connected ports for a node
  const getConnectedPorts = (nodeId: string): Set<string> => {
    const connected = new Set<string>();
    connections.forEach(c => {
      if (c.sourceNodeId === nodeId) connected.add(c.sourcePortId);
      if (c.targetNodeId === nodeId) connected.add(c.targetPortId);
    });
    return connected;
  };

  // Node config change
  const handleConfigChange = (nodeId: string, config: Record<string, any>) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n
    ));
  };

  // Image upload for input nodes
  const handleImageUpload = (nodeId: string, imageData: string) => {
    handleConfigChange(nodeId, { imageData });
  };

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Node dragging
      const startPos = dragStartPos.current;
      if (draggedNodeId && startPos) {
        const dx = (e.clientX - startPos.x) / viewState.scale;
        const dy = (e.clientY - startPos.y) / viewState.scale;
        const newX = startPos.nodeX + dx;
        const newY = startPos.nodeY + dy;

        setNodes(prev => prev.map(n =>
          n.id === draggedNodeId
            ? { ...n, position: { x: newX, y: newY } }
            : n
        ));
      }

      // Connection dragging
      if (pendingConnection) {
        const worldX = (e.clientX - viewState.x) / viewState.scale;
        const worldY = (e.clientY - viewState.y) / viewState.scale;
        setPendingConnection(prev => prev ? { ...prev, endX: worldX, endY: worldY } : null);
      }
    };

    const handleMouseUp = () => {
      setDraggedNodeId(null);
      dragStartPos.current = null;
      if (pendingConnection) {
        setPendingConnection(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNodeId, pendingConnection, viewState]);

  // Execute workflow
  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    // Reset all node statuses (but keep _cached flag clean)
    setNodes(prev => prev.map(n => ({
      ...n,
      status: 'idle',
      error: undefined,
      config: { ...n.config, _cached: undefined }
    })));

    const engine = new WorkflowEngine(
      nodes,
      connections,
      (nodeId, updates) => {
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, ...updates } : n
        ));
      }
    );

    const result = await engine.execute(cacheEnabled);
    setExecutionResult(result);
    setIsExecuting(false);
  };

  // Clear cache handler
  const handleClearCache = () => {
    nodeCache.clear();
    setNodes(prev => prev.map(n => ({
      ...n,
      config: { ...n.config, _cached: undefined }
    })));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) handleDeleteNode(selectedNodeId);
        if (selectedConnectionId) handleDeleteConnection(selectedConnectionId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnectionId]);

  return (
    <div className="w-full h-screen bg-gray-950 flex overflow-hidden">
      {/* Node Palette */}
      <NodePalette onAddNode={handleAddNode} />

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition"
            >
              ← Back to Canvas
            </button>
            <div className="h-6 w-px bg-gray-700" />
            <span className="text-sm font-medium text-gray-200">Workflow Editor</span>
          </div>

          <div className="flex items-center gap-2">
            {executionResult && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${executionResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {executionResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-xs">{executionResult.success ? 'Complete' : executionResult.error}</span>
              </div>
            )}

            <button
              onClick={() => setViewState(v => ({ ...v, scale: Math.min(v.scale * 1.2, 2) }))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewState(v => ({ ...v, scale: Math.max(v.scale * 0.8, 0.3) }))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-gray-700" />

            {/* Cache Controls */}
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={cacheEnabled}
                onChange={(e) => setCacheEnabled(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900"
              />
              Cache
            </label>
            <button
              onClick={handleClearCache}
              className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Clear all cached results"
            >
              Clear
            </button>

            <div className="h-6 w-px bg-gray-700" />

            <button
              onClick={handleExecute}
              disabled={isExecuting || nodes.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition
                ${isExecuting ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-500 text-white'}`}
            >
              <Play className="w-4 h-4" />
              {isExecuting ? 'Running...' : 'Run Workflow'}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-gray-950"
          style={{
            backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
            backgroundSize: `${20 * viewState.scale}px ${20 * viewState.scale}px`,
            backgroundPosition: `${viewState.x}px ${viewState.y}px`
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedConnectionId(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            if (e.ctrlKey) {
              const scaleAmount = -e.deltaY * 0.001;
              const newScale = Math.min(Math.max(viewState.scale * (1 + scaleAmount), 0.3), 2);
              setViewState({ ...viewState, scale: newScale });
            } else {
              setViewState(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
          }}
        >
          {/* Connections SVG */}
          <ConnectionsSVG
            connections={connections}
            nodes={nodes}
            selectedConnectionId={selectedConnectionId}
            onConnectionClick={(id) => {
              setSelectedConnectionId(id);
              setSelectedNodeId(null);
            }}
            pendingConnection={pendingConnection ? {
              startX: pendingConnection.startX,
              startY: pendingConnection.startY,
              endX: pendingConnection.endX,
              endY: pendingConnection.endY,
              portType: pendingConnection.startPortType
            } : undefined}
            viewState={viewState}
          />

          {/* Nodes */}
          <div
            className="absolute origin-top-left"
            style={{
              transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
              transformOrigin: '0 0'
            }}
          >
            {nodes.map(node => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                scale={viewState.scale}
                onSelect={(id) => {
                  setSelectedNodeId(id);
                  setSelectedConnectionId(null);
                }}
                onDelete={handleDeleteNode}
                onDragStart={handleNodeDragStart}
                onPortDragStart={handlePortDragStart}
                onPortDrop={handlePortDrop}
                onConfigChange={handleConfigChange}
                onImageUpload={handleImageUpload}
                connectedPorts={getConnectedPorts(node.id)}
                isPortValid={isPortValid}
                isDraggingConnection={!!pendingConnection}
              />
            ))}
          </div>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Drag nodes from the palette</p>
                <p className="text-sm">Connect them to build your AI workflow</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
