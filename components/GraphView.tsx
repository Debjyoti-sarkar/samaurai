/**
 * GraphView Component
 * Renders interactive graph visualization with physics simulation
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Svg, { Line, Circle, G, Text as SvgText, Defs, RadialGradient, Stop, Marker, Path } from 'react-native-svg';
import Animated, { 
  FadeIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';

export interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'device' | 'transaction' | 'session';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  riskScore?: number;
  details?: string;
  connectionCount?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  isRisky?: boolean;
  weight?: number;
}

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  onNodePress: (node: GraphNode) => void;
  selectedNodeId?: string;
  animationEnabled?: boolean;
}

const PHYSICS_CONFIG = {
  repulsion: 100,
  attraction: 0.1,
  damping: 0.85,
  minDistance: 30,
  maxDistance: 300,
};

const NODE_COLORS = {
  user: '#3498DB',      // Blue
  device: '#2ECC71',    // Green
  transaction: '#F39C12', // Orange
  session: '#9B59B6',   // Purple
};

const getRiskColor = (riskScore?: number): string => {
  if (!riskScore) return '#95A5A6';
  if (riskScore > 75) return '#E74C3C'; // Red
  if (riskScore > 50) return '#F39C12'; // Orange
  if (riskScore > 25) return '#F1C40F'; // Yellow
  return '#2ECC71'; // Green
};

const getNodeRadius = (connectionCount: number = 1): number => {
  return Math.min(20 + connectionCount * 2, 35);
};

export const GraphView: React.FC<GraphViewProps> = ({
  nodes,
  edges,
  width,
  height,
  onNodePress,
  selectedNodeId,
  animationEnabled = true,
}) => {
  const [simulatedNodes, setSimulatedNodes] = useState<GraphNode[]>(nodes);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const scaleAnim = useSharedValue(1);

  // Physics simulation for force-directed layout
  useEffect(() => {
    if (animationEnabled && nodes.length > 0) {
      let currentNodes = JSON.parse(JSON.stringify(nodes));

      const simulate = () => {
        // Reset forces
        currentNodes.forEach((node: GraphNode) => {
          node.vx = (node.vx || 0) * PHYSICS_CONFIG.damping;
          node.vy = (node.vy || 0) * PHYSICS_CONFIG.damping;
        });

        // Repulsion forces between nodes
        for (let i = 0; i < currentNodes.length; i++) {
          for (let j = i + 1; j < currentNodes.length; j++) {
            const dx = currentNodes[j].x - currentNodes[i].x;
            const dy = currentNodes[j].y - currentNodes[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const repulsion = PHYSICS_CONFIG.repulsion / (distance * distance);

            currentNodes[i].vx -= (repulsion * dx) / distance;
            currentNodes[i].vy -= (repulsion * dy) / distance;
            currentNodes[j].vx += (repulsion * dx) / distance;
            currentNodes[j].vy += (repulsion * dy) / distance;
          }
        }

        // Attraction forces along edges
        edges.forEach((edge) => {
          const source = currentNodes.find((n: GraphNode) => n.id === edge.from);
          const target = currentNodes.find((n: GraphNode) => n.id === edge.to);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const attraction = distance * PHYSICS_CONFIG.attraction;

            source.vx += (attraction * dx) / distance;
            source.vy += (attraction * dy) / distance;
            target.vx -= (attraction * dx) / distance;
            target.vy -= (attraction * dy) / distance;
          }
        });

        // Update positions with bounds
        currentNodes.forEach((node: GraphNode) => {
          const radius = getNodeRadius(node.connectionCount);
          node.x = Math.max(radius, Math.min(width - radius, node.x + node.vx));
          node.y = Math.max(radius, Math.min(height - radius, node.y + node.vy));
        });

        setSimulatedNodes(JSON.parse(JSON.stringify(currentNodes)));
      };

      animationRef.current = setInterval(simulate, 30);

      return () => {
        if (animationRef.current) clearInterval(animationRef.current);
      };
    }
  }, [nodes, edges, width, height, animationEnabled]);

  // Memoize edges rendering
  const edgesElements = useMemo(() => {
    return edges.map((edge) => {
      const fromNode = simulatedNodes.find((n) => n.id === edge.from);
      const toNode = simulatedNodes.find((n) => n.id === edge.to);

      if (!fromNode || !toNode) return null;

      const isSelected = selectedNodeId === edge.from || selectedNodeId === edge.to;
      const strokeColor = edge.isRisky ? '#E74C3C' : '#BDC3C7';
      const strokeWidth = isSelected ? 3 : 2;

      return (
        <G key={edge.id}>
          <Line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={isSelected ? 0.8 : 0.4}
            strokeDasharray={edge.isRisky ? '5,5' : undefined}
          />
          {/* Arrowhead */}
          <ArrowMarker
            fromX={fromNode.x}
            fromY={fromNode.y}
            toX={toNode.x}
            toY={toNode.y}
            color={strokeColor}
            opacity={isSelected ? 0.8 : 0.4}
          />
        </G>
      );
    });
  }, [simulatedNodes, edges, selectedNodeId]);

  // Memoize nodes rendering
  const nodesElements = useMemo(() => {
    return simulatedNodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const color = getRiskColor(node.riskScore);
      const radius = getNodeRadius(node.connectionCount);
      const baseColor = NODE_COLORS[node.type];

      return (
        <G
          key={node.id}
          onPress={() => onNodePress(node)}
        >
          {/* Shadow effect */}
          {isSelected && (
            <Circle
              cx={node.x}
              cy={node.y}
              r={radius + 8}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.5}
            />
          )}

          {/* Main circle */}
          <Circle
            cx={node.x}
            cy={node.y}
            r={radius}
            fill={baseColor}
            opacity={isSelected ? 1 : 0.8}
          />

          {/* Risk indicator ring */}
          {node.riskScore && node.riskScore > 0 && (
            <Circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray={`${(node.riskScore / 100) * (2 * Math.PI * radius)},${2 * Math.PI * radius}`}
            />
          )}

          {/* Label */}
          <SvgText
            x={node.x}
            y={node.y + 5}
            fontSize="11"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
          >
            {node.label.substring(0, 8)}
          </SvgText>

          {/* Type icon */}
          <SvgText
            x={node.x}
            y={node.y - 8}
            fontSize="9"
            fill="rgba(255,255,255,0.7)"
            textAnchor="middle"
          >
            {node.type[0].toUpperCase()}
          </SvgText>
        </G>
      );
    });
  }, [simulatedNodes, selectedNodeId, onNodePress]);

  return (
    <Animated.View
      entering={FadeIn}
      style={styles.container}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <Defs>
          <Marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <Path d="M0 0, 10 3, 0 6" fill="#BDC3C7" />
          </Marker>
        </Defs>

        {/* Background grid (optional) */}
        <G opacity={0.05}>
          {Array.from({ length: Math.ceil(width / 50) }).map((_, i) => (
            <Line
              key={`v${i}`}
              x1={i * 50}
              y1={0}
              x2={i * 50}
              y2={height}
              stroke="#000"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: Math.ceil(height / 50) }).map((_, i) => (
            <Line
              key={`h${i}`}
              x1={0}
              y1={i * 50}
              x2={width}
              y2={i * 50}
              stroke="#000"
              strokeWidth={1}
            />
          ))}
        </G>

        {/* Edges first (so they appear behind nodes) */}
        {edgesElements}

        {/* Then nodes */}
        {nodesElements}
      </Svg>
    </Animated.View>
  );
};

interface ArrowMarkerProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  opacity: number;
}

const ArrowMarker: React.FC<ArrowMarkerProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  color,
  opacity,
}) => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  const arrowSize = 8;

  const arrowX = toX - arrowSize * Math.cos(angle);
  const arrowY = toY - arrowSize * Math.sin(angle);

  return (
    <G>
      <Path
        d={`M ${arrowX},${arrowY} L ${arrowX - arrowSize * Math.cos(angle - Math.PI / 6)},${
          arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
        } L ${arrowX - arrowSize * Math.cos(angle + Math.PI / 6)},${
          arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
        } Z`}
        fill={color}
        opacity={opacity}
      />
    </G>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
