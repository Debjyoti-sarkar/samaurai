# ✅ Graph Dashboard Integration Checklist

Use this checklist to ensure complete and successful integration of the graph visualization dashboard.

---

## 📋 Pre-Integration Setup

- [ ] Backend running: `cd APP1/backend && npm run dev`
- [ ] API accessible: `curl http://localhost:5000/api/intelligence`
- [ ] JWT endpoints working (login returns token)
- [ ] AsyncStorage available in React Native
- [ ] Navigation structure understood

---

## 📁 File Setup (Copy/Create)

### Required New Files
- [ ] Copy `components/GraphView.tsx` → Check it exists in project
- [ ] Copy `screens/GraphScreen.tsx` → Check it exists in project  
- [ ] Copy `services/graphAPI.ts` → Check it exists in project

### Verification
```bash
# Run this to verify files exist:
ls -la APP1/components/GraphView.tsx
ls -la APP1/screens/GraphScreen.tsx
ls -la APP1/services/graphAPI.ts
```

Expected output: `total XXX` for each file (file exists)

---

## 🧭 Navigation Integration

### Step 1: Update Imports
**File**: `navigation/RootNavigator.tsx`

```typescript
// Line ~48 (where imports are)

// ❌ REMOVE or comment out:
// import SecurityGraphScreen from "@/screens/SecurityGraphScreen";

// ✅ ADD:
import GraphScreen from "@/screens/GraphScreen";
```

**Checklist**:
- [ ] Found import line for SecurityGraphScreen
- [ ] Commented out or removed it
- [ ] Added import for GraphScreen
- [ ] No syntax errors

### Step 2: Update Stack Navigation
**File**: `navigation/RootNavigator.tsx`

Find the line in `Stack.Navigator` that has:
```typescript
<Stack.Screen
  name="SecurityGraph"
  component={SecurityGraphScreen}
  // ...
/>
```

Change to:
```typescript
<Stack.Screen
  name="SecurityGraph"
  component={GraphScreen}
  options={getCommonScreenOptions('Security Graph')}
/>
```

**Checklist**:
- [ ] Found SecurityGraph stack screen
- [ ] Changed component from SecurityGraphScreen to GraphScreen
- [ ] Kept the same screen name ("SecurityGraph")
- [ ] File saves without errors
- [ ] No TypeScript errors

---

## 🔐 Authentication Setup

### Step 1: Initialize GraphAPIService on Login
**File**: Your login screen or auth service

Find the code that handles successful login:

```typescript
// BEFORE
const handleLoginSuccess = async (token: string) => {
  // Existing logic...
  setAuthStep("authenticated");
};

// AFTER
import GraphAPIService from "@/services/graphAPI";

const handleLoginSuccess = async (token: string) => {
  // Existing logic...
  setAuthStep("authenticated");
  
  // NEW: Initialize GraphAPIService
  await GraphAPIService.setToken(token);
};
```

**Checklist**:
- [ ] Located login success handler
- [ ] Added import for GraphAPIService
- [ ] Added `GraphAPIService.setToken(token)` call
- [ ] Token is passed correctly from login response
- [ ] No syntax errors

### Step 2: Verify AsyncStorage
**File**: Any file with AsyncStorage

Check that AsyncStorage is properly imported:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

**Checklist**:
- [ ] AsyncStorage already in package.json
- [ ] Import statement in your auth flow
- [ ] Used for storing JWT token

---

## ⚙️ Configuration

### Environment Setup
**File**: Create `.env` file in project root (if doesn't exist)

```env
# Development
REACT_APP_API_BASE_URL=http://localhost:5000/api/intelligence

# Later for production, change to:
# REACT_APP_API_BASE_URL=https://your-api.com/api/intelligence
```

**Checklist**:
- [ ] .env file created in APP1 root directory
- [ ] REACT_APP_API_BASE_URL set correctly
- [ ] Matches your backend API port (5000)
- [ ] No trailing slashes

### Verify package.json Dependencies
**File**: `package.json`

Ensure these are present:
```json
{
  "dependencies": {
    "react-native-svg": "^15.8.0",
    "react-native-reanimated": "~4.1.1",
    "react-native-gesture-handler": "~2.28.0",
    "axios": "^1.13.2",
    "@react-native-async-storage/async-storage": "^2.2.0"
  }
}
```

**Checklist**:
- [ ] All 5 packages listed in dependencies
- [ ] Versions match or are higher
- [ ] If any missing, run: `npm install [package-name]`

---

## 🧪 Pre-Flight Tests

### Test 1: Files Import Correctly
**In your project terminal**:

```bash
cd APP1
npm start
# Wait for compilation to complete
```

**Checklist**:
- [ ] No import errors in console
- [ ] No "Cannot find module" errors
- [ ] Compilation completes successfully
- [ ] App loads in simulator/device

### Test 2: Navigation Works
```typescript
// In any screen, test this:
import { useNavigation } from '@react-navigation/native';

const TestNav = () => {
  const nav = useNavigation();
  return (
    <Button 
      title="Test Graph" 
      onPress={() => nav.navigate('SecurityGraph')}
    />
  );
};
```

**Checklist**:
- [ ] Can navigate to SecurityGraph screen
- [ ] Screen appears (shows activity indicator)
- [ ] No crashes

### Test 3: API Token Available
```typescript
// In GraphScreen or any component:
import GraphAPIService from '@/services/graphAPI';

useEffect(() => {
  GraphAPIService.getStoredToken().then(token => {
    console.log('Token:', token ? 'Found ✓' : 'Missing ✗');
  });
}, []);
```

**Checklist**:
- [ ] Token is found after login
- [ ] Token appears in console logs
- [ ] Token is not null/undefined

---

## 🚀 First Run Test

### Complete Integration Test

```bash
# 1. Start backend (if not running)
cd APP1/backend
npm run dev

# 2. In another terminal, start app
cd APP1
npm start

# 3. In simulator/device
# - Login with valid credentials
# - Navigate to "SecurityGraph" (from settings or custom button)
# - Wait 2-3 seconds for graph to load
```

### What to look for:

✅ **Expected Success State**:
```
┌────────────────────────────┐
│ Security Graph      [⟳]   │
├────────────────────────────┤
│                             │
│   ◯─────────────◯           │
│  / \           / \          │
│ ◯───◯──────→◯──◯──◯         │
│  \ /           \ /          │
│   ◯─────────────◯           │
│                             │
├────────────────────────────┤
│ [All] [Users] [Devices] [⚠️]│
└────────────────────────────┘
```

❌ **Issues & Solutions**:

| Issue | Cause | Solution |
|-------|-------|----------|
| Graph empty | No data | Check backend is running, API endpoints work |
| Loading forever | API timeout | Verify API URL in .env, check network |
| No token error | Auth not set | Ensure GraphAPIService.setToken() called after login |
| Import error | Files missing | Verify GraphView.tsx, GraphScreen.tsx, graphAPI.ts exist |
| Nodes not moving | Animation off | animationEnabled should be true in GraphView props |
| Modal doesn't work | State issue | Check console for errors, verify modal state management |

**Checklist**:
- [ ] Graph displays (not empty)
- [ ] Nodes visible and animated
- [ ] Can see node labels
- [ ] Footer buttons visible
- [ ] Stats badge present
- [ ] No error messages in console
- [ ] No red screens/crashes

---

## 🎨 Customization Checklist (Optional)

### Change Colors
- [ ] Navigate to `components/GraphView.tsx`
- [ ] Find NODE_COLORS object (around line 30)
- [ ] Update hex colors as desired
- [ ] Save and verify in app

Example color schemes:
```typescript
// Tech/Blue
const NODE_COLORS = {
  user: '#0066CC',      // Deep blue
  device: '#00CC99',    // Teal
  transaction: '#FFAA00', // Amber
  session: '#AA00FF',   // Purple
};

// Warm
const NODE_COLORS = {
  user: '#E74C3C',      // Red
  device: '#F39C12',    // Orange
  transaction: '#F1C40F', // Yellow
  session: '#95A5A6',   // Gray
};
```

### Adjust Physics
- [ ] Navigate to `components/GraphView.tsx`
- [ ] Find PHYSICS_CONFIG object (around line 45)
- [ ] Adjust values:
  - `repulsion: 100` - Spacing (↑ more space)
  - `attraction: 0.1` - Clustering (↑ tighter)
  - `damping: 0.85` - Speed (↑ slower)
- [ ] Test in app

### Set Production API URL
- [ ] Update `.env` file
- [ ] Change REACT_APP_API_BASE_URL to production domain
- [ ] Rebuild app
- [ ] Test with production API

**Checklist**:
- [ ] All customizations applied
- [ ] App tested after changes
- [ ] No errors introduced

---

## 🔍 Verification Tests

### Test Node Selection
```
1. Navigate to SecurityGraph
2. Wait for graph to load
3. Tap on any blue circle (user node)
4. Modal should appear at bottom
5. Modal shows entity details
6. Tap [✕] to close
7. Modal disappears smoothly
✓ Nodes are interactive
```

**Checklist**:
- [ ] Can tap multiple nodes
- [ ] Modal appears each time
- [ ] Modal closes properly
- [ ] No crashes

### Test Filtering
```
1. Graph showing all entities
2. Tap [Users] button
3. Graph updates to show only blue nodes
4. Tap [Risky] button  
5. Graph shows only high-risk entities
6. Tap [All] to reset
7. All entities return
✓ Filtering works
```

**Checklist**:
- [ ] Each filter changes display
- [ ] Correct entity types shown
- [ ] No lag between filters

### Test Refresh
```
1. Graph displayed
2. Pull down (refresh gesture)
3. Spinner appears
4. Data reloads
5. Statistics update
✓ Refresh works
```

**Checklist**:
- [ ] Refresh gesture detected
- [ ] Loading state shows
- [ ] Data updated
- [ ] Smooth animation

### Test Error Handling
```
1. Kill backend server
2. Trigger refresh in graph
3. Error message appears
4. [Retry] button present
5. Tap retry
6. Restart backend
7. Retry succeeds
✓ Error handling works
```

**Checklist**:
- [ ] Errors display clearly
- [ ] Retry button works
- [ ] App doesn't crash on error

---

## 🚢 Pre-Deployment Checklist

### Code Quality
- [ ] No console.error or console.warn (except expected from libraries)
- [ ] No TypeScript errors: `npm run lint` passes
- [ ] No unused variables or imports
- [ ] All JSDoc comments present
- [ ] Code follows project style guide

### Performance
- [ ] Graph loads in < 3 seconds
- [ ] No janky animations
- [ ] No memory leaks (test with 50+ node interactions)
- [ ] 60 FPS on target device

### Security
- [ ] JWT token stored securely
- [ ] No tokens in console logs
- [ ] HTTPS enabled (production)
- [ ] API credentials not exposed
- [ ] User data properly protected

### Testing
- [ ] Tested on iOS device ✓
- [ ] Tested on Android device ✓
- [ ] Tested with 10+ entities ✓
- [ ] Tested with 100+ entities ✓
- [ ] Tested network error scenarios ✓
- [ ] Tested token expiration ✓

### Documentation
- [ ] GRAPH_QUICK_START.md reviewed
- [ ] GRAPH_INTEGRATION_GUIDE.md reviewed
- [ ] Code comments accurate
- [ ] API endpoint documentation updated
- [ ] Team informed of changes

### Build Verification
```bash
# Before deploying
npm run lint          # Should pass
npm run build         # Should succeed
npx eas build --platform ios   # or android
```

- [ ] All build commands succeed
- [ ] No warnings in build output
- [ ] Bundle size reasonable

---

## 📞 Support Checklist

If you encounter issues, check:

### Graph Won't Load
- [ ] Backend API running: `curl http://localhost:5000`
- [ ] API URL correct in `.env`
- [ ] JWT token present: `await GraphAPIService.getStoredToken()`
- [ ] Network accessible from device (not just localhost)
- [ ] Check backend logs for errors

### Nodes Not Interactive
- [ ] Check console for JS errors
- [ ] Verify TouchableOpacity wrapper present
- [ ] Ensure modal state initialized
- [ ] Test with one known working node
- [ ] Check GestureHandler installation

### Performance Issues  
- [ ] Reduce physics interval (from 30 to 50ms)
- [ ] Filter to fewer nodes using view filters
- [ ] Test on actual device (not simulator)
- [ ] Check memory usage with React DevTools
- [ ] Profile with Flamegraph

### Type Errors
- [ ] Check types file structure
- [ ] Verify GraphNode and GraphEdge interfaces
- [ ] Ensure proper typing in API responses
- [ ] Run `npm run lint` to detect issues

**Final Support Checklist**:
- [ ] Reviewed troubleshooting section
- [ ] Checked console logs
- [ ] Verified all dependencies
- [ ] Tested backend connectivity
- [ ] Reviewed documentation

---

## ✅ Final Verification

Once everything is working, verify:

```typescript
// GraphScreen should:
✓ Display graph visualization
✓ Show entity nodes with colors
✓ Draw relationship edges
✓ Animate physics simulation
✓ Allow node selection
✓ Show details modal
✓ Support view filtering
✓ Handle refresh
✓ Display statistics
✓ Handle errors gracefully
✓ Respond to user input
✓ Maintain theme colors
✓ Perform smoothly
```

---

## 🎉 Success Criteria

Your integration is complete when:

- ✅ App compiles without errors
- ✅ Navigation to GraphScreen works
- ✅ Graph loads with real data
- ✅ Nodes are interactive
- ✅ Filtering works
- ✅ Refresh loads new data
- ✅ No crashes or hangs
- ✅ Looks good on target devices
- ✅ Documentation updated
- ✅ Team trained on usage

---

## 📝 Sign-Off

Integration completed by: ________________

Date: ________________

Notes: _________________________________________________________________

Ready for deployment: [ ] YES [ ] NO

---

**Once you have all checkmarks, your Graph Dashboard is ready for production!** 🚀
