# Deploy KAVACH Backend to Render.com (Free 24/7 Hosting)

## Quick Deploy Steps:

### 1. Push Backend to GitHub (if not already)

```powershell
cd d:\KAVACH\KAVACH-App\server

# Initialize git if needed
git init
git add .
git commit -m "Backend for deployment"

# Create new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/kavach-backend.git
git push -u origin main
```

### 2. Deploy on Render.com

1. Go to https://render.com and sign up (free)
2. Click **"New +" → "Web Service"**
3. Connect your GitHub account
4. Select the `kavach-backend` repo (or the server folder)
5. Configure:
   - **Name:** kavach-backend
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance Type:** Free

6. **Add Environment Variables** (Click "Advanced" → "Add Environment Variable"):
   ```
   DEEPGRAM_API_KEY = 410293d1f832e9154fbec51c5e2888e90b6b89d0
   GEMINI_API_KEY = AIzaSyC9A5FfHZTqM89gOqWUIpMQjVkYaFLZYPA
   OPENAI_API_KEY = sk-proj-...
   CASHFREE_APP_ID = TEST100367028eb3fcf90d41913a2f7806373001
   CASHFREE_SECRET_KEY = TEST71a62db3c45beadd0e4aa1f30c01b33a21e0e12e
   PORT = 3001
   NODE_ENV = production
   ```

7. Click **"Create Web Service"**

8. Wait 3-5 minutes for deployment

9. Your backend will be live at: `https://kavach-backend.onrender.com`

---

## Alternative: Railway.app (Easier)

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your backend repo
5. Railway auto-detects Node.js
6. Add environment variables from `.env`
7. Deploy!

Live at: `https://kavach-backend.up.railway.app`

---

## Alternative: Fly.io (Fast)

```powershell
# Install Fly CLI
iwr https://fly.io/install.ps1 -useb | iex

# Login
fly auth login

# Deploy
cd d:\KAVACH\KAVACH-App\server
fly launch
fly deploy
```

---

## After Backend is Deployed:

### Update Frontend URLs

Replace in these files:
- `services/assistant.ts`
- `contexts/NexaSafeContext.tsx`

Change:
```javascript
"https://curvy-sides-carry.loca.lt"
```

To:
```javascript
"https://kavach-backend.onrender.com"  // or your Railway/Fly URL
```

### Rebuild and Deploy Frontend

```powershell
cd d:\KAVACH\KAVACH-App
.\build-web.ps1
vercel --prod
```

---

## Benefits of Cloud Deployment:

✅ Runs 24/7 even when laptop is off
✅ Judges can access anytime
✅ No need to keep terminals open
✅ Automatic SSL/HTTPS
✅ Free tier available
✅ Auto-restart if crash

---

## Which to Choose?

- **Render.com** - Most reliable free tier, best for MVP
- **Railway.app** - Easiest setup, $5 free credit
- **Fly.io** - Fastest performance, but more complex

**Recommendation: Start with Render.com**
