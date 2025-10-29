# 🚀 Chat File Storage Backend

A free, self-hosted file storage backend for profile pictures and file sharing. Eliminates Firebase Storage costs completely!

## ✨ Features

- 📸 **Profile Pictures** - Optimized image uploads with Sharp
- 📁 **File Sharing** - Upload, download, delete files up to 50MB
- 📊 **Statistics** - Real-time usage tracking
- 🔍 **Search** - Full-text search through files
- 🔒 **Security** - Rate limiting, CORS, file validation
- 💾 **SQLite Database** - Lightweight, serverless database
- 🆓 **100% Free** - No cloud storage costs!

## 🎯 Purpose

This backend replaces Firebase Storage for:
- Profile picture uploads (saves $0.026/GB + download costs)
- File sharing and management
- Complete file operations (CRUD)

## 🚀 Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deployment:

1. **Fork/Clone this repository**
2. **Go to [Render.com](https://render.com)**
3. **Create New Web Service**
4. **Connect this repository**
5. **Configuration:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node.js
6. **Environment Variables:**
   ```
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```
7. **Deploy!**

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3001
```

## 📋 API Endpoints

### Health Check
- `GET /health` - Server health status

### Profile Pictures
- `POST /api/profile/upload-picture` - Upload profile picture
- `GET /api/profile/picture-url/:userId` - Get profile picture URL
- `DELETE /api/profile/picture/:userId` - Delete profile picture

### File Management
- `POST /api/files/upload` - Upload file
- `GET /api/files/download/:fileId` - Download file
- `GET /api/files/user/:userId` - List user files
- `GET /api/files/stats/:userId` - Get file statistics
- `GET /api/files/search/:userId?q=term` - Search files
- `DELETE /api/files/:fileId` - Delete file

## 🔒 Security Features

- **Rate Limiting:** 100 requests per 15 minutes
- **File Validation:** Type and size checking
- **CORS Protection:** Configurable allowed origins
- **Input Sanitization:** XSS protection
- **User Isolation:** Files separated by user ID

## 💾 Database

Uses SQLite for:
- User profile data
- File metadata and statistics
- Automatic table creation
- Indexed queries for performance

## 📁 File Storage

- **Profile Pictures:** `uploads/profiles/` (optimized with Sharp)
- **Shared Files:** `uploads/shared/` (up to 50MB)
- **Automatic Cleanup:** On file deletion
- **Directory Structure:** Auto-created on startup

## 🌐 Environment Variables

```bash
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://your-domain.com,https://another-domain.com
```

## 💰 Cost Savings

### Before (Firebase Storage):
- Storage: $0.026/GB/month
- Downloads: $0.12/GB
- Example: $1.20/month for moderate usage

### After (This Backend):
- Storage: $0/month (self-hosted)
- Downloads: $0/month (self-hosted)
- Hosting: $0/month (Render free tier)
- **Total: $0/month!** 🎉

## 🧪 Testing

Visit `/health` endpoint after deployment to verify:
```json
{
  "status": "OK",
  "timestamp": "2025-10-28T...",
  "uptime": 123.45,
  "storage": {"profiles": 0, "shared": 0}
}
```

## 🔗 Integration

This backend integrates with any frontend that needs file storage:
- React/Vue/Angular apps
- Mobile applications
- Static sites
- Any HTTP client

Perfect for replacing expensive cloud storage solutions!

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Eliminate your file storage costs today!** 🚀💰