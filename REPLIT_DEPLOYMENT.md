# 🚀 Deploying Claude Code UI Cloud on Replit

Replit is an excellent platform for deploying Claude Code UI Cloud with zero infrastructure management. This guide will walk you through setting up a fully functional shared Claude Code UI instance on Replit.

## ✨ Why Replit?

- **🎯 Zero Setup** - No complex configuration needed
- **🌐 Instant Deployment** - Get a public URL immediately  
- **💾 Persistent Storage** - Built-in database persistence
- **🔧 Built-in IDE** - Edit code directly in the browser
- **💰 Free Tier** - Great for testing and small teams
- **🚀 Auto-scaling** - Handles traffic automatically

## 📋 Prerequisites

- A [Replit account](https://replit.com) (free)
- A GitHub account (to store your code)
- Basic familiarity with Git

## 🎯 Quick Deployment (5 minutes)

### Method 1: Fork and Import (Recommended)

1. **Fork the Repository**
   ```bash
   # On GitHub, fork: https://github.com/siteboon/claudecodeui
   # Or clone locally and push to your GitHub
   git clone https://github.com/siteboon/claudecodeui.git
   cd claudecodeui
   # Make any customizations, then push to your GitHub
   ```

2. **Import to Replit**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Enter your repository URL: `https://github.com/yourusername/claudecodeui`
   - Choose "Node.js" as the language
   - Click "Import from GitHub"

3. **Automatic Setup**
   - Replit will detect the `.replit` config and install dependencies
   - The setup script will run automatically
   - Wait for "Setup completed!" message

4. **Start the Server**
   - Click the "Run" button in Replit
   - Your app will be available at: `https://your-repl-name.your-username.repl.co`

### Method 2: Manual Setup

1. **Create New Repl**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl"
   - Select "Node.js"
   - Name your repl (e.g., "claude-code-ui-cloud")

2. **Upload Code**
   - Clone this repository locally
   - Upload all files to your Repl using the file manager
   - Or use Git in the Replit shell:
     ```bash
     git clone https://github.com/siteboon/claudecodeui.git .
     ```

3. **Run Setup**
   ```bash
   chmod +x scripts/replit-setup.sh
   ./scripts/replit-setup.sh
   ```

4. **Start the Application**
   ```bash
   npm run cloud
   ```

## ⚙️ Configuration

### Environment Variables

Replit automatically creates an `.env` file during setup. You can customize it through the "Secrets" tab:

**Required:**
- `JWT_SECRET` - Auto-generated secure key
- `CLOUD_MODE` - Set to `true`
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `3000`

**Optional:**
- `API_KEY` - Additional security layer
- `ENABLE_REGISTRATION` - Allow new user signups
- `ENABLE_PUBLIC_BROWSING` - Public session directory

### Database Configuration

Replit uses SQLite by default with persistent storage:
- Database location: `/home/runner/your-repl-name/data/database/cloud.db`
- Automatic backups via Replit's storage system
- No additional configuration needed

## 🔐 Security Setup

### Default Admin Account

The setup creates a default admin account:
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ IMPORTANT:** Change this password immediately after first login!

### Security Best Practices

1. **Change Admin Password**
   - Login with default credentials
   - Go to Profile Settings
   - Update password to something secure

2. **Configure Environment Variables**
   - Use Replit's "Secrets" tab for sensitive data
   - Never commit secrets to Git

3. **Enable Additional Security**
   ```bash
   # In Replit Shell, generate API key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add this as `API_KEY` in Secrets tab.

## 🌐 Features Available

Your Replit deployment includes all cloud features:

✅ **Multi-user Authentication**  
✅ **Session Sharing** (private, shared, public)  
✅ **Real-time Collaboration**  
✅ **Public Session Browsing**  
✅ **User Management**  
✅ **Activity Logging**  
✅ **Mobile-responsive UI**  

## 📊 Managing Your Deployment

### Accessing Your Application

- **Main URL:** `https://your-repl-name.your-username.repl.co`
- **Admin Panel:** Login with admin credentials
- **API Endpoints:** `https://your-repl-name.your-username.repl.co/api/`

### Viewing Logs

In the Replit console:
```bash
# View application logs
npm run cloud

# Check database status
ls -la data/database/

# View environment
printenv | grep -E "(CLOUD_MODE|JWT_SECRET|NODE_ENV)"
```

### Database Management

```bash
# Access SQLite database
sqlite3 data/database/cloud.db

# Common queries
.tables                          # List tables
SELECT * FROM users;             # List users
SELECT * FROM sessions LIMIT 5;  # List sessions
.quit                           # Exit
```

### Updating Your Deployment

```bash
# Pull latest changes (if using Git)
git pull origin main

# Rebuild application
npm run build

# Restart server (or use Replit's Run button)
npm run cloud
```

## 🚨 Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Database errors**
   ```bash
   # Check database permissions
   ls -la data/database/
   
   # Reinitialize database (WARNING: Deletes data)
   rm data/database/cloud.db
   npm run replit-setup
   ```

3. **Environment issues**
   ```bash
   # Check environment variables
   cat .env
   
   # Regenerate JWT secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Port/URL issues**
   - Replit automatically handles ports and URLs
   - Your app should be accessible via the generated Replit URL
   - If not working, check the "Webview" tab in Replit

### Performance Optimization

For better performance on Replit:

1. **Enable Always On** (Replit Hacker plan)
   - Prevents server from sleeping
   - Ensures 24/7 availability

2. **Boost Resources** (Replit Core/Teams)
   - More CPU and RAM
   - Better for multiple concurrent users

3. **Database Optimization**
   ```bash
   # Vacuum database periodically
   sqlite3 data/database/cloud.db "VACUUM;"
   ```

## 💰 Cost Considerations

### Free Tier
- ✅ Full functionality
- ✅ Public deployment URL
- ⚠️ Server sleeps after inactivity
- ⚠️ Limited resources

### Paid Plans
- **Replit Core ($7/month)**
  - Always-on repls
  - More compute resources
  - Custom domains

- **Replit Teams ($20/month)**
  - Team collaboration
  - Private repls
  - Advanced admin features

## 🔄 Migration from Local Version

If you have existing Claude Code sessions locally:

1. **Before deployment**, run on your local machine:
   ```bash
   # Backup your local sessions
   tar -czf claude-sessions-backup.tar.gz ~/.claude/projects/
   ```

2. **After Replit deployment**, upload the backup:
   - Upload `claude-sessions-backup.tar.gz` to your Repl
   - Extract: `tar -xzf claude-sessions-backup.tar.gz`
   - Run migration: `npm run migrate`

## 🎉 Advanced Configuration

### Custom Domain (Replit Core/Teams)

1. Go to your Repl settings
2. Add custom domain
3. Update DNS settings as instructed
4. Enable HTTPS (automatic)

### Team Collaboration

1. **Share Repl**: Invite team members to edit code
2. **User Management**: Create accounts for team members in the app
3. **Project Sharing**: Use built-in collaboration features

### Monitoring and Analytics

```bash
# View access logs
tail -f logs/access.log

# Monitor user activity
sqlite3 data/database/cloud.db "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10;"

# Check system resources
top
df -h
```

## 🆘 Support

### Getting Help

1. **Replit Community**: [Replit Ask](https://ask.replit.com)
2. **GitHub Issues**: [Project Issues](https://github.com/siteboon/claudecodeui/issues)
3. **Replit Support**: Through Replit dashboard

### Backup and Recovery

```bash
# Create backup
mkdir -p backups
cp -r data/database backups/database-$(date +%Y%m%d)
tar -czf backups/full-backup-$(date +%Y%m%d).tar.gz data/ .env

# Restore from backup (if needed)
tar -xzf backups/full-backup-YYYYMMDD.tar.gz
```

## 🎯 Quick Commands Reference

```bash
# Setup for Replit
./scripts/deploy.sh replit

# Start cloud server
npm run cloud

# Run migration
npm run migrate

# Build application
npm run build

# Access database
sqlite3 data/database/cloud.db

# View logs
tail -f logs/app.log

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🎉 You're All Set!

Your Claude Code UI Cloud instance is now running on Replit! 

**🔗 Access your deployment:** `https://your-repl-name.your-username.repl.co`

**👤 Default login:** `admin` / `admin123` (change immediately!)

**🚀 Next steps:**
1. Change the admin password
2. Create user accounts for your team
3. Start sharing coding sessions!

Enjoy your collaborative Claude Code experience! 🎨✨