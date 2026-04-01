# 🏗️ Graph Dashboard Architecture Overview

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         REACT NATIVE APP                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Navigation/RootNavigator                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  SecurityGraph Screen → GraphScreen Component          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                  │                                                 │
│  ┌───────────────▼────────────────────────────────────────────┐  │
│  │            GraphScreen.tsx (Main Component)                │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  State Management:                                          │  │
│  │  • nodes: GraphNode[]                                      │  │
│  │  • edges: GraphEdge[]                                      │  │
│  │  • selectedNode: GraphNode | null                          │  │
│  │  • loading, error, refreshing states                       │  │
│  │                                                             │  │
│  │  useEffect Hooks:                                          │  │
│  │  • loadGraphData() - Fetch on mount                        │  │
│  │  • onRefresh() - Handle pull-to-refresh                    │  │
│  │  • handleNodePress() - Handle user interactions            │  │
│  │                                                             │  │
│  │  Children Components:                                      │  │
│  │  ┌─────────────────────┬──────────────┬─────────────────┐ │  │
│  │  │   Header (Fixed)    │              │ Footer Controls │ │  │
│  │  │ Title + Refresh Btn │  GraphView   │ [All][User][Dev]│ │  │
│  │  └─────────────────────┤              │ [Risky]         │ │  │
│  │  │                     │              │                 │ │  │
│  │  │  Stats Badge ────→  │   (Core)     │ Statistics:     │ │  │
│  │  │  • Total Nodes      │              │ • Nodes: 45     │ │  │
│  │  │  • Total Edges      │              │ • Edges: 78     │ │  │
│  │  │  • Risky Conn.      │              │ • Risky: 12     │ │  │
│  │  └─────────────────────┴──────────────┴─────────────────┘ │  │
│  │                                                             │  │
│  │  Modal (onNodePress):                                      │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │           NodeDetailsView                          │   │  │
│  │  ├────────────────────────────────────────────────────┤   │  │
│  │  │ Node: USER123ABC          Type: USER         [✕]   │   │  │
│  │  │                                                    │   │  │
│  │  │ ⚠️  Risk Score: 45% HIGH                          │   │  │
│  │  │ ───────────────────────────────                  │   │  │
│  │  │                                                    │   │  │
│  │  │ 🔗 Connected Entities: 5                          │   │  │
│  │  │                                                    │   │  │
│  │  │ 🔀 Related Entities:                              │   │  │
│  │  │    • DEV456ABC                                    │   │  │
│  │  │    • TXN789DEF                                    │   │  │
│  │  │    • SESS000GHI                                   │   │  │
│  │  │                                                    │   │  │
│  │  │ [👁️ View Details] [🚩 Report]                    │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                  │                                                 │
│  ┌───────────────▼────────────────────────────────────────────┐  │
│  │            GraphView.tsx (Rendering Layer)                 │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  Physics Engine (every 30ms):                             │  │
│  │  1. Calculate repulsion forces between nodes              │  │
│  │  2. Calculate attraction forces along edges               │  │
│  │  3. Update node positions with velocity damping           │  │
│  │  4. Clamp positions to screen bounds                      │  │
│  │                                                             │  │
│  │  Rendering:                                               │  │
│  │  • SVG Canvas (react-native-svg)                          │  │
│  │  • Animated components (react-native-reanimated)          │  │
│  │  • Gesture detection (gesture-handler)                    │  │
│  │                                                             │  │
│  │  Performance Optimization:                                │  │
│  │  • useMemo for edges rendering                            │  │
│  │  • useMemo for nodes rendering                            │  │
│  │  • Memoized color calculations                            │  │
│  │  • useCallback for handlers                               │  │
│  │                                                             │  │
│  │  Visual Elements:                                         │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │  Background Grid (optional)                      │    │  │
│  │  │  ┌──────────────────────────────────────────────┐│    │  │
│  │  │  │ ↓ Edges (with arrows)                         ││    │  │
│  │  │  │ ┌──────────────────────────────────────────┐ ││    │  │
│  │  │  │ │ ↓ Nodes (circles with labels)            │ ││    │  │
│  │  │  │ │                                          │ ││    │  │
│  │  │  │ │     ◯───────────◯                        │ ││    │  │
│  │  │  │ │    / \         / \                       │ ││    │  │
│  │  │  │ │   ◯───◯---→◯─◯───◯                       │ ││    │  │
│  │  │  │ │    \ /         \ /                       │ ││    │  │
│  │  │  │ │     ◯───────────◯                        │ ││    │  │
│  │  │  │ └──────────────────────────────────────────┘ ││    │  │
│  │  │  └──────────────────────────────────────────────┘│    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                             │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                  │                                                 │
└──────────────────┼─────────────────────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  AsyncStorage     │
         ├───────────────────┤
         │ • jwt_token       │
         │ • cached_graph    │
         └───────────────────┘
                   │
                   │ (Stored)
                   │
                   │ (Retrieved on app start)
                   │
         ┌─────────▼──────────────────────┐
         │  GraphAPIService.ts             │
         ├─────────────────────────────────┤
         │                                  │
         │  Public Methods:                 │
         │  • setToken(token)               │
         │  • getStoredToken()              │
         │  • getUserGraph(userId)          │
         │  • getDeviceGraph(deviceId)      │
         │  • getAllRelationships()         │
         │  • getSuspiciousClusters()       │
         │  • getGraphStats()               │
         │  • createRelationship(...)       │
         │                                  │
         │  Private Methods:                │
         │  • transformToGraphData()        │
         │  • inferNodeType()               │
         │  • calculateRiskScore()          │
         │  • getHeaders() [with JWT]       │
         │                                  │
         │  Data Transformation:            │
         │  Raw API Response                │
         │         ↓                        │
         │  Extract unique nodes            │
         │         ↓                        │
         │  Calculate risk scores           │
         │         ↓                        │
         │  Build edge relationships        │
         │         ↓                        │
         │  GraphNode[] + GraphEdge[]       │
         │                                  │
         └─────────┬──────────────────────┘
                   │ (API Calls)
                   │ (JWT Bearer Token)
                   │ (Headers + Body)
                   │
                   ▼
     ┌─────────────────────────────────────┐
     │    NODE.JS EXPRESS BACKEND          │
     ├─────────────────────────────────────┤
     │                                      │
     │ POST /login → JWT Token             │
     │  (stores in AsyncStorage)           │
     │                                      │
     │ GET /graph/relationships            │
     │  (requires: Authorization header)   │
     │  Response: [                        │
     │    {                                │
     │      from: "user123",               │
     │      to: "device001",               │
     │      relation: "USES",              │
     │      isRisky: false,                │
     │      weight: 0.8                    │
     │    },                               │
     │    ...                              │
     │  ]                                  │
     │                                      │
     │ GET /graph/user/:userId/relations   │
     │ GET /graph/device/:deviceId/rel.    │
     │ GET /graph/suspicious-clusters      │
     │ GET /graph/stats                    │
     │ POST /graph/create-relationship     │
     │                                      │
     │ Middleware:                         │
     │ • JWT authentication                │
     │ • CORS validation                   │
     │ • Rate limiting                     │
     │ • Error handling                    │
     │                                      │
     └──────────┬────────────────────────┘
               │
               ▼
     ┌──────────────────────┐
     │   MONGODB            │
     ├──────────────────────┤
     │ Collections:         │
     │ • events             │
     │ • cases              │
     │ • users              │
     │ • devices            │
     │ • transactions       │
     │ • entityRelationship │
     │ • riskAssessment     │
     │ • alerts             │
     │ • automationRule     │
     └──────────────────────┘
```

---

## Component Relationships

```
GraphScreen.tsx (Main Container)
│
├─→ State Management
│   ├─ nodes[]
│   ├─ edges[]
│   ├─ selectedNode
│   ├─ loading, error
│   ├─ viewType (all/user/device/suspicious)
│   └─ modalVisible
│
├─→ Effects
│   ├─ useEffect: loadGraphData() on mount
│   ├─ useEffect: cleanup physics simulation
│   └─ useCallback: action handlers
│
├─→ GraphView Component (SVG Rendering)
│   │
│   ├─ Physics Simulation Loop
│   │  └─ useEffect: setInterval(simulate, 30ms)
│   │     ├─ Apply repulsion forces
│   │     ├─ Apply attraction forces
│   │     ├─ Update velocities with damping
│   │     └─ Clamp positions to bounds
│   │
│   ├─ SVG Rendering
│   │  ├─ Background grid
│   │  ├─ Edge lines (with arrows)
│   │  └─ Node circles
│   │
│   └─ Interaction
│      └─ TouchableOpacity on nodes
│         └─ onPress → onNodePress callback
│
├─→ Modal (NodeDetailsView)
│   ├─ Entity information
│   ├─ Risk score bar
│   ├─ Related entities list
│   └─ Action buttons
│
├─→ Controls
│   ├─ Header
│   │  ├─ Title
│   │  ├─ Entity count
│   │  └─ Refresh button
│   │
│   ├─ Footer
│   │  ├─ [All] filter
│   │  ├─ [Users] filter
│   │  ├─ [Devices] filter
│   │  └─ [Risky] filter
│   │
│   └─ Statistics Badge
│      ├─ Total nodes
│      ├─ Total edges
│      └─ Risky connections
│
└─→ GraphAPIService (Data Layer)
   │
   ├─ Authentication
   │  ├─ setToken(token)
   │  ├─ getStoredToken()
   │  └─ getHeaders() [includes JWT]
   │
   ├─ Data Fetching
   │  ├─ getUserGraph(userId)
   │  ├─ getDeviceGraph(deviceId)
   │  ├─ getAllRelationships()
   │  ├─ getSuspiciousClusters()
   │  ├─ getGraphStats()
   │  └─ createRelationship(...)
   │
   ├─ Data Transformation
   │  ├─ transformToGraphData(relationships)
   │  ├─ inferNodeType(id)
   │  ├─ formatLabel(id)
   │  ├─ calculateRiskScore(id, rels)
   │  └─ isRiskyRelationship(rel)
   │
   └─ API Communication
      └─ axios.get/post(API_BASE_URL + endpoint)
         └─ Backend Services
```

---

## Data Flow - Detailed

### 1️⃣ Initialization Flow
```
App Start
  ↓
AuthContext provides token
  ↓
User logs in
  ↓
GraphAPIService.setToken(token)
  ↓
Save to AsyncStorage
  ↓
User navigates to SecurityGraph
  ↓
GraphScreen mounts
  ↓
useEffect hook fires loadGraphData()
```

### 2️⃣ Data Loading Flow
```
loadGraphData()
  ↓
Get token from AsyncStorage
  ↓
Call GraphAPIService.getAllRelationships()
  ↓
API Service adds JWT header
  ↓
axios.get(API_BASE_URL + '/graph/relationships')
  ↓
Backend validates token
  ↓
Return relationship data
  ↓
transformToGraphData(relationships)
  │ ├─ Extract unique entity IDs
  │ ├─ Create GraphNode objects
  │ ├─ Calculate risk scores
  │ └─ Build GraphEdge relationships
  ↓
Initialize node positions (random)
  ↓
setNodes() + setEdges()
  ↓
GraphView components update
```

### 3️⃣ Physics Simulation Flow
```
Every 30ms:
  ↓
Calculate forces for all nodes
  ├─ Repulsion: nodes pushing apart
  └─ Attraction: edges pulling together
  ↓
Apply damping (slow down movement)
  ↓
Update node x,y positions
  ↓
Clamp to screen boundaries
  ↓
setSimulatedNodes() → Causes re-render
  ↓
GraphView renders updated positions
  ↓
User sees smooth animation
```

### 4️⃣ Interaction Flow
```
User taps on a node
  ↓
SVG Circle onPress triggered
  ↓
handleNodePress(node) called
  ↓
Calculate related edges
  ↓
Create NodeDetailData
  ↓
setSelectedNode()
  ↓
setModalVisible(true)
  ↓
NodeDetailsView renders
  ↓
User sees:
  ├─ Node info
  ├─ Risk score
  ├─ Related entities
  └─ Action buttons
  ↓
User taps [✕] to close
  ↓
closeModal() called
  ↓
Modal animates out
  ↓
setModalVisible(false)
```

### 5️⃣ Filter Flow
```
User taps filter button [Risky]
  ↓
setViewType('suspicious')
  ↓
useEffect dependency updates
  ↓
loadGraphData() called with new viewType
  ↓
Switch statement routes to getSuspiciousClusters()
  ↓
Backend returns only risky relationships
  ↓
transformToGraphData() with subset
  ↓
setNodes() + setEdges()
  ↓
GraphView re-renders with filtered data
  ↓
User sees only high-risk entities
```

### 6️⃣ Refresh Flow
```
User pulls down (refresh gesture)
  ↓
onRefresh() called
  ↓
setRefreshing(true)
  ↓
loadGraphData()
  ↓
Fetch fresh data from API
  ↓
Update nodes and edges
  ↓
Fetch new statistics
  ↓
setRefreshing(false)
  ↓
Refresh control disappears
  ↓
Graph shows latest data
```

---

## Performance Architecture

### Optimization Techniques

```
1. Memoization
   ├─ useMemo(() => edgesElements, [simulatedNodes, edges, selectedNodeId])
   ├─ useMemo(() => nodesElements, [simulatedNodes, selectedNodeId, ...])
   └─ useMemo(() => filteredNodes, [nodes, viewType])

2. Caching
   ├─ AsyncStorage: JWT token
   ├─ useMemo: Expensive calculations
   └─ useCallback: Function references

3. Lazy Loading
   ├─ Only fetch data when needed
   ├─ Filter on client side
   └─ Display incrementally

4. Efficient Rendering
   ├─ SVG (lightweight vs Canvas)
   ├─ Reanimated (native thread)
   ├─ Gesture-handler (native thread)
   └─ React.useMemo() for derived data

5. Physics Optimization
   ├─ Interval-based (30ms) not frame-based
   ├─ Configurable damping
   ├─ Force cap to prevent runaway
   └─ Early termination when stable
```

---

## Security Architecture

```
┌──────────────────────────────────────────┐
│         Security Layers                   │
├──────────────────────────────────────────┤
│                                           │
│ 1. Authentication                         │
│    └─ JWT token from login                │
│                                           │
│ 2. Token Storage                          │
│    └─ AsyncStorage (encrypted by OS)      │
│                                           │
│ 3. API Communication                      │
│    ├─ HTTPS/TLS                           │
│    └─ Bearer token in Authorization       │
│       header: "Bearer {jwt_token}"        │
│                                           │
│ 4. Backend Validation                     │
│    ├─ JWT verification                    │
│    ├─ Token expiration check               │
│    └─ Role-based access control           │
│                                           │
│ 5. Data Protection                        │
│    ├─ No sensitive data in logs           │
│    ├─ Encrypted AsyncStorage              │
│    └─ CORS validation                     │
│                                           │
└──────────────────────────────────────────┘
```

---

## File Dependency Graph

```
index.js
  ├─→ App.tsx
  │   └─→ RootNavigator.tsx
  │       ├─→ GraphScreen.tsx ✨ NEW
  │       │   ├─→ GraphView.tsx ✨ NEW
  │       │   ├─→ graphAPI.ts ✨ NEW
  │       │   ├─→ useTheme.ts ✓ exists
  │       │   ├─→ useAuth.ts ✓ exists
  │       │   └─→ ThemedText.tsx ✓ exists
  │       │
  │       ├─→ AuthContext.tsx ✓ exists
  │       ├─→ ThemeContext.tsx ✓ exists
  │       └─→ [Other screens...]
  │
  ├─→ services/
  │   ├─→ graphAPI.ts ✨ NEW
  │   └─→ [Other services...]
  │
  ├─→ components/
  │   ├─→ GraphView.tsx ✨ NEW
  │   └─→ [Other components...]
  │
  └─→ [Other files...]

Legend:
✨ NEW - Newly created files
✓ exists - Already in your project
```

---

## Extension Points for Future Development

```
GraphScreen.tsx
  ├─ Add WebSocket listener for real-time updates
  ├─ Implement export to PDF/Image
  ├─ Add search/filter by entity ID
  ├─ Add timeline view of relationships
  └─ Integrate AI pattern detection

GraphView.tsx
  ├─ Add viewport culling for large graphs
  ├─ Implement custom node shapes
  ├─ Add edge labels
  ├─ Implement zoom/pan persistence
  └─ Add animation presets

graphAPI.ts
  ├─ Add request caching
  ├─ Implement retry logic
  ├─ Add request batching
  ├─ Implement pagination
  └─ Add WebSocket integration

Backend Integration
  ├─ Add subscription APIs
  ├─ Implement graph algorithms
  ├─ Add anomaly detection
  ├─ Implement case auto-escalation
  └─ Add ML scoring models
```

---

This architecture provides a **clean, scalable, and maintainable** graph visualization system that integrates seamlessly with your React Native app and backend infrastructure.
