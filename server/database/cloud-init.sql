-- Cloud Database Schema for Shared Claude Code UI
-- Supports multi-user session sharing and collaboration

PRAGMA foreign_keys = ON;

-- Users table (enhanced for multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1,
    profile_public BOOLEAN DEFAULT 0,
    bio TEXT
);

-- Projects table (replaces file-based project discovery)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    visibility TEXT CHECK(visibility IN ('private', 'public', 'shared')) DEFAULT 'private',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table (replaces JSONL file storage)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, -- Claude session ID
    project_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    title TEXT,
    visibility TEXT CHECK(visibility IN ('private', 'public', 'shared')) DEFAULT 'private',
    share_token TEXT UNIQUE, -- For sharing via link
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    last_message_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages table (stores individual chat messages)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON metadata (tool calls, etc.)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_index INTEGER NOT NULL, -- Order within session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Session shares table (explicit sharing permissions)
CREATE TABLE IF NOT EXISTS session_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    shared_with_user_id INTEGER,
    shared_by_user_id INTEGER NOT NULL,
    permission TEXT CHECK(permission IN ('view', 'comment')) DEFAULT 'view',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(session_id, shared_with_user_id)
);

-- Project collaborators table
CREATE TABLE IF NOT EXISTS project_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT CHECK(role IN ('viewer', 'contributor', 'admin')) DEFAULT 'viewer',
    invited_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- Session favorites table (users can bookmark sessions)
CREATE TABLE IF NOT EXISTS session_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE(user_id, session_id)
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'session', 'project', 'user'
    resource_id TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_visibility ON sessions(visibility);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_session_index ON messages(session_id, message_index);

CREATE INDEX IF NOT EXISTS idx_session_shares_session ON session_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_session_shares_user ON session_shares(shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user ON project_collaborators(user_id);

CREATE INDEX IF NOT EXISTS idx_session_favorites_user ON session_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_session_favorites_session ON session_favorites(session_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON activity_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

-- Create triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users 
    BEGIN 
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects 
    BEGIN 
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions 
    BEGIN 
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger to update session message count and last message time
CREATE TRIGGER IF NOT EXISTS update_session_stats_on_message_insert
    AFTER INSERT ON messages
    BEGIN
        UPDATE sessions 
        SET message_count = message_count + 1,
            last_message_at = NEW.timestamp,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.session_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_session_stats_on_message_delete
    AFTER DELETE ON messages
    BEGIN
        UPDATE sessions 
        SET message_count = message_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.session_id;
    END;