const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'data');
fs.ensureDirSync(dbDir);

const dbPath = path.join(dbDir, 'filestore.db');

// Create database connection
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    try {
      await initializeTables();
    } catch (error) {
      console.error('Error initializing tables:', error);
    }
  }
});

// Initialize database tables
function initializeTables() {
  return new Promise((resolve, reject) => {
    // Users table for profile pictures
    db.run(`
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
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        return reject(err);
      }

      // Shared files table
      db.run(`
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
      `, (err) => {
        if (err) {
          console.error('Error creating shared_files table:', err);
          return reject(err);
        }

        // Create indexes for better performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`, (err) => {
          if (err) console.error('Error creating users index:', err);
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON shared_files(user_id)`, (err) => {
          if (err) console.error('Error creating files user_id index:', err);
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_files_file_id ON shared_files(file_id)`, (err) => {
          if (err) console.error('Error creating files file_id index:', err);
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_files_created_at ON shared_files(created_at DESC)`, (err) => {
          if (err) console.error('Error creating files created_at index:', err);
        });

        console.log('Database tables initialized successfully');
        resolve();
      });
    });
  });
}

// Helper functions
const dbHelpers = {
  // Get user by Firebase user ID
  getUser: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Create or update user
  upsertUser: (userData) => {
    return new Promise((resolve, reject) => {
      const { userId, username, email, profilePicturePath, profilePictureUrl } = userData;
      
      db.run(`
        INSERT OR REPLACE INTO users 
        (user_id, username, email, profile_picture_path, profile_picture_url, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [userId, username, email, profilePicturePath, profilePictureUrl], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, userId });
      });
    });
  },

  // Create shared file record
  createSharedFile: (fileData) => {
    return new Promise((resolve, reject) => {
      const {
        fileId, userId, originalName, fileName, filePath, fileUrl,
        fileSize, mimeType, description, category
      } = fileData;

      db.run(`
        INSERT INTO shared_files 
        (file_id, user_id, original_name, file_name, file_path, file_url, 
         file_size, mime_type, description, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [fileId, userId, originalName, fileName, filePath, fileUrl, 
          fileSize, mimeType, description, category], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, fileId });
      });
    });
  },

  // Get shared file by ID
  getSharedFile: (fileId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM shared_files WHERE file_id = ?', [fileId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Get user's shared files
  getUserSharedFiles: (userId, limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM shared_files 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [userId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Delete shared file
  deleteSharedFile: (fileId, userId) => {
    return new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM shared_files 
        WHERE file_id = ? AND user_id = ?
      `, [fileId, userId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // Update download count
  incrementDownloadCount: (fileId) => {
    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE shared_files 
        SET download_count = download_count + 1, last_accessed = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `, [fileId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // Get file statistics for user
  getUserFileStats: (userId) => {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          SUM(download_count) as total_downloads
        FROM shared_files 
        WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Search files
  searchFiles: (userId, searchTerm) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM shared_files 
        WHERE user_id = ? AND (
          original_name LIKE ? OR 
          description LIKE ? OR 
          category LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT 20
      `, [userId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Attach helpers to db object
Object.assign(db, dbHelpers);

module.exports = db;