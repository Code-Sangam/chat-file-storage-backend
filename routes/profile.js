const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const db = require('../database-simple');

// No image processing - store files as-is for maximum compatibility
console.log('Image processing disabled for maximum compatibility on all platforms');

const router = express.Router();

// Multer configuration for profile pictures
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'), false);
    }
  }
});

// Upload profile picture
router.post('/upload-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    const fileName = `profile_${userId}_${fileId}${fileExtension}`;
    const filePath = path.join(__dirname, '../uploads/profiles', fileName);
    
    // Save original file (no processing for maximum compatibility)
    await fs.writeFile(filePath, req.file.buffer);

    // Get file stats
    const stats = await fs.stat(filePath);
    const fileUrl = `/uploads/profiles/${fileName}`;

    // Delete old profile picture if exists
    try {
      const existingUser = await db.getUser(userId);
      if (existingUser && existingUser.profile_picture_path) {
        const oldPath = path.join(__dirname, '..', existingUser.profile_picture_path);
        if (await fs.pathExists(oldPath)) {
          await fs.remove(oldPath);
        }
      }
    } catch (error) {
      console.warn('Failed to delete old profile picture:', error);
    }

    // Save to database
    await db.upsertUser({
      userId,
      username: req.body.username || null,
      email: req.body.email || null,
      profilePicturePath: `uploads/profiles/${fileName}`,
      profilePictureUrl: fileUrl
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePictureUrl: fileUrl,
      fileSize: stats.size
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    
    if (error.message.includes('Only image files')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload profile picture',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get profile picture
router.get('/picture/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await db.getUser(userId);
    if (!user || !user.profile_picture_path) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }

    const filePath = path.join(__dirname, '..', user.profile_picture_path);
    
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'Profile picture file not found' });
    }

    // Send file
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get profile picture URL
router.get('/picture-url/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await db.getUser(userId);
    if (!user || !user.profile_picture_url) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }

    res.json({
      profilePictureUrl: user.profile_picture_url,
      userId: user.user_id
    });

  } catch (error) {
    console.error('Error fetching profile picture URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete profile picture
router.delete('/picture/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await db.getUser(userId);
    if (!user || !user.profile_picture_path) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }

    // Delete file
    const filePath = path.join(__dirname, '..', user.profile_picture_path);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }

    // Update database
    await db.upsertUser({
      userId,
      username: user.username,
      email: user.email,
      profilePicturePath: null,
      profilePictureUrl: null
    });

    res.json({ 
      success: true,
      message: 'Profile picture deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync user profile data
router.post('/sync', async (req, res) => {
  try {
    const { userId, profileData } = req.body;
    
    if (!userId || !profileData) {
      return res.status(400).json({ error: 'User ID and profile data are required' });
    }

    // Get existing user data to preserve profile picture
    const existingUser = await db.getUser(userId);
    
    await db.upsertUser({
      userId,
      username: profileData.username,
      email: profileData.email,
      profilePicturePath: existingUser?.profile_picture_path || null,
      profilePictureUrl: existingUser?.profile_picture_url || null
    });

    res.json({
      success: true,
      message: 'Profile synced successfully'
    });

  } catch (error) {
    console.error('Profile sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;