# 🌩️ Claude Code UI Cloud - Replit Edition

Welcome to the **easiest way** to deploy Claude Code UI with session sharing! This Replit-optimized version gets you up and running in under 5 minutes.

## 🚀 One-Click Deploy

[![Run on Repl.it](https://replit.com/badge/github/siteboon/claudecodeui)](https://replit.com/new/github/siteboon/claudecodeui)

## ✨ What You Get

- 🔐 **Multi-user authentication**
- 🔗 **Session sharing** (private, shared links, public)
- 👥 **Real-time collaboration**
- 🌐 **Instant public URL**
- 📱 **Mobile-responsive design**
- 💾 **Persistent database**
- 🆓 **Free hosting on Replit**

## 🎯 Quick Start

### Option 1: Direct Import (Fastest)
1. Click the "Run on Repl.it" badge above
2. Wait for automatic setup (2-3 minutes)
3. Click "Run" when setup completes
4. Access your app at the generated URL

### Option 2: Fork & Deploy
1. Fork this repository on GitHub
2. Create new Repl on Replit
3. Import from your GitHub fork
4. Replit handles the rest automatically!

## 🔐 Default Access

After deployment, login with:
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ Change this password immediately for security!**

## 🌟 Features Demo

Your Replit instance includes:

### Session Sharing
- **Private**: Only you can see
- **Shared**: Anyone with link can view
- **Public**: Listed in community directory

### Collaboration Tools
- User invitations and permissions
- Project-based organization
- Activity tracking and history

### Mobile Experience
- Responsive design for phones/tablets
- Touch-friendly interface
- Works offline (with caching)

## ⚙️ Customization

### Environment Variables
Access via Replit's "Secrets" tab:

```bash
JWT_SECRET=auto-generated-secure-key
CLOUD_MODE=true
NODE_ENV=production
ENABLE_REGISTRATION=true
ENABLE_PUBLIC_BROWSING=true
```

### Branding
Edit these files to customize:
- `public/manifest.json` - App name and icons
- `src/components/ClaudeLogo.jsx` - Logo component
- `public/logo.svg` - Main logo file

### Features
Toggle features in `.env`:
```bash
ENABLE_REGISTRATION=false      # Disable new signups
ENABLE_PUBLIC_BROWSING=false   # Hide public directory
API_KEY=your-secret-key        # Add API protection
```

## 📊 Usage Analytics

View your deployment stats:
```bash
# In Replit Shell
sqlite3 data/database/cloud.db

# Check user count
SELECT COUNT(*) FROM users;

# View recent sessions
SELECT title, created_at FROM sessions ORDER BY created_at DESC LIMIT 10;

# Activity summary
SELECT action, COUNT(*) FROM activity_log GROUP BY action;
```

## 🔧 Maintenance

### Database Backup
```bash
# Create backup
cp data/database/cloud.db backups/cloud-$(date +%Y%m%d).db

# View database size
du -h data/database/cloud.db
```

### Updates
```bash
# Pull latest changes (if using Git)
git pull origin main

# Rebuild
npm run build

# Clear cache and restart
rm -rf node_modules/.cache
npm run cloud
```

### Troubleshooting
```bash
# Check logs
tail -f ~/.local/share/pnpm/global/5/.pnpm-logs/*

# Reset database (WARNING: Deletes all data)
rm data/database/cloud.db
npm run replit-setup

# Regenerate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 💰 Replit Plans

### Free Tier
- ✅ Full functionality
- ✅ Public deployment
- ⚠️ Sleeps after 1 hour of inactivity
- ⚠️ Limited concurrent users (~5-10)

### Replit Core ($7/month)
- ✅ Always-on hosting
- ✅ Better performance
- ✅ Custom domains
- ✅ More concurrent users (~50-100)

### Replit Teams ($20/month)
- ✅ Team collaboration on code
- ✅ Private repositories
- ✅ Advanced admin features
- ✅ High performance (~200+ users)

## 🌐 Going Production

For production use, consider:

1. **Upgrade to Replit Core/Teams**
2. **Add custom domain**
3. **Set up monitoring**
4. **Configure backups**
5. **Review security settings**

### Custom Domain Setup
1. Upgrade to Replit Core/Teams
2. Add domain in Repl settings
3. Update DNS records as instructed
4. Enable HTTPS (automatic)

## 🤝 Community

- **Replit Community**: [ask.replit.com](https://ask.replit.com)
- **GitHub Issues**: [Report bugs](https://github.com/siteboon/claudecodeui/issues)
- **Discord**: [Join discussion](https://discord.gg/replit)

## 📚 Learn More

- 📖 [Full Deployment Guide](DEPLOYMENT.md)
- 🔧 [Replit-specific Guide](REPLIT_DEPLOYMENT.md)
- 🏗️ [Development Setup](README.md)
- 🚀 [Feature Documentation](docs/)

## 🎉 Success!

Your Claude Code UI Cloud is now running on Replit! 

🔗 **Your URL**: `https://your-repl-name.your-username.repl.co`

Start sharing your coding sessions with the world! 🌟

---

<div align="center">
  <p>Made with ❤️ for the Claude Code community</p>
  <p>
    <a href="https://replit.com/@siteboon/claude-code-ui-cloud">View Example</a> •
    <a href="REPLIT_DEPLOYMENT.md">Full Guide</a> •
    <a href="https://github.com/siteboon/claudecodeui/issues">Support</a>
  </p>
</div>