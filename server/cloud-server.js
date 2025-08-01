// Cloud Server - Enhanced version for shared Claude Code UI
// Load environment variables from .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = path.join(__dirname, '../.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  console.log('No .env file found or error reading it:', e.message);
}

// Set cloud mode
process.env.CLOUD_MODE = 'true';

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import mime from 'mime-types';

// Cloud database imports
import { 
  initializeCloudDatabase, 
  userDb, 
  projectDb, 
  sessionDb, 
  messageDb, 
  activityDb 
} from './database/cloud-db.js';

// Route imports
import authRoutes from './routes/auth.js';
import sharingRoutes from './routes/sharing.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info) => {
    console.log('WebSocket connection attempt to:', info.req.url);
    
    // For public access (shared sessions), allow without auth
    const url = new URL(info.req.url, 'http://localhost');
    if (url.pathname === '/ws/public') {
      return true;
    }
    
    // Extract token from query parameters or headers
    const token = url.searchParams.get('token') || 
                  info.req.headers.authorization?.split(' ')[1];
    
    // Verify token for authenticated endpoints
    const user = authenticateWebSocket(token);
    if (!user) {
      console.log('❌ WebSocket authentication failed');
      return false;
    }
    
    // Store user info in the request for later use
    info.req.user = user;
    console.log('✅ WebSocket authenticated for user:', user.username);
    return true;
  }
});

app.use(cors());
app.use(express.json());

// Optional API key validation (if configured)
app.use('/api', validateApiKey);

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// Sharing routes (mixed public/authenticated)
app.use('/api/sharing', sharingRoutes);

// Static files served after API routes
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes (protected)
app.get('/api/config', authenticateToken, (req, res) => {
  const host = req.headers.host || `${req.hostname}:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  
  res.json({
    serverPort: PORT,
    wsUrl: `${protocol}://${host}`,
    cloudMode: true,
    features: {
      sharing: true,
      publicSessions: true,
      collaboration: true
    }
  });
});

// Get user's projects (owned + collaborated)
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const projects = projectDb.getUserProjects(userId);
    
    // Get sessions for each project
    const projectsWithSessions = projects.map(project => {
      const sessions = sessionDb.getProjectSessions(project.id, userId, 10, 0);
      return {
        ...project,
        sessions: sessions,
        sessionMeta: {
          total: sessions.length,
          hasMore: sessions.length === 10
        }
      };
    });
    
    res.json(projectsWithSessions);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sessions for a specific project
app.get('/api/projects/:projectId/sessions', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    
    // Check project access
    const project = projectDb.getProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const sessions = sessionDb.getProjectSessions(
      parseInt(projectId), 
      userId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      sessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: sessions.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific session
app.get('/api/projects/:projectId/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check session access
    const session = sessionDb.getSession(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const messages = messageDb.getSessionMessages(sessionId);
    
    // Log access activity
    activityDb.logActivity(
      userId,
      'view_session',
      'session',
      sessionId,
      null,
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ 
      messages,
      session: {
        ...session,
        share_token: undefined // Don't expose share token
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new project
app.post('/api/projects/create', authenticateToken, async (req, res) => {
  try {
    const { name, displayName, description, visibility = 'private' } = req.body;
    const userId = req.user.id;
    
    if (!name || !displayName) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }
    
    const project = projectDb.createProject(name, displayName, userId, description, visibility);
    
    // Log activity
    activityDb.logActivity(
      userId,
      'create_project',
      'project',
      project.id.toString(),
      { name, displayName, visibility },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Project name already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Create a new session (for new conversations)
app.post('/api/projects/:projectId/sessions', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId, title, visibility = 'private' } = req.body;
    const userId = req.user.id;
    
    // Check project access
    const project = projectDb.getProject(parseInt(projectId), userId);
    if (!project || !['owner', 'contributor'].includes(project.user_role)) {
      return res.status(403).json({ error: 'Not authorized to create sessions in this project' });
    }
    
    const session = sessionDb.createSession(
      sessionId, 
      parseInt(projectId), 
      userId, 
      title, 
      visibility
    );
    
    // Log activity
    activityDb.logActivity(
      userId,
      'create_session',
      'session',
      sessionId,
      { projectId, title, visibility },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add message to session
app.post('/api/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role, content, metadata } = req.body;
    const userId = req.user.id;
    
    // Check session access
    const session = sessionDb.getSession(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!['view', 'comment', 'owner'].includes(session.user_permission)) {
      return res.status(403).json({ error: 'Not authorized to add messages' });
    }
    
    const message = messageDb.addMessage(sessionId, role, content, metadata);
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete('/api/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check if user owns the session
    const session = sessionDb.getSession(sessionId, userId);
    if (!session || session.user_permission !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to delete this session' });
    }
    
    // Delete session (messages will be cascade deleted)
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ? AND owner_id = ?');
    const result = stmt.run(sessionId, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Log activity
    activityDb.logActivity(
      userId,
      'delete_session',
      'session',
      sessionId,
      null,
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = userDb.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.username;
    delete updates.password_hash;
    
    userDb.updateProfile(userId, updates);
    
    // Log activity
    activityDb.logActivity(
      userId,
      'update_profile',
      'user',
      userId.toString(),
      updates,
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  const url = request.url;
  console.log('🔗 Client connected to:', url);
  
  // Parse URL to get pathname without query parameters
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  
  if (pathname === '/ws/public') {
    handlePublicConnection(ws);
  } else if (pathname === '/ws/private') {
    handlePrivateConnection(ws, request.user);
  } else {
    console.log('❌ Unknown WebSocket path:', pathname);
    ws.close();
  }
});

// Handle public WebSocket connections (for shared sessions)
function handlePublicConnection(ws) {
  console.log('🌐 Public WebSocket connected');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Limited functionality for public connections
      if (data.type === 'subscribe_shared_session') {
        // Allow subscribing to shared session updates
        ws.sessionId = data.sessionId;
        ws.send(JSON.stringify({
          type: 'subscribed',
          sessionId: data.sessionId
        }));
      }
    } catch (error) {
      console.error('❌ Public WebSocket error:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Public client disconnected');
  });
}

// Handle private WebSocket connections (authenticated users)
function handlePrivateConnection(ws, user) {
  console.log('🔐 Private WebSocket connected for user:', user.username);
  
  ws.userId = user.id;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe_user_updates') {
        // Subscribe to user's project/session updates
        ws.send(JSON.stringify({
          type: 'subscribed',
          userId: user.id
        }));
      }
    } catch (error) {
      console.error('❌ Private WebSocket error:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Private client disconnected:', user.username);
  });
}

// Serve React app for all other routes
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // In development, redirect to Vite dev server
    res.redirect(`http://localhost:${process.env.VITE_PORT || 3001}`);
  }
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startCloudServer() {
  try {
    // Initialize cloud database
    await initializeCloudDatabase();
    console.log('✅ Cloud database initialized');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🌩️  Claude Code UI Cloud Server running on http://0.0.0.0:${PORT}`);
      console.log(`🔗 WebSocket endpoints:`);
      console.log(`   - Private: ws://localhost:${PORT}/ws/private`);
      console.log(`   - Public:  ws://localhost:${PORT}/ws/public`);
      console.log(`🌐 Public session sharing enabled`);
      console.log(`📊 Database: ${path.join(__dirname, 'database', 'cloud.db')}`);
    });
  } catch (error) {
    console.error('❌ Failed to start cloud server:', error);
    process.exit(1);
  }
}

startCloudServer();