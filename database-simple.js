const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'data');
fs.ensureDirSync(dbDir);

const dbPath = path.join(dbDir, 'filestore.db');

// Create database connection
let db;
try {
  db = new Database(dbPath);
  console.log('Connected to SQLite database');
  initializeTables();
} catch (error) {
  console.error('Error opening database:', error);
  process.exit(1);
}

// Initialize database tables
function initializeTables() {
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        username TEXT,
        email TEXT,
        profile_picture_path TEXT,
        profile_picture_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Shared files table
    db.exec(`
      CREATE TABLE IF NOT EXISTS shared_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        description TEXT,
        category TEXT,
        download_count INTEGER DEFAULT 0,
        is_public BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON shared_files(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_files_file_id ON shared_files(file_id)`);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
}

// Database helper functions
const dbHelpers = {
  // Get user
  getUser: (userId) => {
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
      return stmt.get(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  // Create or update user
  upsertUser: (userData) => {
    try {
      const { userId, username, email, profilePicturePath, profilePictureUrl } = userData;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO users 
        (user_id, username, email, profile_picture_path, profile_picture_url, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const result = stmt.run(userId, username, email, profilePicturePath, profilePictureUrl);
      return { id: result.lastInsertRowid, userId };
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  },

  // Create shared file
  createSharedFile: (fileData) => {
    try {
      const { fileId, userId, originalName, fileName, filePath, fileUrl, fileSize, mimeType, description, category } = fileData;
      const stmt = db.prepare(`
        INSERT INTO shared_files 
        (file_id, user_id, original_name, file_name, file_path, file_url, file_size, mime_type, description, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(fileId, userId, originalName, fileName, filePath, fileUrl, fileSize, mimeType, description, category);
      return { id: result.lastInsertRowid, fileId };
    } catch (error) {
      console.error('Error creating shared file:', error);
      throw error;
    }
  },

  // Get shared file
  getSharedFile: (fileId) => {
    try {
      const stmt = db.prepare('SELECT * FROM shared_files WHERE file_id = ?');
      return stmt.get(fileId);
    } catch (error) {
      console.error('Error getting shared file:', error);
      return null;
    }
  },

  // Get user's shared files
  getUserSharedFiles: (userId, limit = 50, offset = 0) => {
    try {
      const stmt = db.prepare(`
        SELECT * FROM shared_files 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      return stmt.all(userId, limit, offset);
    } catch (error) {
      console.error('Error getting user shared files:', error);
      return [];
    }
  },

  // Delete shared file
  deleteSharedFile: (fileId, userId) => {
    try {
      const stmt = db.prepare('DELETE FROM shared_files WHERE file_id = ? AND user_id = ?');
      const result = stmt.run(fileId, userId);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error deleting shared file:', error);
      throw error;
    }
  },

  // Update download count
  incrementDownloadCount: (fileId) => {
    try {
      const stmt = db.prepare(`
        UPDATE shared_files 
        SET download_count = download_count + 1, last_accessed = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `);
      const result = stmt.run(fileId);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error incrementing download count:', error);
      throw error;
    }
  },

  // Get file statistics
  getUserFileStats: (userId) => {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          SUM(download_count) as total_downloads
        FROM shared_files 
        WHERE user_id = ?
      `);
      return stmt.get(userId);
    } catch (error) {
      console.error('Error getting file stats:', error);
      return { total_files: 0, total_size: 0, total_downloads: 0 };
    }
  },

  // Search files
  searchFiles: (userId, searchTerm) => {
    try {
      const stmt = db.prepare(`
        SELECT * FROM shared_files 
        WHERE user_id = ? AND (
          original_name LIKE ? OR 
          description LIKE ? OR 
          category LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT 20
      `);
      const term = `%${searchTerm}%`;
      return stmt.all(userId, term, term, term);
    } catch (error) {
      console.error('Error searching files:', error);
      return [];
    }
  }
};

// Attach helpers to db object
Object.assign(db, dbHelpers);

module.exports = db;