/**
 * Graph Intelligence API Service
 * Handles all communication with backend graph endpoints
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api/intelligence';

interface GraphRelationship {
  _id?: string;
  from: string;
  to: string;
  relation: string;
  isRisky?: boolean;
  weight?: number;
  metadata?: {
    connectionStrength?: number;
    lastUpdated?: string;
  };
}

interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'device' | 'transaction' | 'session';
  riskScore?: number;
  connectionCount?: number;
  details?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export class GraphAPIService {
  private static token: string | null = null;

  static async setToken(token: string) {
    this.token = token;
    try {
      await AsyncStorage.setItem('jwt_token', token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  static async getStoredToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (token) {
        this.token = token;
      }
      return token;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  private static getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  /**
   * Transform raw API relationships into graph nodes and edges
   */
  static transformToGraphData(relationships: GraphRelationship[]) {
    const nodesMap = new Map<string, GraphNode>();
    const edges: { id: string; from: string; to: string; relation: string; isRisky?: boolean }[] = [];
    const connectionCounts = new Map<string, number>();

    // Track connections
    relationships.forEach((rel) => {
      connectionCounts.set(rel.from, (connectionCounts.get(rel.from) || 0) + 1);
      connectionCounts.set(rel.to, (connectionCounts.get(rel.to) || 0) + 1);
    });

    // Create nodes
    relationships.forEach((rel) => {
      if (!nodesMap.has(rel.from)) {
        const type = this.inferNodeType(rel.from);
        nodesMap.set(rel.from, {
          id: rel.from,
          label: this.formatLabel(rel.from),
          type,
          connectionCount: connectionCounts.get(rel.from) || 0,
          riskScore: this.calculateRiskScore(rel.from, relationships),
        });
      }

      if (!nodesMap.has(rel.to)) {
        const type = this.inferNodeType(rel.to);
        nodesMap.set(rel.to, {
          id: rel.to,
          label: this.formatLabel(rel.to),
          type,
          connectionCount: connectionCounts.get(rel.to) || 0,
          riskScore: this.calculateRiskScore(rel.to, relationships),
        });
      }
    });

    // Create edges
    relationships.forEach((rel, idx) => {
      edges.push({
        id: `edge_${idx}`,
        from: rel.from,
        to: rel.to,
        relation: rel.relation,
        isRisky: rel.isRisky || this.isRiskyRelationship(rel),
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      edges,
    };
  }

  private static inferNodeType(id: string): 'user' | 'device' | 'transaction' | 'session' {
    if (id.includes('user') || id.includes('usr_')) return 'user';
    if (id.includes('device') || id.includes('dev_') || id.includes('mobile')) return 'device';
    if (id.includes('transaction') || id.includes('txn_') || id.includes('pay_')) return 'transaction';
    if (id.includes('session') || id.includes('sess_')) return 'session';
    return 'user'; // Default
  }

  private static formatLabel(id: string): string {
    // Format ID for display
    const parts = id.split('_');
    const shortId = parts[parts.length - 1].substring(0, 6);
    const prefix = parts[0].substring(0, 3).toUpperCase();
    return `${prefix}${shortId}`;
  }

  private static calculateRiskScore(entityId: string, relationships: GraphRelationship[]): number {
    // Calculate risk based on connections
    const connections = relationships.filter((r) => r.from === entityId || r.to === entityId);
    const riskyConnections = connections.filter((c) => c.isRisky).length;
    const baseScore = (riskyConnections / Math.max(connections.length, 1)) * 100;

    // Boost score if node connects to suspicious entities
    const hasMultipleUsers = connections.some((c) => {
      const otherId = c.from === entityId ? c.to : c.from;
      return otherId.includes('user');
    });

    if (hasMultipleUsers && connections.length > 3) {
      return Math.min(100, baseScore + 25);
    }

    return baseScore;
  }

  private static isRiskyRelationship(rel: GraphRelationship): boolean {
    if (rel.isRisky) return true;
    // Mark as risky if relationship type suggests danger
    const riskyPatterns = ['FRAUD', 'SUSPICIOUS', 'BLOCKED', 'FLAGGED'];
    return riskyPatterns.some((pattern) => rel.relation.includes(pattern));
  }

  /**
   * Fetch graph relationships for a user
   */
  static async getUserGraph(userId: string): Promise<{
    nodes: GraphNode[];
    edges: Array<{ id: string; from: string; to: string; relation: string; isRisky?: boolean }>;
  }> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.get<ApiResponse<GraphRelationship[]>>(
        `${API_BASE_URL}/graph/user/${userId}/relationships`,
        { headers: this.getHeaders() }
      );

      return this.transformToGraphData(response.data.data);
    } catch (error) {
      console.error('Error fetching user graph:', error);
      throw error;
    }
  }

  /**
   * Fetch device relationships
   */
  static async getDeviceGraph(deviceId: string): Promise<{
    nodes: GraphNode[];
    edges: Array<{ id: string; from: string; to: string; relation: string; isRisky?: boolean }>;
  }> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.get<ApiResponse<GraphRelationship[]>>(
        `${API_BASE_URL}/graph/device/${deviceId}/relationships`,
        { headers: this.getHeaders() }
      );

      return this.transformToGraphData(response.data.data);
    } catch (error) {
      console.error('Error fetching device graph:', error);
      throw error;
    }
  }

  /**
   * Fetch all relationships (full graph)
   */
  static async getAllRelationships(): Promise<{
    nodes: GraphNode[];
    edges: Array<{ id: string; from: string; to: string; relation: string; isRisky?: boolean }>;
  }> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.get<ApiResponse<GraphRelationship[]>>(
        `${API_BASE_URL}/graph/relationships`,
        { headers: this.getHeaders() }
      );

      return this.transformToGraphData(response.data.data);
    } catch (error) {
      console.error('Error fetching all relationships:', error);
      throw error;
    }
  }

  /**
   * Fetch suspicious clusters/patterns
   */
  static async getSuspiciousClusters(): Promise<{
    nodes: GraphNode[];
    edges: Array<{ id: string; from: string; to: string; relation: string; isRisky?: boolean }>;
  }> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.get<ApiResponse<GraphRelationship[]>>(
        `${API_BASE_URL}/graph/suspicious-clusters`,
        { headers: this.getHeaders() }
      );

      return this.transformToGraphData(response.data.data);
    } catch (error) {
      console.error('Error fetching suspicious clusters:', error);
      throw error;
    }
  }

  /**
   * Fetch graph statistics
   */
  static async getGraphStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    riskyConnections: number;
    averageConnectionsPerNode: number;
  }> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.get(
        `${API_BASE_URL}/graph/stats`,
        { headers: this.getHeaders() }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error fetching graph stats:', error);
      throw error;
    }
  }

  /**
   * Create entity relationship
   */
  static async createRelationship(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string,
    relationshipType: string,
    metadata?: Record<string, any>
  ): Promise<GraphRelationship> {
    try {
      const token = this.token || (await this.getStoredToken());
      if (!token) throw new Error('No authentication token available');

      const response = await axios.post<ApiResponse<GraphRelationship>>(
        `${API_BASE_URL}/graph/create-relationship`,
        {
          sourceEntity: { type: sourceType, id: sourceId },
          targetEntity: { type: targetType, id: targetId },
          relationshipType,
          context: metadata || {},
        },
        { headers: this.getHeaders() }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error creating relationship:', error);
      throw error;
    }
  }
}

export default GraphAPIService;
