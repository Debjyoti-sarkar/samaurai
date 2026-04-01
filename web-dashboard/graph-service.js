/**
 * Graph Service - Visualization & Data Management
 * Handles graph data transformation and rendering
 */

class GraphService {
    constructor() {
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        this.network = null;
        this.selectedNode = null;
        this.nodeColors = {
            user: '#3498DB',      // Blue
            device: '#2ECC71',    // Green
            transaction: '#F39C12', // Orange
            session: '#9B59B6'    // Purple
        };
    }

    /**
     * Initialize network visualization
     */
    initNetwork(containerId) {
        const options = {
            physics: {
                enabled: true,
                stabilization: {
                    iterations: 200
                },
                forceAtlas2Based: {
                    gravitationalConstant: -50,
                    centralGravity: 0.01,
                    springLength: 200
                }
            },
            interaction: {
                navigationButtons: true,
                keyboard: true,
                zoomView: true,
                dragView: true
            },
            nodes: {
                shape: 'dot',
                scaling: {
                    min: 15,
                    max: 30,
                    label: {
                        enabled: true,
                        min: 14,
                        max: 30
                    }
                },
                font: {
                    size: 14,
                    color: '#fff'
                }
            },
            edges: {
                arrows: 'to',
                width: 1.5,
                font: {
                    size: 12
                },
                smooth: {
                    type: 'continuous'
                },
                physics: true
            }
        };

        const data = { nodes: this.nodes, edges: this.edges };
        const container = document.getElementById(containerId);
        this.network = new vis.Network(container, data, options);

        // Event listeners
        this.network.on('selectNode', (params) => this.onNodeSelected(params));
        this.network.on('deselectNode', () => this.onNodeDeselected());
        this.network.on('click', (params) => this.onNetworkClick(params));
    }

    /**
     * Load graph data from API
     */
    async loadGraphData() {
        try {
            const response = await apiService.getGraphRelationships();
            if (response.data && response.data.relationships) {
                this.processRelationships(response.data.relationships);
            }
            return true;
        } catch (error) {
            console.error('Failed to load graph data:', error);
            return false;
        }
    }

    /**
     * Process relationships into nodes and edges
     */
    processRelationships(relationships) {
        const nodeIds = new Set();
        const nodeMap = {};

        // First pass: collect all entities
        relationships.forEach(rel => {
            nodeIds.add(`${rel.sourceEntity.type}_${rel.sourceEntity.id}`);
            nodeIds.add(`${rel.targetEntity.type}_${rel.targetEntity.id}`);
        });

        // Create nodes
        Array.from(nodeIds).forEach(nodeId => {
            const [type, id] = nodeId.split('_');
            const nodeKey = `${type}_${id}`;

            nodeMap[nodeKey] = {
                id: nodeKey,
                label: `${type[0].toUpperCase()}${id.substring(0, 8)}`,
                title: `${type}: ${id}`,
                color: this.nodeColors[type] || '#95A5A6',
                size: 25
            };

            this.nodes.add(nodeMap[nodeKey]);
        });

        // Create edges
        relationships.forEach(rel => {
            const sourceId = `${rel.sourceEntity.type}_${rel.sourceEntity.id}`;
            const targetId = `${rel.targetEntity.type}_${rel.targetEntity.id}`;

            this.edges.add({
                from: sourceId,
                to: targetId,
                label: rel.relationshipType,
                title: `${rel.relationshipType}`,
                color: this.getEdgeColor(rel.relationshipType),
                arrows: 'to'
            });
        });
    }

    /**
     * Get edge color based on relationship type
     */
    getEdgeColor(type) {
        const colors = {
            'uses': '#3498DB',
            'makes': '#F39C12',
            'used_by': '#2ECC71',
            'performs': '#9B59B6',
            'has': '#E74C3C',
            'suspicious': '#E74C3C'
        };
        return colors[type.toLowerCase()] || '#95A5A6';
    }

    /**
     * Handle node selection
     */
    onNodeSelected(params) {
        if (params.nodes.length > 0) {
            this.selectedNode = params.nodes[0];
            this.highlightConnectedNodes();
            this.displayNodeInfo(this.selectedNode);
        }
    }

    /**
     * Handle node deselection
     */
    onNodeDeselected() {
        this.selectedNode = null;
        this.resetNodeHighlight();
        this.clearNodeInfo();
    }

    /**
     * Handle network click
     */
    onNetworkClick(params) {
        if (params.nodes.length === 0 && params.edges.length === 0) {
            this.onNodeDeselected();
        }
    }

    /**
     * Highlight connected nodes
     */
    highlightConnectedNodes() {
        const connectedNodes = [];
        const connectedEdges = [];

        // Find all connected nodes and edges
        this.edges.forEach(edge => {
            if (edge.from === this.selectedNode || edge.to === this.selectedNode) {
                connectedNodes.push(edge.from === this.selectedNode ? edge.to : edge.from);
                connectedEdges.push(edge.id);
            }
        });

        // Select connected nodes and edges
        this.network.selectNodes([this.selectedNode, ...connectedNodes]);
        this.network.selectEdges(connectedEdges);
    }

    /**
     * Reset node highlighting
     */
    resetNodeHighlight() {
        this.network.unselectAll();
    }

    /**
     * Display node information
     */
    displayNodeInfo(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        const [type, id] = nodeId.split('_');
        const connectedRelationships = [];

        this.edges.forEach(edge => {
            if (edge.from === nodeId) {
                connectedRelationships.push({
                    type: 'outgoing',
                    relation: edge.label,
                    target: edge.to
                });
            } else if (edge.to === nodeId) {
                connectedRelationships.push({
                    type: 'incoming',
                    relation: edge.label,
                    source: edge.from
                });
            }
        });

        const html = `
            <div class="node-details">
                <h4>${type.toUpperCase()}</h4>
                <p><strong>ID:</strong> ${id}</p>
                <p><strong>Connected:</strong> ${connectedRelationships.length} entities</p>
                <div class="relationships">
                    ${connectedRelationships.map(rel => `
                        <div class="relationship-item">
                            <span class="rel-type">${rel.relation}</span>
                            <span class="rel-target">${rel.target || rel.source}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.getElementById('nodeInfo').innerHTML = html;
    }

    /**
     * Clear node information
     */
    clearNodeInfo() {
        document.getElementById('nodeInfo').innerHTML = '<p>Click on a node to view details</p>';
    }

    /**
     * Reset graph view
     */
    resetGraph() {
        if (this.network) {
            this.network.fit();
        }
    }

    /**
     * Get graph statistics
     */
    getStats() {
        const typeCount = {};
        this.nodes.forEach(node => {
            const type = node.id.split('_')[0];
            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        return {
            totalNodes: this.nodes.length,
            totalEdges: this.edges.length,
            typeBreakdown: typeCount
        };
    }

    /**
     * Export graph as image
     */
    exportAsImage() {
        if (this.network) {
            const canvas = this.network.canvas.canvas;
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `graph-${new Date().getTime()}.png`;
            link.click();
        }
    }
}

// Global instance
const graphService = new GraphService();
