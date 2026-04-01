# KAVACH MVP Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Deploy Backend (Choose ONE option)

#### Option A: localtunnel (Easiest - No signup)
```powershell
# Terminal 1 - Start Backend
cd d:\KAVACH\KAVACH-App\server
node index.js

# Terminal 2 - Expose Backend
npx localtunnel --port 3001 --subdomain kavach-backend
```
You'll get: `https://kavach-backend.loca.lt`

#### Option B: ngrok (More reliable)
1. Download: https://ngrok.com/download
2. Extract and run:
```powershell
ngrok http 3001
```
You'll get: `https://abc123.ngrok.io`

---

### Step 2: Update Frontend API URLs

**Find and Replace in these files:**
- `services/paymentGateway.ts`
- `services/behaviorAnalysis.ts`  
- `components/VoiceRecorder.tsx`
- Any file with `http://172.16.20.46:3001`

**Replace with your backend URL:**
```
http://172.16.20.46:3001  →  https://your-backend-url.com
```

---

### Step 3: Deploy Frontend to Vercel

#### 3a. Build Web Version
```powershell
cd d:\KAVACH\KAVACH-App
npx expo export:web
```
This creates: `web-build/` folder

#### 3b. Deploy to Vercel
```powershell
# Install Vercel CLI
npm install -g vercel

# Deploy
cd d:\KAVACH\KAVACH-App
vercel --prod
```

**OR use Vercel Website:**
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Import your repo OR drag `web-build` folder
5. Click "Deploy"

You'll get: `https://kavach.vercel.app`

---

## Alternative: Netlify Deploy

```powershell
# Build
npx expo export:web

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=web-build
```

---

## Testing Your MVP

1. **Backend Health Check:**
   - Visit: `https://your-backend-url/health`
   - Should return: `{"status": "healthy"}`

2. **Frontend Test:**
   - Visit: `https://your-frontend-url.vercel.app`
   - Complete registration flow
   - Test voice assistant: "send 500 to rahul"
   - Test payment processing

---

## Keep Backend Running

### Option 1: Your Local PC (Development)
- Keep backend terminal open
- Keep ngrok/localtunnel running
- PC must stay on with internet

### Option 2: Free Cloud Deploy (Production)
- **Render.com** (Free tier): https://render.com
- **Railway.app** (Free $5 credit): https://railway.app
- **Fly.io** (Free tier): https://fly.io

---

## Quick Deploy to Render (Backend)

1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect GitHub repo OR:
   ```powershell
   # Push server folder to GitHub
   cd d:\KAVACH\KAVACH-App\server
   git init
   git add .
   git commit -m "Backend"
   ```
4. Select Node environment
5. Build Command: `npm install`
6. Start Command: `node index.js`
7. Add Environment Variables from `.env`
8. Click "Create Web Service"

You'll get: `https://kavach-backend.onrender.com`

---

## MVP Submission Checklist

- [ ] Backend is publicly accessible (test /health endpoint)
- [ ] Frontend deployed to Vercel/Netlify
- [ ] All API URLs updated to public backend URL
- [ ] Test complete flow: Registration → Payment → Voice Assistant
- [ ] Share link: `https://your-app.vercel.app`

---

## Troubleshooting

**CORS errors on web?**
- Backend already has CORS enabled
- Check browser console for actual error

**Can't access backend URL?**
- Make sure backend is running: `node index.js`
- Make sure tunnel is running: `npx localtunnel --port 3001`
- Check firewall settings

**Vercel build fails?**
- Use pre-built `web-build` folder
- Don't try to build from source on Vercel

---

## Current Setup
- Backend: `http://172.16.20.46:3001` (local)
- Frontend: `http://localhost:8081` (local)
- Need to replace these with public URLs
