/**
 * Enhanced Security Graph Screen
 * Interactive graph visualization of entities and their relationships
 * Integrated with backend intelligence API
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { GraphView, GraphNode, GraphEdge } from '@/components/GraphView';
import GraphAPIService from '@/services/graphAPI';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 70;
const GRAPH_HEIGHT = height - HEADER_HEIGHT - FOOTER_HEIGHT;

export interface NodeDetailData {
  id: string;
  label: string;
  type: string;
  connections: number;
  riskScore: number;
  relatedNodes: string[];
  lastActivity?: string;
}

type GraphViewType = 'all' | 'user' | 'device' | 'suspicious';

const GraphScreen: React.FC = () => {
  const { theme } = useTheme();
  const { userData } = useAuth();

  // State management
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewType, setViewType] = useState<GraphViewType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [graphStats, setGraphStats] = useState<any>(null);

  const modalOpacity = useSharedValue(0);
  const nodeDetailsRef = useRef<NodeDetailData | null>(null);

  // Load graph data
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await GraphAPIService.getStoredToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      let graphData;
      switch (viewType) {
        case 'user':
          if (userData?.phoneNumber) {
            graphData = await GraphAPIService.getUserGraph(userData.phoneNumber);
          } else {
            throw new Error('User ID not available');
          }
          break;
        case 'device':
          // Fetch device relationships (would need device ID from context)
          graphData = await GraphAPIService.getAllRelationships();
          break;
        case 'suspicious':
          graphData = await GraphAPIService.getSuspiciousClusters();
          break;
        default:
          graphData = await GraphAPIService.getAllRelationships();
      }

      // Initialize positions randomly
      const initializedNodes = graphData.nodes.map((node) => ({
        ...node,
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (GRAPH_HEIGHT - 100) + 50,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      }));

      setNodes(initializedNodes);
      setEdges(graphData.edges);

      // Fetch statistics
      const stats = await GraphAPIService.getGraphStats();
      setGraphStats(stats);
    } catch (err: any) {
      console.error('Error loading graph:', err);
      setError(err.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [viewType, userData]);

  // Initial load
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGraphData();
    setRefreshing(false);
  }, [loadGraphData]);

  // Handle node press
  const handleNodePress = useCallback((node: GraphNode) => {
    setSelectedNode(node);

    // Calculate related nodes
    const relatedEdges = edges.filter((e) => e.from === node.id || e.to === node.id);
    const relatedNodeIds = relatedEdges
      .flatMap((e) => [e.from === node.id ? e.to : e.from])
      .filter((id) => id !== node.id);

    nodeDetailsRef.current = {
      id: node.id,
      label: node.label,
      type: node.type,
      connections: relatedNodeIds.length,
      riskScore: node.riskScore || 0,
      relatedNodes: relatedNodeIds,
      lastActivity: new Date().toISOString(),
    };

    setModalVisible(true);
    modalOpacity.value = withSpring(1);
  }, [edges]);

  // Close modal
  const closeModal = useCallback(() => {
    modalOpacity.value = withSpring(0);
    setTimeout(() => {
      setModalVisible(false);
      setSelectedNode(null);
    }, 200);
  }, []);

  // Filter nodes based on view type
  const filterNodes = useCallback(() => {
    if (viewType === 'suspicious') {
      return nodes.filter((n) => (n.riskScore || 0) > 50);
    }
    if (viewType === 'user') {
      return nodes.filter((n) => n.type === 'user');
    }
    return nodes;
  }, [nodes, viewType]);

  const filteredNodes = useMemo(() => filterNodes(), [filterNodes]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  }, [filteredNodes, edges]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.card}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Security Graph</ThemedText>
          <Text style={styles.headerSubtitle}>
            {filteredNodes.length} entities • {filteredEdges.length} connections
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} style={styles.refreshButton}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather name="refresh-cw" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Graph Canvas */}
      {loading ? (
        <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={styles.loadingText}>Loading graph data...</ThemedText>
        </View>
      ) : error ? (
        <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={onRefresh}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.graphContainer, { backgroundColor: theme.background }]}>
          <GraphView
            nodes={filteredNodes}
            edges={filteredEdges}
            width={width}
            height={GRAPH_HEIGHT}
            onNodePress={handleNodePress}
            selectedNodeId={selectedNode?.id}
            animationEnabled={true}
          />
        </View>
      )}

      {/* View Controls Footer */}
      <View style={[styles.footer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ViewControlButton
          icon="globe"
          active={viewType === 'all'}
          onPress={() => setViewType('all')}
          theme={theme}
          label="All"
        />
        <ViewControlButton
          icon="user"
          active={viewType === 'user'}
          onPress={() => setViewType('user')}
          theme={theme}
          label="Users"
        />
        <ViewControlButton
          icon="hard-drive"
          active={viewType === 'device'}
          onPress={() => setViewType('device')}
          theme={theme}
          label="Devices"
        />
        <ViewControlButton
          icon="alert-triangle"
          active={viewType === 'suspicious'}
          onPress={() => setViewType('suspicious')}
          theme={theme}
          label="Risky"
        />
      </View>

      {/* Node Details Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.modalContent, { backgroundColor: theme.card }]}
          >
            <NodeDetailsView
              node={selectedNode}
              nodeDetails={nodeDetailsRef.current}
              onClose={closeModal}
              theme={theme}
            />
          </Animated.View>
        </View>
      </Modal>

      {/* Stats Badge */}
      {graphStats && (
        <Animated.View
          entering={FadeIn}
          style={[styles.statsBadge, { backgroundColor: theme.primary + '20' }]}
        >
          <StatItem
            icon="hash"
            label="Nodes"
            value={graphStats.totalNodes || '—'}
          />
          <StatItem
            icon="link"
            label="Relations"
            value={graphStats.totalEdges || '—'}
          />
          <StatItem
            icon="alert-circle"
            label="Risky"
            value={graphStats.riskyConnections || '0'}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

// Sub-components

interface ViewControlButtonProps {
  icon: string;
  active: boolean;
  onPress: () => void;
  theme: any;
  label: string;
}

const ViewControlButton: React.FC<ViewControlButtonProps> = ({
  icon,
  active,
  onPress,
  theme,
  label,
}) => (
  <TouchableOpacity
    style={[
      styles.viewButton,
      {
        backgroundColor: active ? theme.primary : 'transparent',
        borderColor: active ? theme.primary : theme.border,
      },
    ]}
    onPress={onPress}
  >
    <Feather
      name={icon as any}
      size={16}
      color={active ? 'white' : theme.textSecondary}
    />
    <Text
      style={[
        styles.viewButtonLabel,
        {
          color: active ? 'white' : theme.textSecondary,
          fontSize: Platform.OS === 'ios' ? 10 : 9,
        },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

interface NodeDetailsViewProps {
  node: GraphNode | null;
  nodeDetails: NodeDetailData | null;
  onClose: () => void;
  theme: any;
}

const NodeDetailsView: React.FC<NodeDetailsViewProps> = ({
  node,
  nodeDetails,
  onClose,
  theme,
}) => {
  if (!node || !nodeDetails) return null;

  const riskLevel = nodeDetails.riskScore > 75 ? 'CRITICAL' : nodeDetails.riskScore > 50 ? 'HIGH' : 'LOW';
  const riskColor =
    nodeDetails.riskScore > 75
      ? '#E74C3C'
      : nodeDetails.riskScore > 50
        ? '#F39C12'
        : '#2ECC71';

  return (
    <ScrollView style={styles.detailsContainer}>
      <View style={[styles.detailsHeader, { borderColor: theme.border }]}>
        <View style={styles.detailsHeaderContent}>
          <ThemedText style={styles.detailsTitle}>{nodeDetails.label}</ThemedText>
          <Text style={[styles.detailsSubtitle, { color: theme.textSecondary }]}>
            Type: {node.type.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsBody}>
        {/* Risk Score */}
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Feather name="alert-circle" size={20} color={riskColor} />
          </View>
          <View style={styles.detailInfo}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Risk Score</Text>
            <View style={styles.riskScoreBar}>
              <View
                style={[
                  styles.riskScoreFill,
                  {
                    width: `${nodeDetails.riskScore}%`,
                    backgroundColor: riskColor,
                  },
                ]}
              />
            </View>
            <Text style={{ color: riskColor, fontWeight: 'bold', marginTop: 4 }}>
              {riskLevel} ({nodeDetails.riskScore.toFixed(0)}%)
            </Text>
          </View>
        </View>

        {/* Connections */}
        <View style={[styles.detailRow, { borderColor: theme.border, borderTopWidth: 1 }]}>
          <View style={styles.detailIcon}>
            <Feather name="link-2" size={20} color={theme.primary} />
          </View>
          <View style={styles.detailInfo}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Connected Entities</Text>
            <Text style={{ color: theme.text, fontWeight: 'bold', marginTop: 4 }}>
              {nodeDetails.connections} relationship{nodeDetails.connections !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Related Nodes */}
        {nodeDetails.relatedNodes.length > 0 && (
          <View style={[styles.detailRow, { borderColor: theme.border, borderTopWidth: 1 }]}>
            <View style={styles.detailIcon}>
              <Feather name="share-2" size={20} color={theme.primary} />
            </View>
            <View style={[styles.detailInfo, { flex: 1 }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Related Entities</Text>
              <ScrollView style={styles.relatedNodesList}>
                {nodeDetails.relatedNodes.map((nodeId, idx) => (
                  <View key={idx} style={[styles.relatedNodeTag, { backgroundColor: theme.background }]}>
                    <Text style={{ color: theme.text, fontSize: 11 }}>{nodeId}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ID */}
        <View style={[styles.detailRow, { borderColor: theme.border, borderTopWidth: 1 }]}>
          <View style={styles.detailIcon}>
            <Feather name="copy" size={20} color={theme.textSecondary} />
          </View>
          <View style={styles.detailInfo}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Entity ID</Text>
            <Text style={{ color: theme.text, fontFamily: 'monospace', marginTop: 4, fontSize: 10 }}>
              {nodeDetails.id}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.detailsActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}
          >
            <Feather name="eye" size={16} color={theme.primary} />
            <Text style={{ color: theme.primary, marginLeft: 8, fontWeight: '600' }}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#E74C3C20' }]}>
            <Feather name="flag" size={16} color="#E74C3C" />
            <Text style={{ color: '#E74C3C', marginLeft: 8, fontWeight: '600' }}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

interface StatItemProps {
  icon: string;
  label: string;
  value: string | number;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value }) => (
  <View style={styles.statItem}>
    <Feather name={icon as any} size={16} color="#3498DB" />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.6,
  },
  refreshButton: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: width - 40,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontWeight: 'bold',
    color: 'white',
  },
  graphContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingBottom: 8,
  },
  viewButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewButtonLabel: {
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: height * 0.7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  detailsContainer: {
    maxHeight: height * 0.68,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
  },
  detailsHeaderContent: {
    flex: 1,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  detailsBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  detailIcon: {
    width: 32,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfo: {
    flex: 1,
  },
  riskScoreBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  riskScoreFill: {
    height: '100%',
    borderRadius: 3,
  },
  relatedNodesList: {
    marginTop: 8,
    maxHeight: 100,
  },
  relatedNodeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
    marginRight: 4,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  statsBadge: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#3498DB',
  },
  statLabel: {
    fontSize: 9,
    color: '#7F8C8D',
  },
});

export default GraphScreen;
