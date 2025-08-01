#!/usr/bin/env node

/**
 * Migration script to convert existing JSONL-based sessions to cloud database
 * 
 * This script:
 * 1. Reads existing projects from ~/.claude/projects/
 * 2. Parses JSONL session files
 * 3. Creates projects and sessions in the cloud database
 * 4. Preserves all chat messages and metadata
 * 5. Sets up a default admin user if none exists
 */

import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import cloud database functions
import { 
  initializeCloudDatabase, 
  userDb, 
  projectDb, 
  sessionDb, 
  messageDb, 
  activityDb 
} from './database/cloud-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default admin user credentials
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123', // Should be changed after first login
  email: 'admin@localhost',
  displayName: 'Administrator'
};

// Parse JSONL session file
async function parseSessionFile(filePath) {
  const messages = [];
  
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let messageIndex = 0;
    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          
          // Convert Claude CLI format to our message format
          if (entry.type === 'user' || entry.type === 'assistant') {
            messages.push({
              role: entry.type,
              content: entry.content || entry.text || '',
              metadata: {
                timestamp: entry.timestamp,
                toolCalls: entry.toolCalls,
                usage: entry.usage,
                ...(entry.metadata || {})
              },
              messageIndex: messageIndex++,
              timestamp: entry.timestamp || new Date().toISOString()
            });
          }
        } catch (parseError) {
          console.warn(`Failed to parse line in ${filePath}:`, parseError.message);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading session file ${filePath}:`, error.message);
  }
  
  return messages;
}

// Get project directory from ~/.claude/projects/
async function getClaudeProjects() {
  const claudeProjectsPath = path.join(process.env.HOME, '.claude', 'projects');
  
  try {
    await fs.access(claudeProjectsPath);
  } catch {
    console.log('No Claude projects directory found at:', claudeProjectsPath);
    return [];
  }
  
  const projects = [];
  const projectDirs = await fs.readdir(claudeProjectsPath);
  
  for (const projectDir of projectDirs) {
    const projectPath = path.join(claudeProjectsPath, projectDir);
    const stat = await fs.stat(projectPath);
    
    if (stat.isDirectory()) {
      // Try to find the real project directory
      let realProjectPath = null;
      
      try {
        // Look for .claude_project file
        const claudeProjectFile = path.join(projectPath, '.claude_project');
        try {
          const projectData = await fs.readFile(claudeProjectFile, 'utf8');
          const parsed = JSON.parse(projectData);
          realProjectPath = parsed.root || parsed.path;
        } catch {
          // Fallback: decode project name (replace dashes with slashes)
          realProjectPath = projectDir.replace(/-/g, '/');
        }
        
        // Get display name from package.json if available
        let displayName = projectDir;
        if (realProjectPath) {
          try {
            const packageJsonPath = path.join(realProjectPath, 'package.json');
            const packageData = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageData);
            displayName = packageJson.name || displayName;
          } catch {
            // Use directory name as fallback
            displayName = path.basename(realProjectPath);
          }
        }
        
        // Get sessions from the project directory
        const sessions = [];
        const sessionFiles = await fs.readdir(projectPath);
        
        for (const sessionFile of sessionFiles) {
          if (sessionFile.endsWith('.jsonl') && sessionFile !== '.claude_project') {
            const sessionId = path.basename(sessionFile, '.jsonl');
            const sessionPath = path.join(projectPath, sessionFile);
            const messages = await parseSessionFile(sessionPath);
            
            // Get session metadata from file stats
            const sessionStat = await fs.stat(sessionPath);
            
            sessions.push({
              id: sessionId,
              messages,
              createdAt: sessionStat.birthtime || sessionStat.ctime,
              updatedAt: sessionStat.mtime,
              title: messages.length > 0 ? 
                (messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '')) :
                'Untitled Session'
            });
          }
        }
        
        projects.push({
          name: projectDir,
          displayName,
          realPath: realProjectPath,
          sessions
        });
        
      } catch (error) {
        console.warn(`Error processing project ${projectDir}:`, error.message);
      }
    }
  }
  
  return projects;
}

// Create default admin user if no users exist
async function ensureAdminUser() {
  if (!userDb.hasUsers()) {
    console.log('No users found, creating default admin user...');
    
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    const admin = userDb.createUser(
      DEFAULT_ADMIN.username,
      passwordHash,
      DEFAULT_ADMIN.email,
      DEFAULT_ADMIN.displayName
    );
    
    console.log(`✅ Created admin user: ${admin.username}`);
    console.log(`⚠️  Default password: ${DEFAULT_ADMIN.password}`);
    console.log(`🔒 Please change the password after first login!`);
    
    return admin;
  } else {
    // Return first user as default owner
    const users = userDb.searchUsers('', 1);
    return users[0] || userDb.getUserById(1);
  }
}

// Main migration function
async function migrateToCloud() {
  console.log('🔄 Starting migration to cloud database...\n');
  
  try {
    // Initialize cloud database
    console.log('📦 Initializing cloud database...');
    await initializeCloudDatabase();
    
    // Ensure admin user exists
    const adminUser = await ensureAdminUser();
    console.log(`👤 Using user: ${adminUser.username} (ID: ${adminUser.id})\n`);
    
    // Get existing Claude projects
    console.log('🔍 Scanning for existing Claude projects...');
    const existingProjects = await getClaudeProjects();
    console.log(`📁 Found ${existingProjects.length} projects\n`);
    
    if (existingProjects.length === 0) {
      console.log('No projects found to migrate. Migration complete.');
      return;
    }
    
    let totalSessions = 0;
    let totalMessages = 0;
    
    // Migrate each project
    for (const project of existingProjects) {
      console.log(`📁 Migrating project: ${project.displayName} (${project.sessions.length} sessions)`);
      
      try {
        // Create project in database
        const dbProject = projectDb.createProject(
          project.name,
          project.displayName,
          adminUser.id,
          `Migrated from ${project.realPath}`,
          'private' // Start as private, user can change later
        );
        
        // Migrate sessions
        for (const session of project.sessions) {
          try {
            // Create session in database
            sessionDb.createSession(
              session.id,
              dbProject.id,
              adminUser.id,
              session.title,
              'private'
            );
            
            // Import messages
            if (session.messages.length > 0) {
              messageDb.bulkImportMessages(session.id, session.messages);
              totalMessages += session.messages.length;
            }
            
            totalSessions++;
            console.log(`  ✅ ${session.id} (${session.messages.length} messages)`);
            
          } catch (sessionError) {
            console.error(`  ❌ Failed to migrate session ${session.id}:`, sessionError.message);
          }
        }
        
        // Log migration activity
        activityDb.logActivity(
          adminUser.id,
          'migrate_project',
          'project',
          dbProject.id.toString(),
          {
            originalPath: project.realPath,
            sessionsCount: project.sessions.length,
            migrationTimestamp: new Date().toISOString()
          }
        );
        
      } catch (projectError) {
        console.error(`❌ Failed to migrate project ${project.name}:`, projectError.message);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Projects migrated: ${existingProjects.length}`);
    console.log(`   - Sessions migrated: ${totalSessions}`);
    console.log(`   - Messages migrated: ${totalMessages}`);
    console.log(`   - Database location: ${path.join(__dirname, 'database', 'cloud.db')}`);
    
    if (adminUser.username === DEFAULT_ADMIN.username) {
      console.log(`\n🔐 Security reminder:`);
      console.log(`   - Default admin login: ${DEFAULT_ADMIN.username} / ${DEFAULT_ADMIN.password}`);
      console.log(`   - Please change the password immediately after first login!`);
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToCloud().then(() => {
    console.log('\n✨ Ready to start the cloud version of Claude Code UI!');
    process.exit(0);
  }).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { migrateToCloud };