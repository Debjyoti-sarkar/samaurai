# 🎨 Graph Visualization Dashboard - Complete Integration Guide

## Overview

This guide provides step-by-step instructions to integrate the interactive graph visualization dashboard into your React Native app. The dashboard displays relationships between entities (users, devices, transactions, sessions) using real-time data from your backend intelligence API.

---

## 📋 Prerequisites

- ✅ React Native app running (Expo or bare workflow)
- ✅ Backend intelligence API running (Node.js + MongoDB)
- ✅ JWT authentication tokens available in the app
- ✅ Existing navigation stack setup

---

## 📦 Installation & Setup

### Step 1: Install Required Dependencies

The required packages are likely already installed, but verify:

```bash
cd APP1
npm install
```

Ensure these packages are in `package.json`:
- `react-native-svg` ✅
- `react-native-reanimated` ✅
- `react-native-gesture-handler` ✅
- `axios` ✅ (for API calls)
- `@expo/vector-icons` ✅

If any are missing:
```bash
npm install react-native-svg react-native-reanimated react-native-gesture-handler axios
```

### Step 2: Copy Components to Your Project

The following files have been created/provided:

1. **GraphView.tsx** → `components/GraphView.tsx`
   - Core graph rendering component
   - Physics simulation engine
   - Interactive node/edge rendering

2. **GraphScreen.tsx** → `screens/GraphScreen.tsx`
   - Main screen component
   - Data fetching and state management
   - Modal for node details
   - View filtering (All/Users/Devices/Suspicious)

3. **graphAPI.ts** → `services/graphAPI.ts`
   - API service for backend communication
   - Data transformation utilities
   - Token management

### Step 3: Environment Configuration

Create or update `.env` file in your project root:

```env
REACT_APP_API_BASE_URL=http://localhost:5000/api/intelligence
```

Or for production:
```env
REACT_APP_API_BASE_URL=https://your-api-domain.com/api/intelligence
```

---

## 🧭 Navigation Integration

### Option 1: Replace SecurityGraphScreen (Recommended)

Update your navigation file to use the new GraphScreen:

**File**: `navigation/RootNavigator.tsx`

```typescript
// BEFORE
import SecurityGraphScreen from "@/screens/SecurityGraphScreen";

// AFTER - Replace with
import GraphScreen from "@/screens/GraphScreen";

// In your stack configuration:
export type RootStackParamList = {
  // ... other screens ...
  SecurityGraph: undefined;  // Keep same name or update everywhere
};

// In your Stack.Navigator:
<Stack.Screen
  name="SecurityGraph"
  component={GraphScreen}  // Use new component
  options={getCommonScreenOptions('Security Graph')}
/>
```

### Option 2: Keep Both Screens

If you want to keep the old SecurityGraphScreen and add the new one:

```typescript
import SecurityGraphScreen from "@/screens/SecurityGraphScreen";
import GraphScreen from "@/screens/GraphScreen";

export type RootStackParamList = {
  // ... existing screens ...
  SecurityGraph: undefined;
  IntelligenceGraph: undefined;  // NEW
};

// In Stack.Navigator
<Stack.Screen
  name="SecurityGraph"
  component={SecurityGraphScreen}
/>

<Stack.Screen
  name="IntelligenceGraph"
  component={GraphScreen}
  options={getCommonScreenOptions('Intelligence Graph')}
/>
```

---

## 🔐 Authentication Setup

The GraphScreen automatically handles JWT tokens. Ensure your AuthContext provides tokens properly:

### In Your AuthContext or Login Service:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// After successful login
const handleLoginSuccess = async (token: string) => {
  // Save JWT token
  await AsyncStorage.setItem('jwt_token', token);
  
  // Also set it in the GraphAPIService
  import { GraphAPIService } from '@/services/graphAPI';
  GraphAPIService.setToken(token);
};
```

### Or in Your Login Screen:

```typescript
import GraphAPIService from '@/services/graphAPI';

const onLoginSuccess = async (token: string) => {
  // Your existing login logic...
  
  // Initialize GraphAPIService with token
  await GraphAPIService.setToken(token);
  
  // Token will be automatically loaded from AsyncStorage on app restart
};
```

---

## 🚀 Usage

### Basic Usage

```typescript
import GraphScreen from '@/screens/GraphScreen';

// The screen automatically:
// 1. Loads JWT token from AsyncStorage
// 2. Fetches graph data from backend
// 3. Renders interactive visualization
// 4. Handles node selection and details modal
// 5. Provides filtering views
```

### Programmatic Navigation

```typescript
import { useNavigation } from '@react-navigation/native';

const SomeScreen = () => {
  const navigation = useNavigation();
  
  const openGraphScreen = () => {
    navigation.navigate('SecurityGraph');
  };
  
  return (
    <Button onPress={openGraphScreen} title="View Security Graph" />
  );
};
```

---

## 📊 Backend API Integration

### Required Backend Endpoints

The GraphScreen requires these endpoints to function:

```
GET  /api/intelligence/graph/relationships
     - Returns all graph relationships
     - Auth: Required (Bearer token)
     - Response: { success: true, data: [...relationships] }

GET  /api/intelligence/graph/user/:userId/relationships
     - Returns relationships for a specific user
     - Auth: Required
     - Response: { success: true, data: [...relationships] }

GET  /api/intelligence/graph/device/:deviceId/relationships
     - Returns relationships for a specific device
     - Auth: Required

GET  /api/intelligence/graph/suspicious-clusters
     - Returns only suspicious/risky relationships
     - Auth: Required

GET  /api/intelligence/graph/stats
     - Returns graph statistics
     - Auth: Required
     - Response: { totalNodes, totalEdges, riskyConnections, averageConnectionsPerNode }

POST /api/intelligence/graph/create-relationship
     - Creates new entity relationship
     - Auth: Required
     - Body: { sourceEntity, targetEntity, relationshipType, context }
```

### Response Format

```typescript
interface GraphRelationship {
  _id?: string;
  from: string;          // Source entity ID
  to: string;            // Target entity ID
  relation: string;      // Relationship type (e.g., "USES", "MAKES", "OWNS")
  isRisky?: boolean;     // Whether relationship is suspicious
  weight?: number;       // Connection strength (0-1)
  metadata?: {           // Optional metadata
    connectionStrength?: number;
    lastUpdated?: string;
  };
}
```

### Sample API Response

```json
{
  "success": true,
  "data": [
    {
      "from": "user_123abc",
      "to": "device_device001",
      "relation": "USES",
      "isRisky": false,
      "weight": 0.8
    },
    {
      "from": "user_123abc",
      "to": "txn_456def",
      "relation": "MAKES",
      "isRisky": false
    },
    {
      "from": "device_device001",
      "to": "user_789ghi",
      "relation": "USED_BY",
      "isRisky": true,
      "weight": 0.6
    }
  ]
}
```

---

## 🎯 Features

### 1. **Interactive Graph Visualization**
- Nodes represent entities (users, devices, transactions, sessions)
- Edges represent relationships between entities
- Physics-based layout with force simulation
- Smooth animations and interactions

### 2. **Color Coding**
- **Blue**: Users
- **Green**: Devices
- **Orange**: Transactions
- **Purple**: Sessions

**Risk Colors**:
- **Red**: Critical risk (75+)
- **Orange**: High risk (50-75)
- **Yellow**: Medium risk (25-50)
- **Green**: Low risk (0-25)

### 3. **View Filters**
- **All**: Display all entities
- **Users**: Show only user entities
- **Devices**: Show only device entities
- **Risky**: Show only high-risk entities (score > 50)

### 4. **Node Details Modal**
When you tap a node:
- Entity ID and type
- Risk score with progress bar
- Number of connections
- List of related entities
- Quick action buttons (View Details, Report)

### 5. **Statistics Badge**
Displays real-time graph statistics:
- Total nodes
- Total relationships
- Risky connections

### 6. **Refresh Control**
- Pull-to-refresh gesture
- Manual refresh button
- Loading indicators
- Error handling with retry

---

## 🔧 Customization

### Adjust Physics Simulation

Edit `components/GraphView.tsx`:

```typescript
const PHYSICS_CONFIG = {
  repulsion: 100,        // ↑ Increase for more space between nodes
  attraction: 0.1,       // ↑ Increase for tighter clusters
  damping: 0.85,         // ↑ Increase for slower settling
  minDistance: 30,       // ↓ Decrease to allow closer nodes
  maxDistance: 300,      // ↓ Decrease to cluster more tightly
};
```

### Customize Colors

In `components/GraphView.tsx`:

```typescript
const NODE_COLORS = {
  user: '#3498DB',        // Change these hex colors
  device: '#2ECC71',
  transaction: '#F39C12',
  session: '#9B59B6',
};
```

### Change Animation Speed

In `screens/GraphScreen.tsx`:

```typescript
const AnimatedView = (
  <Animated.View
    entering={FadeIn.duration(800)}  // ← Change duration
    // ...
  >
    {children}
  </Animated.View>
);
```

### Adjust Node Size

In `components/GraphView.tsx`:

```typescript
const getNodeRadius = (connectionCount: number = 1): number => {
  return Math.min(20 + connectionCount * 2, 35);  // ← Adjust these numbers
};
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module './graphAPI'"

**Solution**: Ensure `services/graphAPI.ts` is created in the correct location:
```
APP1/
  services/
    graphAPI.ts  ← Should be here
```

### Issue: "No authentication token available"

**Solution**: 
```typescript
// In your login flow, ensure token is saved:
import GraphAPIService from '@/services/graphAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function handleLogin(token) {
  await AsyncStorage.setItem('jwt_token', token);
  await GraphAPIService.setToken(token);
}
```

### Issue: Graph appears empty

**Troubleshooting**:
1. Check backend is running: `curl http://localhost:5000`
2. Verify API URL in `.env`: `REACT_APP_API_BASE_URL`
3. Check network is reachable from device
4. View console logs for API errors
5. Ensure token is valid and not expired

```typescript
// Add debug logging
import GraphAPIService from '@/services/graphAPI';

const debug = async () => {
  const token = await GraphAPIService.getStoredToken();
  console.log('Token:', token ? 'Present' : 'Missing');
  
  try {
    const data = await GraphAPIService.getAllRelationships();
    console.log('Graph data:', data);
  } catch (error) {
    console.error('API error:', error.message);
  }
};
```

### Issue: Graph not interactive / nodes don't move

**Solution**: Ensure animation is enabled:
```typescript
<GraphView
  // ... other props ...
  animationEnabled={true}  // ← Must be true
/>
```

### Issue: Modal doesn't close

**Solution**: Check the closeModal function is properly bound:
```typescript
const closeModal = useCallback(() => {
  // Implementation should close the modal
  setModalVisible(false);
}, []);
```

---

## 📈 Performance Optimization

### For Large Graphs (100+ nodes)

1. **Reduce animation frequency**:
```typescript
// In components/GraphView.tsx, change the interval
animationRef.current = setInterval(simulate, 50);  // ← Increase from 30
```

2. **Limit node rendering**:
```typescript
// Cluster nearby nodes or use viewport culling
const visibleNodes = nodes.filter(n => isInViewport(n));
```

3. **Memoize expensive calculations**:
```typescript
const memoizedEdges = useMemo(() => 
  edges.map(/* ... */), 
  [edges, selectedNodeId]
);
```

4. **Use `React.memo` for sub-components**:
```typescript
const NodeComponent = React.memo(({ node, ... }) => {
  // Component code
});
```

### Monitor Performance

```typescript
// Add FPS counter
import { FrameRateMonitor } from 'react-native-performance';

<FrameRateMonitor
  expectedFps={60}
  onWarning={() => console.warn('Frame rate dropping')}
/>
```

---

## 🚢 Deployment

### Before Deploying to Production

1. **Update API URL**:
```env
# .env.production
REACT_APP_API_BASE_URL=https://your-production-api.com/api/intelligence
```

2. **Test with real data**:
```bash
npm run build
npx eas build --platform ios  # or android
```

3. **Verify authentication**:
```typescript
// Ensure token refresh logic works
const refreshToken = async () => {
  // Token refresh implementation
};
```

4. **Test on real device**:
```bash
npx eas build --platform ios --profile preview
npx eas build:run --ios
```

### Build Commands

```bash
# Development
npm run dev

# Web
npm run web

# Android
npm run android

# iOS
npm run ios

# Expo build
npx eas build --platform ios
npx eas build --platform android
```

---

## 📝 Code Examples

### Example 1: Navigate to Graph and Pass User ID

```typescript
const handleShowGraph = async (userId: string) => {
  // Optionally pre-load user-specific graph
  import GraphAPIService from '@/services/graphAPI';
  const { nodes, edges } = await GraphAPIService.getUserGraph(userId);
  
  // Navigate
  navigation.navigate('SecurityGraph', { userId, initialData: { nodes, edges } });
};
```

### Example 2: Handle Node Selection Programmatically

```typescript
// In parent component
const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

<GraphScreen
  onNodeSelect={(node) => {
    setSelectedNode(node);
    // Perform additional actions
    console.log('Selected:', node.id);
  }}
/>
```

### Example 3: Real-time Graph Updates

```typescript
// Poll for updates every 30 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const newData = await GraphAPIService.getAllRelationships();
    setNodes(newData.nodes);
    setEdges(newData.edges);
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

### Example 4: Export Graph as Image

```typescript
import { captureRef } from 'react-native-view-shot';

const saveGraphAsImage = async () => {
  const ref = useRef(null);
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 0.8,
  });
  // Share or save uri
};
```

---

## 🎓 Next Steps

1. ✅ Install components and configure
2. ✅ Test with development backend
3. ✅ Customize colors/styles to match your theme
4. ✅ Add additional filters or features
5. ✅ Deploy to production
6. ✅ Monitor performance and optimize

---

## 📞 Support & Issues

### Common Questions

**Q: Can I customize the graph layout?**
A: Yes! Adjust `PHYSICS_CONFIG` in `GraphView.tsx` to change node spacing and settling behavior.

**Q: How do I add custom node types?**
A: Add to the `NODE_COLORS` object and update `inferNodeType()` function in `graphAPI.ts`.

**Q: Can I integrate with a real-time database?**
A: Yes! Replace the API calls with WebSocket listeners in `useEffect` hooks.

**Q: How do I handle offline mode?**
A: Cache graph data in AsyncStorage and show cached version when offline.

---

## 📚 API Reference

### GraphAPIService Methods

```typescript
// Fetch user's graph relationships
GraphAPIService.getUserGraph(userId: string)

// Fetch device's graph relationships
GraphAPIService.getDeviceGraph(deviceId: string)

// Fetch all relationships
GraphAPIService.getAllRelationships()

// Fetch suspicious clusters
GraphAPIService.getSuspiciousClusters()

// Get graph statistics
GraphAPIService.getGraphStats()

// Create new relationship
GraphAPIService.createRelationship(
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  relationshipType: string,
  metadata?: Record<string, any>
)

// Set authentication token
GraphAPIService.setToken(token: string)

// Get stored token
GraphAPIService.getStoredToken(): Promise<string | null>
```

---

## 🎉 You're All Set!

Your React Native app now has a powerful, interactive graph visualization dashboard. Start the app and navigate to the security graph screen to see your intelligence data in action!

```bash
cd APP1
npm run dev
# Navigate to "SecurityGraph" screen
```

Happy visualizations! 🚀
