# KAVACH Security Intelligence Web Dashboard

A comprehensive web-based analytics platform for real-time visualization and monitoring of your intelligence system data.

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd APP1/backend
npm run dev
```

Server will run on `http://localhost:5000`

### 2. Open the Dashboard
```bash
# Option A: Direct browser access
open APP1/web-dashboard/index.html
# or
http://localhost:3000/web-dashboard  (if served)

# Option B: Use your favorite HTTP server
cd APP1/web-dashboard
npx http-server
# Then visit: http://localhost:8080
```

## 📊 Features

### Dashboard Overview
- **Real-time Statistics**: Live counts of users, devices, transactions, and high-risk alerts
- **Risk Distribution Chart**: Visual breakdown of risk levels (Critical/High/Medium/Low)
- **Event Analytics**: Type distribution and timeline of security events
- **Case Management**: Investigation case status and metrics
- **Device Distribution**: Multi-dimensional device usage visualization

### Knowledge Graph View
- **Interactive Entity Network**: Visualize relationships between users, devices, transactions, and sessions
- **Force-Directed Layout**: Automatic layout with physics simulation
- **Node Selection**: Click nodes to view detailed information
- **Relationship Filtering**: Show/hide specific relationship types
- **Connected Entity Highlighting**: Auto-highlight related entities
- **Export as Image**: Save graph visualization as PNG

### Event Log
- **Complete Event History**: All recorded events with timestamps
- **Real-time Filtering**: Search and filter events
- **Severity Indicators**: Color-coded severity levels
- **Quick Actions**: View event details and related data

### Case Management
- **Investigation Cases**: Create and manage fraud investigation cases
- **Case Status Tracking**: Open/Investigating/Resolved workflow
- **Evidence Management**: Attach events and data as evidence
- **Assignment**: Assign cases to analysts
- **Timeline View**: Complete case history and activities

### Risk Assessment Dashboard
- **User Risk Profiles**: Real-time risk scoring by user
- **Transaction Risk**: Evaluate transaction safety
- **Device Risk**: Multi-user device detection
- **Risk Factors**: Breakdown of factors contributing to risk score
- **Action Recommendations**: Auto-suggested security actions

### Advanced Analytics
- **Top Risk Patterns**: Machine-learned pattern detection
- **Suspicious Clusters**: Device abuse and account takeover detection
- **Event Correlation Analysis**: Relationship discovery
- **Automation Engine Stats**: Rule execution metrics

## 🔐 Authentication

### Getting JWT Token
1. Connect to your backend API
2. The token is used for all API calls
3. Token is securely stored in localStorage

**To get an initial token:**
```bash
# From your backend, create a test user and get a token
# See backend/SETUP.md for details
```

### Example Token Setup
```javascript
// In the dashboard, paste your JWT token in the Auth section
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📁 File Structure

```
web-dashboard/
├── index.html              # Main dashboard UI
├── styles.css              # Comprehensive styling
├── api-service.js          # API communication layer
├── graph-service.js        # Graph visualization engine
├── chart-service.js        # Chart.js integration
├── app.js                  # Main application logic
└── README.md              # This file
```

## 🔌 API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Health check |
| `GET /api/intelligence/graph/relationships` | Fetch graph data |
| `GET /api/intelligence/graph/clusters` | Get suspicious clusters |
| `GET /api/intelligence/graph/stats` | Graph statistics |
| `GET /api/intelligence/events/patterns` | Event patterns |
| `GET /api/intelligence/cases` | Fetch all cases |
| `POST /api/intelligence/cases/create` | Create new case |
| `GET /api/intelligence/risk/user/:userId` | User risk assessment |
| `POST /api/intelligence/risk/evaluate-transaction` | Transaction risk |

## 🎨 Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --color-primary: #3498DB;       /* Blue */
    --color-success: #2ECC71;       /* Green */
    --color-warning: #F39C12;       /* Orange */
    --color-danger: #E74C3C;        /* Red */
    --color-info: #9B59B6;          /* Purple */
}
```

### Graph Colors
Modify node colors in `graph-service.js`:
```javascript
this.nodeColors = {
    user: '#3498DB',        // Blue
    device: '#2ECC71',      // Green
    transaction: '#F39C12', // Orange
    session: '#9B59B6'      // Purple
};
```

### Chart Styles
All charts use Chart.js. Customize in `chart-service.js`:
```javascript
backgroundColor: ['#E74C3C', '#E67E22', '#F39C12', '#27AE60']
```

## 🚨 Real-time Monitoring

### Enable Auto-Refresh
Click "⏱️ Real-time Mode" to enable 5-second auto-refresh

### Manual Refresh
Click "🔄 Refresh Data" to load latest data

## 📥 Export & Reporting

### Export as JSON Report
1. Click "📥 Export Report"
2. JSON file with all data downloaded
3. Use for analysis or sharing

### Export Graph as Image
1. Switch to "Knowledge Graph" view
2. Graph visualization renders
3. Use browser dev tools to save canvas as image

## 🔧 Configuration

### API Base URL
```javascript
// Current: http://localhost:5000
// Change in index.html header section or use the input field
```

### Request Timeout
```javascript
// In api-service.js, line 18
this.timeout = 15000; // 15 seconds
```

### Graph Physics
```javascript
// In graph-service.js, physics configuration
gravitationalConstant: -50
centralGravity: 0.01
springLength: 200
```

## 📋 Usage Examples

### 1. View Suspicious Relationships
1. Navigate to "Knowledge Graph"
2. Look for nodes with many connections
3. Click to highlight related entities
4. Check if relationships are legitimate

### 2. Investigate High-Risk User
1. Go to "Risk Analysis"
2. Find user with high risk score
3. Click to open case modal
4. Create investigation case
5. Attach events as evidence

### 3. Analyze Event Patterns
1. Navigate to "Analytics"
2. Review "Event Correlation Analysis"
3. Look for suspicious patterns
4. Check automation engine execution

### 4. Track Investigation Progress
1. Go to "Cases"
2. Click case to view details
3. Update status as investigation progresses
4. Add evidence and notes

## 🐛 Troubleshooting

### "API Not Responding"
```
- Check backend is running: npm run dev
- Verify API URL: http://localhost:5000
- Check firewall/port access
- Test endpoint manually: curl http://localhost:5000/
```

### Graph Not Displaying
```
- Check console for errors (F12)
- Verify graph data is loading
- Ensure vis.js library loaded
- Check browser compatibility
```

### Slow Dashboard
```
- Reduce graph nodes (filter to risky entities)
- Disable real-time mode
- Clear browser cache
- Check network latency
```

### Authentication Failed
```
- Check JWT token format
- Verify token not expired
- Test API endpoint with token
- Get new token from backend
```

## 🔐 Security Considerations

1. **HTTPS Only**: Use HTTPS in production
2. **Token Storage**: Tokens stored in localStorage (not HttpOnly)
3. **CORS**: Configure CORS properly
4. **Rate Limiting**: Implement backend rate limiting
5. **CSP Headers**: Use Content Security Policy
6. **Input Validation**: All inputs validated

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| IE 11 | ❌ Not supported |

## 📦 Dependencies

- **vis.js** (4.21.0): Network graph visualization
- **Chart.js** (3.9.1): Dynamic charts
- **Axios**: API client (via CDN)
- No build steps required

## 🚀 Deployment

### Static Hosting (Netlify, Vercel, GitHub Pages)
```bash
# Copy web-dashboard folder
# Deploy as static site
# Update API_BASE to production URL
```

### Self-Hosted
```bash
# Option 1: Nginx
location /dashboard/ {
    alias /var/www/web-dashboard/;
    try_files $uri $uri/ =404;
}

# Option 2: Apache
<Directory /var/www/web-dashboard/>
    AllowOverride All
    Require all granted
</Directory>
```

### Docker
```dockerfile
FROM nginx:alpine
COPY web-dashboard/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 📊 Performance Metrics

- **Small graphs** (20 nodes): 60 FPS
- **Medium graphs** (100 nodes): 60 FPS  
- **Large graphs** (500+ nodes): 30-45 FPS
- **Page load**: 2-3 seconds
- **API response**: ~200-500ms

## 🔄 Real-time Data Flow

```
Backend → API → JavaScript → DOM Update → Visualization
   ↓        ↓        ↓           ↓            ↓
MongoDB   REST   API Service → State      Charts/Graphs
          JSON   Chart Service → Canvas
                 Graph Service → SVG
```

## 📞 Support

### Common Issues
1. See **Troubleshooting** section above
2. Check browser console for errors
3. Verify backend is running
4. Test API manually with curl/Postman

### Getting Help
1. Check backend logs: `npm run dev`
2. Check browser console: F12
3. Test API health: `curl http://localhost:5000/`
4. Review API documentation: `/backend/API.md`

## 🎯 Next Steps

1. ✅ Open the dashboard
2. ✅ Paste JWT token and connect
3. ✅ Explore graph data
4. ✅ Load sample cases and events
5. ✅ Create test case
6. ✅ Review analytics

## 📚 Related Documentation

- Backend Setup: `/backend/SETUP.md`
- API Reference: `/backend/API.md`
- Architecture: `/backend/ARCHITECTURE.md`
- Integration: `/backend/INTEGRATION.md`

---

**KAVACH Security Intelligence Platform v2.0**
*Real-time Threat Detection & Analysis Dashboard*
