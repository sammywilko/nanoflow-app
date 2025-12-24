import React from 'react';
import { NodeConnection, WorkflowNode, PortType } from '../types';

interface ConnectionLineProps {
  connection: NodeConnection;
  nodes: WorkflowNode[];
  isSelected?: boolean;
  onClick?: () => void;
}

interface PendingConnectionProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  portType: PortType;
}

const PORT_COLORS: Record<PortType, string> = {
  image: '#a855f7',   // purple-500
  text: '#3b82f6',    // blue-500
  style: '#ec4899',   // pink-500
  mask: '#f97316',    // orange-500
  palette: '#10b981'  // emerald-500
};

// Calculate bezier control points for smooth curves
const getBezierPath = (
  x1: number, y1: number,
  x2: number, y2: number
): string => {
  const dx = Math.abs(x2 - x1);
  const controlOffset = Math.min(dx * 0.5, 100);

  const cp1x = x1 + controlOffset;
  const cp1y = y1;
  const cp2x = x2 - controlOffset;
  const cp2y = y2;

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
};

// Get port position on node
const getPortPosition = (
  node: WorkflowNode,
  portId: string,
  isInput: boolean
): { x: number; y: number } | null => {
  const ports = isInput ? node.inputs : node.outputs;
  const portIndex = ports.findIndex(p => p.id === portId);

  if (portIndex === -1) return null;

  const x = isInput
    ? node.position.x
    : node.position.x + node.size.width;

  const y = node.position.y + 40 + portIndex * 28 + 8; // Header height + port offset

  return { x, y };
};

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  nodes,
  isSelected,
  onClick
}) => {
  const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
  const targetNode = nodes.find(n => n.id === connection.targetNodeId);

  if (!sourceNode || !targetNode) return null;

  const sourcePos = getPortPosition(sourceNode, connection.sourcePortId, false);
  const targetPos = getPortPosition(targetNode, connection.targetPortId, true);

  if (!sourcePos || !targetPos) return null;

  // Get port type for color
  const sourcePort = sourceNode.outputs.find(p => p.id === connection.sourcePortId);
  const color = sourcePort ? PORT_COLORS[sourcePort.type] : '#6b7280';

  const path = getBezierPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Background stroke for hitbox */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />
      {/* Visible stroke */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#facc15' : color}
        strokeWidth={isSelected ? 3 : 2}
        strokeLinecap="round"
        className="transition-all duration-150"
        style={{
          filter: isSelected ? 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.5))' : undefined
        }}
      />
      {/* Animated flow indicator */}
      <circle r={4} fill={color}>
        <animateMotion dur="2s" repeatCount="indefinite" path={path} />
      </circle>
    </g>
  );
};

export const PendingConnection: React.FC<PendingConnectionProps> = ({
  startX,
  startY,
  endX,
  endY,
  portType
}) => {
  const color = PORT_COLORS[portType];
  const path = getBezierPath(startX, startY, endX, endY);

  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeDasharray="8 4"
      strokeLinecap="round"
      className="opacity-70"
    />
  );
};

interface ConnectionsSVGProps {
  connections: NodeConnection[];
  nodes: WorkflowNode[];
  selectedConnectionId?: string;
  onConnectionClick?: (id: string) => void;
  pendingConnection?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    portType: PortType;
  };
  viewState: { x: number; y: number; scale: number };
}

export const ConnectionsSVG: React.FC<ConnectionsSVGProps> = ({
  connections,
  nodes,
  selectedConnectionId,
  onConnectionClick,
  pendingConnection,
  viewState
}) => {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible'
      }}
    >
      <g
        style={{
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
          transformOrigin: '0 0'
        }}
        className="pointer-events-auto"
      >
        {connections.map(connection => (
          <ConnectionLine
            key={connection.id}
            connection={connection}
            nodes={nodes}
            isSelected={selectedConnectionId === connection.id}
            onClick={() => onConnectionClick?.(connection.id)}
          />
        ))}
        {pendingConnection && (
          <PendingConnection {...pendingConnection} />
        )}
      </g>
    </svg>
  );
};

export default ConnectionsSVG;
