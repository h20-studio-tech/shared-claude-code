import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'cloud.db');
const INIT_SQL_PATH = path.join(__dirname, 'cloud-init.sql');

// Create database connection
const db = new Database(DB_PATH);
console.log('Connected to Cloud SQLite database');

// Initialize database with schema
const initializeCloudDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Cloud database initialized successfully');
  } catch (error) {
    console.error('Error initializing cloud database:', error.message);
    throw error;
  }
};

// Generate secure share token
const generateShareToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash, email = null, displayName = null) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, email, display_name) 
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(username, passwordHash, email, displayName || username);
      return { id: result.lastInsertRowid, username, email, displayName };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare(`
        SELECT id, username, email, display_name, avatar_url, profile_public, bio,
               created_at, last_login 
        FROM users 
        WHERE username = ? AND is_active = 1
      `).get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare(`
        SELECT id, username, email, display_name, avatar_url, profile_public, bio,
               created_at, last_login 
        FROM users 
        WHERE id = ? AND is_active = 1
      `).get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Update user profile
  updateProfile: (userId, updates) => {
    try {
      const allowedFields = ['display_name', 'email', 'avatar_url', 'profile_public', 'bio'];
      const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
      
      if (fields.length === 0) return;
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => updates[field]);
      values.push(userId);
      
      const stmt = db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`);
      stmt.run(...values);
    } catch (err) {
      throw err;
    }
  },

  // Search users (for sharing)
  searchUsers: (query, limit = 10) => {
    try {
      const stmt = db.prepare(`
        SELECT id, username, display_name, avatar_url
        FROM users 
        WHERE is_active = 1 
          AND (username LIKE ? OR display_name LIKE ?)
          AND profile_public = 1
        LIMIT ?
      `);
      return stmt.all(`%${query}%`, `%${query}%`, limit);
    } catch (err) {
      throw err;
    }
  }
};

// Project database operations
const projectDb = {
  // Create a new project
  createProject: (name, displayName, ownerId, description = null, visibility = 'private') => {
    try {
      const stmt = db.prepare(`
        INSERT INTO projects (name, display_name, owner_id, description, visibility)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(name, displayName, ownerId, description, visibility);
      return { id: result.lastInsertRowid, name, displayName, ownerId, description, visibility };
    } catch (err) {
      throw err;
    }
  },

  // Get projects for user (owned + shared)
  getUserProjects: (userId) => {
    try {
      const stmt = db.prepare(`
        SELECT DISTINCT p.*, u.username as owner_username, u.display_name as owner_display_name,
               CASE WHEN p.owner_id = ? THEN 'owner' ELSE pc.role END as user_role
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = ?
        WHERE p.owner_id = ? OR pc.user_id = ?
        ORDER BY p.updated_at DESC
      `);
      return stmt.all(userId, userId, userId, userId);
    } catch (err) {
      throw err;
    }
  },

  // Get public projects
  getPublicProjects: (limit = 50, offset = 0) => {
    try {
      const stmt = db.prepare(`
        SELECT p.*, u.username as owner_username, u.display_name as owner_display_name,
               COUNT(s.id) as session_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN sessions s ON p.id = s.project_id AND s.visibility = 'public'
        WHERE p.visibility = 'public'
        GROUP BY p.id
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(limit, offset);
    } catch (err) {
      throw err;
    }
  },

  // Get project by ID with permission check
  getProject: (projectId, userId = null) => {
    try {
      const stmt = db.prepare(`
        SELECT p.*, u.username as owner_username, u.display_name as owner_display_name,
               CASE 
                 WHEN p.owner_id = ? THEN 'owner'
                 WHEN pc.role IS NOT NULL THEN pc.role
                 WHEN p.visibility = 'public' THEN 'viewer'
                 ELSE NULL
               END as user_role
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = ?
        WHERE p.id = ?
      `);
      return stmt.get(userId, userId, projectId);
    } catch (err) {
      throw err;
    }
  }
};

// Session database operations
const sessionDb = {
  // Create a new session
  createSession: (sessionId, projectId, ownerId, title = null, visibility = 'private') => {
    try {
      const shareToken = visibility !== 'private' ? generateShareToken() : null;
      const stmt = db.prepare(`
        INSERT INTO sessions (id, project_id, owner_id, title, visibility, share_token)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(sessionId, projectId, ownerId, title, visibility, shareToken);
      return { id: sessionId, projectId, ownerId, title, visibility, shareToken };
    } catch (err) {
      throw err;
    }
  },

  // Get sessions for a project
  getProjectSessions: (projectId, userId = null, limit = 50, offset = 0) => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               CASE 
                 WHEN s.owner_id = ? THEN 'owner'
                 WHEN ss.permission IS NOT NULL THEN ss.permission
                 WHEN s.visibility = 'public' THEN 'view'
                 ELSE NULL
               END as user_permission
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        LEFT JOIN session_shares ss ON s.id = ss.session_id AND ss.shared_with_user_id = ?
        WHERE s.project_id = ? 
          AND (s.owner_id = ? OR s.visibility = 'public' OR ss.shared_with_user_id = ?)
        ORDER BY s.updated_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(userId, userId, projectId, userId, userId, limit, offset);
    } catch (err) {
      throw err;
    }
  },

  // Get session by ID with permission check
  getSession: (sessionId, userId = null) => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               p.name as project_name, p.display_name as project_display_name,
               CASE 
                 WHEN s.owner_id = ? THEN 'owner'
                 WHEN ss.permission IS NOT NULL THEN ss.permission
                 WHEN s.visibility = 'public' THEN 'view'
                 ELSE NULL
               END as user_permission
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        JOIN projects p ON s.project_id = p.id
        LEFT JOIN session_shares ss ON s.id = ss.session_id AND ss.shared_with_user_id = ?
        WHERE s.id = ?
      `);
      return stmt.get(userId, userId, sessionId);
    } catch (err) {
      throw err;
    }
  },

  // Get session by share token
  getSessionByShareToken: (shareToken) => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               p.name as project_name, p.display_name as project_display_name
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        JOIN projects p ON s.project_id = p.id
        WHERE s.share_token = ? AND s.visibility != 'private'
      `);
      return stmt.get(shareToken);
    } catch (err) {
      throw err;
    }
  },

  // Update session visibility
  updateSessionVisibility: (sessionId, visibility, ownerId) => {
    try {
      const shareToken = visibility !== 'private' ? generateShareToken() : null;
      const stmt = db.prepare(`
        UPDATE sessions 
        SET visibility = ?, share_token = ? 
        WHERE id = ? AND owner_id = ?
      `);
      const result = stmt.run(visibility, shareToken, sessionId, ownerId);
      return { changes: result.changes, shareToken };
    } catch (err) {
      throw err;
    }
  },

  // Share session with specific user
  shareSession: (sessionId, sharedWithUserId, sharedByUserId, permission = 'view') => {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO session_shares 
        (session_id, shared_with_user_id, shared_by_user_id, permission)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(sessionId, sharedWithUserId, sharedByUserId, permission);
    } catch (err) {
      throw err;
    }
  },

  // Get public sessions
  getPublicSessions: (limit = 50, offset = 0) => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               p.name as project_name, p.display_name as project_display_name
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        JOIN projects p ON s.project_id = p.id
        WHERE s.visibility = 'public'
        ORDER BY s.updated_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(limit, offset);
    } catch (err) {
      throw err;
    }
  }
};

// Message database operations
const messageDb = {
  // Add message to session
  addMessage: (sessionId, role, content, metadata = null) => {
    try {
      // Get next message index
      const indexRow = db.prepare(`
        SELECT COALESCE(MAX(message_index), -1) + 1 as next_index 
        FROM messages 
        WHERE session_id = ?
      `).get(sessionId);
      
      const stmt = db.prepare(`
        INSERT INTO messages (session_id, role, content, metadata, message_index)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(sessionId, role, content, JSON.stringify(metadata), indexRow.next_index);
      return { id: result.lastInsertRowid, messageIndex: indexRow.next_index };
    } catch (err) {
      throw err;
    }
  },

  // Get messages for session
  getSessionMessages: (sessionId, limit = 1000, offset = 0) => {
    try {
      const stmt = db.prepare(`
        SELECT id, role, content, metadata, timestamp, message_index
        FROM messages 
        WHERE session_id = ?
        ORDER BY message_index ASC
        LIMIT ? OFFSET ?
      `);
      const messages = stmt.all(sessionId, limit, offset);
      
      // Parse metadata JSON
      return messages.map(msg => ({
        ...msg,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null
      }));
    } catch (err) {
      throw err;
    }
  },

  // Bulk import messages (for migration)
  bulkImportMessages: (sessionId, messages) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO messages (session_id, role, content, metadata, message_index, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const insertMany = db.transaction((messages) => {
        for (const msg of messages) {
          stmt.run(
            sessionId, 
            msg.role, 
            msg.content, 
            JSON.stringify(msg.metadata || {}),
            msg.messageIndex,
            msg.timestamp
          );
        }
      });
      
      insertMany(messages);
    } catch (err) {
      throw err;
    }
  }
};

// Activity logging
const activityDb = {
  logActivity: (userId, action, resourceType, resourceId, metadata = null, ipAddress = null, userAgent = null) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO activity_log (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(userId, action, resourceType, resourceId, JSON.stringify(metadata), ipAddress, userAgent);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }
};

export {
  db,
  initializeCloudDatabase,
  userDb,
  projectDb,
  sessionDb,
  messageDb,
  activityDb,
  generateShareToken
};