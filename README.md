# Frontend ↔ Backend Validation Project

A minimal full-stack web application to validate frontend-backend connectivity, CORS configuration, and deployment workflows.

## 🎯 Project Purpose

This project validates:
- ✅ Frontend ↔ Backend connectivity
- ✅ CORS configuration
- ✅ Deployment to GitHub Pages (frontend)
- ✅ Deployment to Render (backend)

## 🏗️ Architecture

**Frontend**:
- Single `index.html` file (Vanilla HTML, CSS, JavaScript)
- Deployed to **GitHub Pages**
- Fetches backend `/api/status` endpoint
- Displays server health with visual indicator

**Backend**:
- Node.js with Express
- Located in `/backend` directory
- Exposes `GET /api/status` endpoint
- Uses explicit CORS whitelisting
- Deployed to **Render**

## 📁 Project Structure

```
project-root/
├── index.html              # Frontend (GitHub Pages)
├── README.md               # This file
├── .gitignore              # Git ignore rules
└── backend/
    ├── package.json        # Node.js dependencies
    ├── server.js           # Express server
    └── .gitignore          # Backend-specific ignores
```

## 🚀 Local Development

### Prerequisites

- Node.js 18+ installed
- Git installed

### Backend Setup

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3000`

### Frontend Setup

Open `index.html` in browser:
- Double-click file, OR
- Use Live Server (VS Code extension)

## 🌐 Deployment

### 1. Deploy Backend to Render

1. Push code to GitHub
2. Create new Web Service on [Render](https://render.com)
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Copy assigned URL: `https://your-app-name.onrender.com`

### 2. Update Frontend Configuration

Edit `index.html` (line ~200):

```javascript
const BACKEND_URL = 'https://your-app-name.onrender.com';
```

### 3. Update Backend CORS

Edit `backend/server.js` (line ~30):

```javascript
const allowedOrigins = [
  'https://YOUR-USERNAME.github.io',  // Update with your GitHub Pages URL
  'http://localhost:5500',
];
```

Commit and push changes.

### 4. Deploy Frontend to GitHub Pages

1. Go to repository Settings → Pages
2. Source: `main` branch, `/ (root)` folder
3. Save and wait 1-2 minutes
4. Access: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## ✅ Verification

**Expected Result**:
- Frontend shows green indicator (✓)
- Status text: "Server Online"
- Details panel displays backend URL and timestamp

**If Offline**:
- Check browser console for errors
- Verify backend URL in `index.html`
- Verify CORS origins in `backend/server.js`
- Check Render logs for backend errors

## 🐛 Common Issues

### CORS Error
**Symptom**: "blocked by CORS policy"  
**Fix**: Add GitHub Pages URL to `allowedOrigins` in `backend/server.js`

### Mixed Content Error
**Symptom**: "Mixed Content" warning  
**Fix**: Ensure `BACKEND_URL` uses `https://` (not `http://`)

### 404 Not Found
**Symptom**: Backend returns 404  
**Fix**: Verify Render "Root Directory" is set to `backend`

### Server Offline
**Symptom**: Red indicator despite backend running  
**Fix**: Verify `BACKEND_URL` matches Render URL exactly

## 📚 Documentation

Detailed documentation available in `.gemini/antigravity/brain/` directory:
- `phase1_architecture.md` - Architecture overview
- `phase2_backend.md` - Backend implementation details
- `phase3_frontend.md` - Frontend implementation details
- `phase4_deployment.md` - Comprehensive deployment guide

## 🔧 Technology Stack

**Frontend**:
- HTML5
- CSS3 (Vanilla)
- JavaScript (ES6+)

**Backend**:
- Node.js 18+
- Express 4.18+
- CORS 2.8+

## 📝 License

MIT

## 🤝 Contributing

This is a validation project. Feel free to fork and modify for your own learning purposes.

---

**Built with clarity and correctness in mind.**
