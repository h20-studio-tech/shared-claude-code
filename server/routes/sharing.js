import express from 'express';
import { sessionDb, projectDb, userDb, messageDb, activityDb } from '../database/cloud-db.js';

const router = express.Router();

// Get public sessions (browse page)
router.get('/public/sessions', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const sessions = sessionDb.getPublicSessions(parseInt(limit), parseInt(offset));
    
    res.json({
      sessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: sessions.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching public sessions:', error);
    res.status(500).json({ error: 'Failed to fetch public sessions' });
  }
});

// Get public projects
router.get('/public/projects', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const projects = projectDb.getPublicProjects(parseInt(limit), parseInt(offset));
    
    res.json({
      projects,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: projects.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching public projects:', error);
    res.status(500).json({ error: 'Failed to fetch public projects' });
  }
});

// Get session by share token (public access)
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const session = sessionDb.getSessionByShareToken(shareToken);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or not shared' });
    }
    
    // Get messages for the session
    const messages = messageDb.getSessionMessages(session.id);
    
    // Log access activity (anonymous)
    activityDb.logActivity(
      null,
      'view_shared_session',
      'session',
      session.id,
      { shareToken, accessType: 'public' },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({
      session: {
        ...session,
        share_token: undefined // Don't expose the token in response
      },
      messages
    });
  } catch (error) {
    console.error('Error fetching shared session:', error);
    res.status(500).json({ error: 'Failed to fetch shared session' });
  }
});

// Update session visibility (authenticated)
router.put('/sessions/:sessionId/visibility', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { visibility } = req.body;
    const userId = req.user.id;
    
    if (!['private', 'public', 'shared'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value' });
    }
    
    // Check if user owns the session
    const session = sessionDb.getSession(sessionId, userId);
    if (!session || session.user_permission !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to modify this session' });
    }
    
    const result = sessionDb.updateSessionVisibility(sessionId, visibility, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Log activity
    activityDb.logActivity(
      userId,
      'update_session_visibility',
      'session',
      sessionId,
      { oldVisibility: session.visibility, newVisibility: visibility },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({
      success: true,
      visibility,
      shareToken: result.shareToken,
      shareUrl: result.shareToken ? `${req.protocol}://${req.get('host')}/shared/${result.shareToken}` : null
    });
  } catch (error) {
    console.error('Error updating session visibility:', error);
    res.status(500).json({ error: 'Failed to update session visibility' });
  }
});

// Share session with specific user (authenticated)
router.post('/sessions/:sessionId/share', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { username, permission = 'view' } = req.body;
    const userId = req.user.id;
    
    if (!['view', 'comment'].includes(permission)) {
      return res.status(400).json({ error: 'Invalid permission value' });
    }
    
    // Check if user owns the session
    const session = sessionDb.getSession(sessionId, userId);
    if (!session || session.user_permission !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to share this session' });
    }
    
    // Find the user to share with
    const targetUser = userDb.getUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }
    
    // Share the session
    sessionDb.shareSession(sessionId, targetUser.id, userId, permission);
    
    // Log activity
    activityDb.logActivity(
      userId,
      'share_session',
      'session',
      sessionId,
      { sharedWith: username, permission },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({
      success: true,
      sharedWith: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.display_name
      },
      permission
    });
  } catch (error) {
    console.error('Error sharing session:', error);
    res.status(500).json({ error: 'Failed to share session' });
  }
});

// Get sessions shared with current user (authenticated)
router.get('/shared-with-me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    // Get sessions shared directly with user
    const sessions = sessionDb.getUserSharedSessions(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      sessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: sessions.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching shared sessions:', error);
    res.status(500).json({ error: 'Failed to fetch shared sessions' });
  }
});

// Search users for sharing (authenticated)
router.get('/users/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    const users = userDb.searchUsers(query, parseInt(limit));
    
    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get session sharing info (authenticated)
router.get('/sessions/:sessionId/sharing', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check if user has access to session
    const session = sessionDb.getSession(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.user_permission !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to view sharing settings' });
    }
    
    // Get list of users session is shared with
    const shares = sessionDb.getSessionShares(sessionId);
    
    res.json({
      visibility: session.visibility,
      shareToken: session.share_token,
      shareUrl: session.share_token ? 
        `${req.protocol}://${req.get('host')}/shared/${session.share_token}` : null,
      sharedWith: shares
    });
  } catch (error) {
    console.error('Error fetching session sharing info:', error);
    res.status(500).json({ error: 'Failed to fetch sharing info' });
  }
});

// Remove user access to session (authenticated)
router.delete('/sessions/:sessionId/share/:userId', async (req, res) => {
  try {
    const { sessionId, userId: targetUserId } = req.params;
    const userId = req.user.id;
    
    // Check if user owns the session
    const session = sessionDb.getSession(sessionId, userId);
    if (!session || session.user_permission !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to modify sharing' });
    }
    
    // Remove share
    const result = sessionDb.removeSessionShare(sessionId, parseInt(targetUserId));
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }
    
    // Log activity
    activityDb.logActivity(
      userId,
      'remove_session_share',
      'session',
      sessionId,
      { removedUserId: targetUserId },
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing session share:', error);
    res.status(500).json({ error: 'Failed to remove share' });
  }
});

// Add missing method to sessionDb
if (!sessionDb.getUserSharedSessions) {
  sessionDb.getUserSharedSessions = (userId, limit = 50, offset = 0) => {
    try {
      const stmt = sessionDb.db?.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               p.name as project_name, p.display_name as project_display_name,
               ss.permission as user_permission
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        JOIN projects p ON s.project_id = p.id
        JOIN session_shares ss ON s.id = ss.session_id
        WHERE ss.shared_with_user_id = ?
        ORDER BY ss.created_at DESC
        LIMIT ? OFFSET ?
      `) || db.prepare(`
        SELECT s.*, u.username as owner_username, u.display_name as owner_display_name,
               p.name as project_name, p.display_name as project_display_name,
               ss.permission as user_permission
        FROM sessions s
        JOIN users u ON s.owner_id = u.id
        JOIN projects p ON s.project_id = p.id
        JOIN session_shares ss ON s.id = ss.session_id
        WHERE ss.shared_with_user_id = ?
        ORDER BY ss.created_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(userId, limit, offset);
    } catch (err) {
      throw err;
    }
  };
}

if (!sessionDb.getSessionShares) {
  sessionDb.getSessionShares = (sessionId) => {
    try {
      const stmt = db.prepare(`
        SELECT ss.*, u.username, u.display_name, u.avatar_url
        FROM session_shares ss
        JOIN users u ON ss.shared_with_user_id = u.id
        WHERE ss.session_id = ?
        ORDER BY ss.created_at DESC
      `);
      return stmt.all(sessionId);
    } catch (err) {
      throw err;
    }
  };
}

if (!sessionDb.removeSessionShare) {
  sessionDb.removeSessionShare = (sessionId, userId) => {
    try {
      const stmt = db.prepare(`
        DELETE FROM session_shares 
        WHERE session_id = ? AND shared_with_user_id = ?
      `);
      return stmt.run(sessionId, userId);
    } catch (err) {
      throw err;
    }
  };
}

export default router;