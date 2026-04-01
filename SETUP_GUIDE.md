# 🚀 KAVACH - Complete Setup & Deployment Guide

This guide will help you set up and deploy the complete KAVACH application with all merged features from NexaVault.

## 📋 Prerequisites

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6.0 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Git** - [Download](https://git-scm.com/)
- **Expo CLI** - Install via npm

### For Mobile Development
- **iOS:** macOS with Xcode (for iOS development)
- **Android:** Android Studio with Android SDK

## 🔧 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Debjyoti-sarkar/KAVACH.git
cd KAVACH
```

### Step 2: Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure `.env` file:**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database
   MONGO_URI=mongodb://localhost:27017/kavach

   # Authentication
   JWT_SECRET=change-this-to-a-secure-random-string-min-32-chars

   # ML Services (Optional - for Hugging Face integration)
   HUGGING_FACE_TOKEN=your_huggingface_api_token_here
   ```

5. **Start MongoDB:**
   
   **Windows:**
   ```bash
   # If MongoDB is installed as a service, it should auto-start
   # Otherwise:
   "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath="C:\data\db"
   ```

   **macOS/Linux:**
   ```bash
   # Using Homebrew (macOS)
   brew services start mongodb-community

   # Or manually
   mongod --dbpath /usr/local/var/mongodb
   ```

6. **Verify MongoDB is running:**
   ```bash
   # Open a new terminal
   mongosh
   # You should see MongoDB shell prompt
   ```

7. **Start the backend server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

8. **Verify backend is running:**
   - Open browser: `http://localhost:5000`
   - You should see the API status page

### Step 3: Frontend Setup

1. **Return to root directory:**
   ```bash
   cd ..  # From backend folder
   ```

2. **Install main dependencies:**
   ```bash
   npm install
   ```

3. **Install Expo CLI globally (if not installed):**
   ```bash
   npm install -g expo-cli
   ```

4. **Configure API endpoint:**
   
   Edit `services/api.ts`:
   ```typescript
   export const API_URL = __DEV__
     ? "http://localhost:5000/api"  // For local development
     : "https://your-production-api.com/api";  // For production
   ```

   **For Android Emulator:**
   Use `http://10.0.2.2:5000/api` instead of `localhost`

   **For iOS Simulator:**
   Use `http://localhost:5000/api`

   **For Physical Device:**
   Use your computer's IP address, e.g., `http://192.168.1.100:5000/api`

5. **Start the Expo development server:**
   ```bash
   npm start
   ```

6. **Run on platform:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## 📱 Platform-Specific Setup

### iOS Setup

1. **Install Xcode** from App Store
2. **Install iOS Simulator:**
   ```bash
   xcode-select --install
   ```
3. **Install CocoaPods:**
   ```bash
   sudo gem install cocoapods
   ```
4. **Run on iOS:**
   ```bash
   npm run ios
   ```

### Android Setup

1. **Install Android Studio**
2. **Set up Android SDK:**
   - Open Android Studio
   - Go to Settings > Appearance & Behavior > System Settings > Android SDK
   - Install Android 13.0 (API 33) or higher

3. **Set environment variables:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc (macOS/Linux)
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

4. **Create virtual device in Android Studio**

5. **Run on Android:**
   ```bash
   npm run android
   ```

## 🌐 Optional Setup

### Hugging Face ML API (for advanced fraud detection)

1. **Create Hugging Face account:** https://huggingface.co/
2. **Get API token:** Settings > Access Tokens
3. **Add to backend `.env`:**
   ```env
   HUGGING_FACE_TOKEN=hf_your_token_here
   ```

### Deployment

#### Backend Deployment (Heroku)

1. **Install Heroku CLI**
2. **Login to Heroku:**
   ```bash
   heroku login
   ```

3. **Create app:**
   ```bash
   cd backend
   heroku create kavach-backend
   ```

4. **Add MongoDB Atlas:**
   - Create free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Get connection string
   - Add to Heroku config:
   ```bash
   heroku config:set MONGO_URI="your_mongodb_atlas_connection_string"
   heroku config:set JWT_SECRET="your_secure_secret_key"
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

#### Frontend Deployment (EAS)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure EAS:**
   ```bash
   eas build:configure
   ```

4. **Build for production:**
   ```bash
   # iOS
   eas build --platform ios

   # Android
   eas build --platform android

   # Both
   eas build --platform all
   ```

5. **Submit to stores:**
   ```bash
   # iOS App Store
   eas submit --platform ios

   # Google Play Store
   eas submit --platform android
   ```

## 🧪 Testing

### Backend Testing

```bash
cd backend
npm test
```

### Database Seeding (Optional)

Create test data:
```bash
cd backend
node scripts/seed.js  # If seed script exists
```

## 🔍 Troubleshooting

### Common Issues

**1. Cannot connect to MongoDB:**
- Ensure MongoDB is running
- Check connection string in `.env`
- For Atlas, whitelist your IP

**2. Expo app won't connect to backend:**
- Use correct IP address (not localhost for physical devices)
- Check firewall settings
- Ensure backend is running

**3. Build errors:**
```bash
# Clear cache
npm start --reset-cache

# Clean install
rm -rf node_modules
npm install
```

**4. iOS Pod installation fails:**
```bash
cd ios
pod install --repo-update
cd ..
```

**5. Android build fails:**
```bash
cd android
./gradlew clean
cd ..
```

## 📊 Monitoring & Logs

### Backend Logs
```bash
cd backend
npm run dev  # Shows live logs
```

### Frontend Logs
```bash
# In Expo terminal, press:
# Shift+M - Toggle menu
# J - Open debugger
```

### Database Monitoring
```bash
mongosh
use kavach
db.stats()  # Show database statistics
```

## 🔐 Security Checklist

Before production deployment:

- [ ] Change JWT_SECRET to secure random string
- [ ] Enable HTTPS for backend
- [ ] Set up CORS properly
- [ ] Use environment variables for all secrets
- [ ] Enable MongoDB authentication
- [ ] Set up rate limiting
- [ ] Enable SSL for MongoDB connections
- [ ] Review and restrict API permissions

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Documentation](https://expressjs.com/)

## 🆘 Support

If you encounter issues:

1. Check [FEATURES_README.md](FEATURES_README.md) for feature documentation
2. Review [MERGE_PLAN.md](MERGE_PLAN.md) for implementation details
3. Check backend logs for API errors
4. Review Expo logs for frontend errors

## ✅ Verification Steps

After setup, verify:

1. ✅ Backend health check: `http://localhost:5000`
2. ✅ MongoDB connection working
3. ✅ Expo app loads on device/emulator
4. ✅ Can register new user
5. ✅ Can login with credentials
6. ✅ API calls working (check Network tab)
7. ✅ All screens accessible

## 🎉 You're Ready!

Your KAVACH app is now fully set up with:
- ✅ Complete backend API
- ✅ ML-powered fraud detection
- ✅ Loan management system
- ✅ QR code payments
- ✅ Biometric authentication
- ✅ Multi-language support
- ✅ Spam detection
- ✅ And much more!

Happy coding! 🚀
