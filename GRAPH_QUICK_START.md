# 🚀 Graph Visualization Dashboard - Quick Start

**⏱️ Time to integrate: 10-15 minutes**

## What You're Getting

An interactive, real-time graph visualization dashboard that shows:
- Entity relationships (users ↔ devices ↔ transactions)
- Risk scoring with visual indicators
- Suspicious pattern detection
- Physics-based layout with smooth animations
- Tap nodes to see details
- Multiple view filters (All, Users, Devices, Risky)

---

## 5-Minute Setup

### 1. Copy the Files

```bash
cd APP1

# These files should already be created:
# ✅ components/GraphView.tsx
# ✅ screens/GraphScreen.tsx
# ✅ services/graphAPI.ts
```

### 2. Update Navigation

Open `navigation/RootNavigator.tsx` and update the import:

```diff
- import SecurityGraphScreen from "@/screens/SecurityGraphScreen";
+ import GraphScreen from "@/screens/GraphScreen";

  export type RootStackParamList = {
    // ... keep existing ...
    SecurityGraph: undefined;
  };

  // In Stack.Navigator:
  <Stack.Screen
    name="SecurityGraph"
-   component={SecurityGraphScreen}
+   component={GraphScreen}
    options={getCommonScreenOptions('Security Graph')}
  />
```

### 3. Initialize Token in Login

In your login success handler, add:

```typescript
import GraphAPIService from '@/services/graphAPI';

// After successful login
const handleLoginSuccess = async (token: string) => {
  // Your existing login logic...
  
  // NEW: Initialize graph API
  await GraphAPIService.setToken(token);
};
```

### 4. Done! 🎉

That's it! The app will:
- ✅ Load JWT token automatically
- ✅ Fetch graph data from backend
- ✅ Render interactive visualization
- ✅ Handle all interactions

---

## Test It

```bash
# Start your backend (if not running)
cd APP1/backend
npm run dev

# In another terminal, start the app
cd APP1
npm start

# Navigate to "SecurityGraph" screen
```

You should see:
- Interactive graph with nodes and connections
- Statistics in bottom-right corner
- View filter buttons at bottom
- Tap any node to see details

---

## What Each File Does

| File | Purpose |
|------|---------|
| **components/GraphView.tsx** | Renders the graph (nodes, edges, animations) |
| **screens/GraphScreen.tsx** | Main screen, fetches data, manages state |
| **services/graphAPI.ts** | Talks to backend API, transforms data |

---

## Customization (5 minutes)

### Change Node Colors

**File**: `components/GraphView.tsx`

```typescript
const NODE_COLORS = {
  user: '#3498DB',        // ← Blue (users)
  device: '#2ECC71',      // ← Green (devices)
  transaction: '#F39C12', // ← Orange (transactions)
  session: '#9B59B6',     // ← Purple (sessions)
};
```

### Adjust Physics (nodes closer/farther apart)

**File**: `components/GraphView.tsx`

```typescript
const PHYSICS_CONFIG = {
  repulsion: 100,    // ↑ Higher = more space between nodes
  attraction: 0.1,   // ↑ Higher = tighter clusters
  damping: 0.85,     // ↑ Higher = slower settling
  minDistance: 30,   // ← Minimum space between nodes
  maxDistance: 300,  // ← Maximum link distance
};
```

### Change API Base URL

**File**: `.env`

```env
REACT_APP_API_BASE_URL=http://localhost:5000/api/intelligence
```

For production:
```env
REACT_APP_API_BASE_URL=https://your-api.com/api/intelligence
```

---

## Troubleshooting

### Graph is empty?

```typescript
// Add logging to debug
import GraphAPIService from '@/services/graphAPI';

// In your component
useEffect(() => {
  GraphAPIService.getAllRelationships()
    .then(data => console.log('Graph:', data))
    .catch(err => console.error('Error:', err));
}, []);
```

**Check**:
1. Backend is running: `curl http://localhost:5000`
2. Token is saved: `npm run dev` → Check console logs
3. API responding: Test endpoint in Postman
4. Network accessible: Use correct IP/domain

### Nodes not moving?

Ensure `animationEnabled={true}` in GraphView props (it's enabled by default).

### Modal doesn't open when tapping nodes?

Check console for errors. Ensure:
1. Modal state is properly managed
2. TouchableOpacity on nodes is working
3. Theme colors are accessible

### Token not persisting?

```typescript
// Make sure you're setting it after login
import AsyncStorage from '@react-native-async-storage/async-storage';

// After login success
await AsyncStorage.setItem('jwt_token', token);

// GraphAPIService will auto-load it
```

---

## Feature Walkthrough

### 📊 Main Screen

```
┌─────────────────────────────────┐
│ Security Graph    [⟳ Refresh]  │ ← Header
├─────────────────────────────────┤
│                                  │
│     Interactive Graph Here       │ ← Main canvas
│     (Tap nodes for details)      │
│                                  │
│                     [📊 Stats]   │ ← Bottom-right badge
├─────────────────────────────────┤
│  [All]  [Users]  [Devices] [⚠️] │ ← Filter buttons
└─────────────────────────────────┘
```

### 🎨 Node Details Modal

When you tap a node:

```
┌─────────────────────────────────┐
│ USER123ABC                  [✕]  │
│ Type: USER                       │
├─────────────────────────────────┤
│ ⚠️  Risk Score                   │
│ ║████████░░░░░░░░░░ 45% HIGH     │
│                                  │
│ 🔗 Connected Entities: 3         │
│                                  │
│ 🔀 Related Entities              │
│    ├─ DEV456ABC                  │
│    ├─ TXN789DEF                  │
│    └─ SESS000GHI                 │
│                                  │
│ 📋 Entity ID                     │
│    user_123456789abcdef          │
│                                  │
│ [👁️ View Details] [🚩 Report]   │
└─────────────────────────────────┘
```

### 🎛️ View Filters

- **All**: Show all entities
- **Users**: Only user nodes
- **Devices**: Only device nodes
- **Risky**: Only high-risk nodes (score > 50)

---

## Backend Requirements

Your backend needs these endpoints:

```
GET  /api/intelligence/graph/relationships
GET  /api/intelligence/graph/user/:userId/relationships
GET  /api/intelligence/graph/device/:deviceId/relationships
GET  /api/intelligence/graph/suspicious-clusters
GET  /api/intelligence/graph/stats
POST /api/intelligence/graph/create-relationship
```

All require `Authorization: Bearer {token}` header.

Sample response:
```json
{
  "success": true,
  "data": [
    { "from": "user123", "to": "device001", "relation": "USES", "isRisky": false },
    { "from": "device001", "to": "user456", "relation": "USED_BY", "isRisky": true }
  ]
}
```

---

## Color Guide

### Node Types
- 🔵 **Blue** = User
- 🟢 **Green** = Device
- 🟠 **Orange** = Transaction
- 🟣 **Purple** = Session

### Risk Levels (ring around nodes)
- 🟢 **Green** = Safe (0-25%)
- 🟡 **Yellow** = Medium (25-50%)
- 🟠 **Orange** = High (50-75%)
- 🔴 **Red** = Critical (75-100%)

### Connections
- **Solid line** = Safe connection
- **Dashed line** = Risky connection

---

## Common Tasks

### Programmatically Navigate to Graph

```typescript
import { useNavigation } from '@react-navigation/native';

const SomeScreen = () => {
  const nav = useNavigation();
  
  return (
    <Button 
      title="View Graph" 
      onPress={() => nav.navigate('SecurityGraph')}
    />
  );
};
```

### Refresh Graph Data

The GraphScreen auto-refreshes. To manually trigger:

```typescript
// The pull-to-refresh gesture automatically loads fresh data
// Or use the refresh button in the header
```

### Access Graph Data Programmatically

```typescript
import GraphAPIService from '@/services/graphAPI';

const fetchGraphData = async () => {
  const { nodes, edges } = await GraphAPIService.getAllRelationships();
  console.log('Nodes:', nodes);
  console.log('Edges:', edges);
};
```

### Show Only Suspicious Entities

The "Risky" filter button does this automatically, or:

```typescript
const susiciousData = await GraphAPIService.getSuspiciousClusters();
// Filter to nodes with riskScore > 50
```

---

## Performance Tips

For large graphs (100+ nodes):

**Increase simulation interval** (slower updates, better performance):
```typescript
// In GraphView.tsx, line ~75
animationRef.current = setInterval(simulate, 50);  // was 30
```

**Reduce node count with filtering**:
Use the view filters and suspicious cluster view instead of showing all nodes.

**Enable production mode**:
```bash
npm run build  # Optimizes JavaScript
npx eas build --platform ios
```

---

## Advanced: Custom Styling

### Match Your App Theme

All colors automatically adapt to your theme. The GraphView uses:
- `theme.primary` - Main color
- `theme.background` - Background
- `theme.card` - Card backgrounds
- `theme.text` - Text color
- `theme.error` - Error indicators

No changes needed—it works automatically!

### Add Custom Badges

Edit `screens/GraphScreen.tsx` to add custom badges:

```typescript
{/* Add this after graphStats badge */}
{customData && (
  <View style={styles.badge}>
    <Text>Custom Badge</Text>
  </View>
)}
```

---

## Testing Checklist

- [ ] Components copied to correct locations
- [ ] Navigation updated
- [ ] Token initialized after login
- [ ] Backend running and accessible
- [ ] Graph loads without errors
- [ ] Nodes are interactive
- [ ] Modal opens when tapping nodes
- [ ] View filters work
- [ ] Refresh button loads new data
- [ ] No memory leaks (check React DevTools)

---

## Next Steps

1. ✅ **Quick Setup** (10 mins) - Follow 4 steps above
2. ✅ **Test Locally** (5 mins) - Run app and navigate to graph
3. ✅ **Customize** (15 mins) - Adjust colors, physics
4. ✅ **Deploy** (30 mins) - Build and release

---

## Help!

**Still stuck?** Check:

1. **Console logs** - Look for error messages
2. **Network tab** - See if API calls succeed
3. **Backend logs** - Ensure endpoints are responding
4. **AsyncStorage** - Verify token is saved
5. **Full guide** - Read `GRAPH_INTEGRATION_GUIDE.md`

---

## 🎉 You're Ready!

Your graph visualization dashboard is ready to go. Start building amazing features on top of it!

```bash
npm start
# Navigate to SecurityGraph screen
# Tap nodes to explore relationships
```

Happy graphing! 🚀
