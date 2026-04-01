/**
 * Examples and Use Cases for Graph Visualization Dashboard
 * Real-world implementations and advanced patterns
 */

import React, { useEffect, useState } from 'react';
import { View, Button, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GraphAPIService from '@/services/graphAPI';
import GraphScreen from '@/screens/GraphScreen';
import { ThemedText } from '@/components/ThemedText';

// ============================================================================
// EXAMPLE 1: Navigate to Graph from Another Screen
// ============================================================================

export const Example1_NavigateToGraph = () => {
  const navigation = useNavigation();

  const openSecurityGraph = () => {
    navigation.navigate('SecurityGraph');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button
        title="View Security Graph"
        onPress={openSecurityGraph}
      />
    </View>
  );
};

// ============================================================================
// EXAMPLE 2: Embed Graph in a Tab with Other Data
// ============================================================================

export const Example2_GraphWithDashboard = () => {
  const [selectedTab, setSelectedTab] = useState<'graph' | 'alerts' | 'stats'>('graph');

  return (
    <View style={{ flex: 1 }}>
      {/* Tab Navigation */}
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <Button
          title="Graph"
          onPress={() => setSelectedTab('graph')}
          disabled={selectedTab === 'graph'}
        />
        <Button
          title="Alerts"
          onPress={() => setSelectedTab('alerts')}
          disabled={selectedTab === 'alerts'}
        />
        <Button
          title="Stats"
          onPress={() => setSelectedTab('stats')}
          disabled={selectedTab === 'stats'}
        />
      </View>

      {/* Tab Content */}
      {selectedTab === 'graph' && <GraphScreen />}
      {selectedTab === 'alerts' && <AlertsView />}
      {selectedTab === 'stats' && <StatsView />}
    </View>
  );
};

const AlertsView = () => <ThemedText>Alerts View</ThemedText>;
const StatsView = () => <ThemedText>Stats View</ThemedText>;

// ============================================================================
// EXAMPLE 3: Pre-load Graph Data and Filter
// ============================================================================

type filterType = 'all' | 'risky' | 'user' | 'device';

export const Example3_PreloadFilteredGraph = ({ filterType = 'all' }: { filterType?: filterType }) => {
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        let data;

        switch (filterType) {
          case 'risky':
            data = await GraphAPIService.getSuspiciousClusters();
            break;
          case 'user':
            // Would need userId from props or context
            data = await GraphAPIService.getAllRelationships();
            break;
          case 'device':
            // Would need deviceId from props or context
            data = await GraphAPIService.getAllRelationships();
            break;
          default:
            data = await GraphAPIService.getAllRelationships();
        }

        setGraphData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filterType]);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return <ThemedText>Error: {error}</ThemedText>;
  }

  // You could pass graphData to a custom component here
  return <GraphScreen />;
};

// ============================================================================
// EXAMPLE 4: Monitor Graph Changes in Real-time
// ============================================================================

export const Example4_RealtimeGraphMonitoring = () => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Poll for updates every 30 seconds
    const pollInterval = setInterval(async () => {
      try {
        const data = await GraphAPIService.getAllRelationships();
        setNodes(data.nodes);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to update graph:', error);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10 }}>
        <ThemedText>Nodes: {nodes.length}</ThemedText>
        {lastUpdate && (
          <ThemedText>Last update: {lastUpdate.toLocaleTimeString()}</ThemedText>
        )}
      </View>
      <GraphScreen />
    </View>
  );
};

// ============================================================================
// EXAMPLE 5: Custom Node Details Handler
// ============================================================================

export const Example5_CustomNodeHandler = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);

  const handleNodeSelection = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    
    // Add to history
    setNodeHistory(prev => [nodeId, ...prev.slice(0, 9)]); // Keep last 10
    
    // Perform custom actions
    console.log('Selected node:', nodeId);
    
    // Could trigger analytics, load additional data, etc.
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10 }}>
        <ThemedText>Selected: {selectedNodeId || 'None'}</ThemedText>
        <ThemedText>History: {nodeHistory.join(' → ')}</ThemedText>
      </View>
      <GraphScreen />
    </View>
  );
};

// ============================================================================
// EXAMPLE 6: Export Graph as Image
// ============================================================================

import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useRef } from 'react';

export const Example6_ExportGraphImage = () => {
  const graphRef = useRef<View>(null);

  const exportGraphAsImage = async () => {
    try {
      if (!graphRef.current) return;

      const uri = await captureRef(graphRef, {
        format: 'png',
        quality: 0.8,
      });

      // Share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        console.log('Image saved to:', uri);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="Export as Image" onPress={exportGraphAsImage} />
      <View ref={graphRef} style={{ flex: 1 }}>
        <GraphScreen />
      </View>
    </View>
  );
};

// ============================================================================
// EXAMPLE 7: Highlight Suspicious Patterns
// ============================================================================

export const Example7_SuspiciousPatternDetection = () => {
  const [suspiciousInfo, setSuspiciousInfo] = useState<any>(null);

  useEffect(() => {
    const detectPatterns = async () => {
      try {
        // Fetch suspicious clusters
        const clusters = await GraphAPIService.getSuspiciousClusters();

        // Analyze patterns
        const patterns = {
          deviceMultipleUsers: clusters.nodes.filter((n: any) => 
            n.type === 'device' && n.connectionCount > 5
          ),
          riskyTransactions: clusters.nodes.filter((n: any) => 
            n.type === 'transaction' && (n.riskScore || 0) > 75
          ),
          totalRiskyConnections: clusters.edges.filter((e: any) => e.isRisky).length,
        };

        setSuspiciousInfo(patterns);
      } catch (error) {
        console.error('Pattern detection failed:', error);
      }
    };

    detectPatterns();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10 }}>
        <ThemedText>Suspicious Patterns Detected:</ThemedText>
        {suspiciousInfo && (
          <>
            <ThemedText>
              Devices used by multiple users: {suspiciousInfo.deviceMultipleUsers.length}
            </ThemedText>
            <ThemedText>
              Critical transactions: {suspiciousInfo.riskyTransactions.length}
            </ThemedText>
            <ThemedText>
              Risky connections: {suspiciousInfo.totalRiskyConnections}
            </ThemedText>
          </>
        )}
      </View>
      <GraphScreen />
    </View>
  );
};

// ============================================================================
// EXAMPLE 8: Create Relationships Programmatically
// ============================================================================

export const Example8_CreateRelationship = async () => {
  try {
    const relationship = await GraphAPIService.createRelationship(
      'user',           // sourceType
      'user_123abc',    // sourceId
      'device',         // targetType
      'device_001',     // targetId
      'USES',           // relationshipType
      {                 // metadata
        timestamp: new Date(),
        verified: true,
      }
    );

    console.log('Relationship created:', relationship);
    return relationship;
  } catch (error) {
    console.error('Failed to create relationship:', error);
  }
};

// ============================================================================
// EXAMPLE 9: Fetch and Display Graph Statistics
// ============================================================================

export const Example9_GraphStatistics = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const graphStats = await GraphAPIService.getGraphStats();
        setStats(graphStats);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <View style={{ flex: 1, padding: 10 }}>
      <ThemedText>Graph Statistics:</ThemedText>
      {stats && (
        <>
          <ThemedText>Total Nodes: {stats.totalNodes}</ThemedText>
          <ThemedText>Total Edges: {stats.totalEdges}</ThemedText>
          <ThemedText>Risky Connections: {stats.riskyConnections}</ThemedText>
          <ThemedText>
            Avg Connections: {stats.averageConnectionsPerNode?.toFixed(2)}
          </ThemedText>
        </>
      )}
      <View style={{ flex: 1 }} />
      <GraphScreen />
    </View>
  );
};

// ============================================================================
// EXAMPLE 10: Full-Featured Intelligence Dashboard
// ============================================================================

export interface DashboardData {
  graphStats: any;
  riskyNodes: any[];
  recentActivities: any[];
  alerts: any[];
}

export const Example10_IntelligenceDashboard = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'alerts' | 'activities'>('overview');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const stats = await GraphAPIService.getGraphStats();
        const clusters = await GraphAPIService.getSuspiciousClusters();
        
        setDashboardData({
          graphStats: stats,
          riskyNodes: clusters.nodes.filter((n: any) => (n.riskScore || 0) > 50),
          recentActivities: [], // Load from actual API
          alerts: [], // Load from alerts API
        });
      } catch (error) {
        console.error('Dashboard load failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Tab Navigation */}
      <View style={{ flexDirection: 'row' }}>
        <Button
          title="Overview"
          onPress={() => setActiveTab('overview')}
          disabled={activeTab === 'overview'}
        />
        <Button
          title="Graph"
          onPress={() => setActiveTab('graph')}
          disabled={activeTab === 'graph'}
        />
        <Button
          title="Risky"
          onPress={() => setActiveTab('alerts')}
          disabled={activeTab === 'alerts'}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab data={dashboardData} />
      )}
      {activeTab === 'graph' && <GraphScreen />}
      {activeTab === 'alerts' && (
        <RiskyNodesTab nodes={dashboardData?.riskyNodes || []} />
      )}
    </View>
  );
};

const OverviewTab = ({ data }: { data: DashboardData | null }) => (
  <View style={{ flex: 1, padding: 10 }}>
    <ThemedText>Overview</ThemedText>
    {data && (
      <>
        <ThemedText>Nodes: {data.graphStats.totalNodes}</ThemedText>
        <ThemedText>Risky Entities: {data.riskyNodes.length}</ThemedText>
        <ThemedText>Risky Connections: {data.graphStats.riskyConnections}</ThemedText>
      </>
    )}
  </View>
);

const RiskyNodesTab = ({ nodes }: { nodes: any[] }) => (
  <View style={{ flex: 1, padding: 10 }}>
    <ThemedText>Risky Entities ({nodes.length})</ThemedText>
    {nodes.map((node, idx) => (
      <View key={idx} style={{ marginTop: 10, padding: 10, borderWidth: 1 }}>
        <ThemedText>{node.label} - Risk: {node.riskScore}%</ThemedText>
      </View>
    ))}
  </View>
);

// ============================================================================
// Export all examples
// ============================================================================

export const Examples = {
  NavigateToGraph: Example1_NavigateToGraph,
  GraphWithDashboard: Example2_GraphWithDashboard,
  PreloadFilteredGraph: Example3_PreloadFilteredGraph,
  RealtimeMonitoring: Example4_RealtimeGraphMonitoring,
  CustomNodeHandler: Example5_CustomNodeHandler,
  ExportGraphImage: Example6_ExportGraphImage,
  SuspiciousPatterns: Example7_SuspiciousPatternDetection,
  CreateRelationship: Example8_CreateRelationship,
  GraphStatistics: Example9_GraphStatistics,
  IntelligenceDashboard: Example10_IntelligenceDashboard,
};

export default Examples;
