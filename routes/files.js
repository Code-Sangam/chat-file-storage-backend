const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const db = require('../database-simple');

const router = express.Router();

// Multer configuration for shared files
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedTypes = [
      'image/', 'video/', 'audio/', 'application/pdf',
      'text/', 'application/msword', 'application/vnd.openxmlformats',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Helper function to get file category
function getFileCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('zip')) return 'archive';
  return 'other';
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload shared file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { userId, description } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique file ID and name
    const fileId = uuidv4();
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(__dirname, '../uploads/shared', fileName);
    
    // Save file to disk
    await fs.writeFile(filePath, req.file.buffer);
    
    const fileUrl = `/uploads/shared/${fileName}`;
    const category = getFileCategory(req.file.mimetype);

    // Save to database
    await db.createSharedFile({
      fileId,
      userId,
      originalName: req.file.originalname,
      fileName,
      filePath: `uploads/shared/${fileName}`,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      description: description || '',
      category
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        fileId,
        originalName: req.file.originalname,
        fileName,
        fileUrl,
        fileSize: req.file.size,
        formattedSize: formatFileSize(req.file.size),
        mimeType: req.file.mimetype,
        category,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload file',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Download/view shared file
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await db.getSharedFile(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, '..', file.file_path);
    
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Increment download count
    await db.incrementDownloadCount(fileId);

    // Set appropriate headers
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    
    // Send file
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get file info
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await db.getSharedFile(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      fileId: file.file_id,
      originalName: file.original_name,
      fileSize: file.file_size,
      formattedSize: formatFileSize(file.file_size),
      mimeType: file.mime_type,
      category: file.category,
      description: file.description,
      downloadCount: file.download_count,
      uploadedAt: file.created_at,
      lastAccessed: file.last_accessed
    });

  } catch (error) {
    console.error('Error fetching file info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's files
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const files = await db.getUserSharedFiles(userId, parseInt(limit), offset);

    // Format files for response
    const formattedFiles = files.map(file => ({
      fileId: file.file_id,
      originalName: file.original_name,
      fileSize: file.file_size,
      formattedSize: formatFileSize(file.file_size),
      mimeType: file.mime_type,
      category: file.category,
      description: file.description,
      downloadCount: file.download_count,
      fileUrl: file.file_url,
      uploadedAt: file.created_at,
      lastAccessed: file.last_accessed
    }));

    res.json({
      success: true,
      files: formattedFiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: formattedFiles.length
      }
    });

  } catch (error) {
    console.error('Error fetching user files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete file
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const file = await db.getSharedFile(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check ownership
    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized - you can only delete your own files' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', file.file_path);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }

    // Delete from database
    await db.deleteSharedFile(fileId, userId);

    res.json({ 
      success: true,
      message: 'File deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get file statistics for user
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const stats = await db.getUserFileStats(userId);
    const recentFiles = await db.getUserSharedFiles(userId, 5, 0);

    res.json({
      success: true,
      stats: {
        totalFiles: stats.total_files || 0,
        totalSize: stats.total_size || 0,
        formattedTotalSize: formatFileSize(stats.total_size || 0),
        totalDownloads: stats.total_downloads || 0,
        recentFiles: recentFiles.map(file => ({
          fileId: file.file_id,
          originalName: file.original_name,
          fileSize: file.file_size,
          formattedSize: formatFileSize(file.file_size),
          category: file.category,
          uploadedAt: file.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching file stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search files
router.get('/search/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { q: searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const files = await db.searchFiles(userId, searchTerm);

    const formattedFiles = files.map(file => ({
      fileId: file.file_id,
      originalName: file.original_name,
      fileSize: file.file_size,
      formattedSize: formatFileSize(file.file_size),
      mimeType: file.mime_type,
      category: file.category,
      description: file.description,
      downloadCount: file.download_count,
      fileUrl: file.file_url,
      uploadedAt: file.created_at
    }));

    res.json({
      success: true,
      searchTerm,
      results: formattedFiles,
      count: formattedFiles.length
    });

  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;