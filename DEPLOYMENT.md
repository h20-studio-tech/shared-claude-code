# Claude Code UI Cloud - Deployment Guide

This guide covers deploying the cloud version of Claude Code UI that supports session sharing and collaboration.

## 🏗️ Architecture Overview

The cloud version includes:
- **Multi-user authentication** with JWT
- **Session sharing** (private, shared via link, public)
- **Cloud database** (SQLite or PostgreSQL)
- **Real-time updates** via WebSocket
- **Public session browsing**
- **User collaboration features**

## 🚀 Quick Start

1. **Clone and prepare:**
   ```bash
   git clone https://github.com/siteboon/claudecodeui.git
   cd claudecodeui
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.cloud .env
   # Edit .env with your settings (especially JWT_SECRET)
   ```

3. **Migrate existing data (optional):**
   ```bash
   ./scripts/deploy.sh migrate
   ```

4. **Deploy:**
   ```bash
   # Local development
   ./scripts/deploy.sh local
   
   # Docker
   ./scripts/deploy.sh docker
   
   # Cloud platforms
   ./scripts/deploy.sh fly      # Fly.io
   ./scripts/deploy.sh railway  # Railway
   ./scripts/deploy.sh vercel   # Vercel
   ./scripts/deploy.sh replit   # Replit
   ```

## ⚙️ Configuration

### Environment Variables

Copy `.env.cloud` to `.env` and configure:

```bash
# REQUIRED: Generate a secure JWT secret
JWT_SECRET="your-super-secret-jwt-key-64-chars-minimum"

# Optional: API key for additional security
API_KEY="optional-api-key"

# Database (SQLite by default)
CLOUD_MODE=true
DATABASE_PATH=./server/database/cloud.db

# Features
ENABLE_PUBLIC_BROWSING=true
ENABLE_SESSION_SHARING=true
ENABLE_REGISTRATION=true
```

**⚠️ Security Note:** Always use a strong, unique JWT_SECRET in production. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🐳 Docker Deployment

### Quick Start with Docker Compose

```bash
# Basic deployment
docker-compose up -d

# With PostgreSQL
docker-compose --profile postgres up -d

# Full production setup with Nginx
docker-compose --profile postgres --profile nginx up -d
```

### Manual Docker Build

```bash
# Build image
docker build -t claude-code-ui-cloud .

# Run container
docker run -d \
  --name claude-code-ui \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e JWT_SECRET="your-jwt-secret" \
  claude-code-ui-cloud
```

## ☁️ Cloud Platform Deployments

### Replit (Easiest - 5 minutes)

```bash
# Setup for Replit (run locally first)
./scripts/deploy.sh replit

# Then import to Replit from GitHub
# See REPLIT_DEPLOYMENT.md for detailed guide
```

**Features:**
- ✅ Zero infrastructure management
- ✅ Built-in IDE and collaboration
- ✅ Instant public URL
- ✅ Free tier available
- ✅ Persistent storage
- ✅ Auto-deployment from Git

### Fly.io (Best for Production)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
./scripts/deploy.sh fly --prod
```

**Features:**
- ✅ WebSocket support
- ✅ Persistent volumes
- ✅ Global edge locations
- ✅ Automatic SSL

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
./scripts/deploy.sh railway
```

**Features:**
- ✅ PostgreSQL addon available
- ✅ Redis addon available
- ✅ Automatic deployments from Git

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
./scripts/deploy.sh vercel --prod
```

**Features:**
- ✅ Global CDN
- ✅ Serverless functions
- ⚠️ Limited WebSocket support
- ⚠️ SQLite limitations in serverless

### AWS Elastic Beanstalk

1. **Prepare deployment package:**
   ```bash
   npm run build
   zip -r claude-code-ui.zip . -x "node_modules/*" ".git/*"
   ```

2. **Create Elastic Beanstalk application:**
   - Platform: Node.js
   - Upload `claude-code-ui.zip`
   - Configure environment variables in EB console

3. **Configure load balancer for WebSocket:**
   - Enable sticky sessions
   - Set health check path to `/api/config`

## 🗄️ Database Options

### SQLite (Default)
- Perfect for small to medium deployments
- No additional setup required
- File-based storage

### PostgreSQL (Production)
```bash
# With Docker Compose
docker-compose --profile postgres up -d

# Manual setup
createdb claude_code_ui
psql claude_code_ui < server/database/postgres-init.sql
```

Update `.env`:
```bash
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/claude_code_ui
```

## 🔧 Migration from Local Version

The migration script converts existing JSONL sessions to the cloud database:

```bash
./scripts/deploy.sh migrate
```

**What it does:**
- Scans `~/.claude/projects/` for existing sessions
- Creates a default admin user
- Converts JSONL messages to database records
- Preserves all chat history and metadata

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`
- **⚠️ Change immediately after first login!**

## 🌐 Features Overview

### Session Sharing
- **Private:** Only owner can access
- **Shared:** Accessible via secure link
- **Public:** Listed in public directory

### User Management
- JWT-based authentication
- User profiles and avatars
- Search and invite system

### Collaboration
- Project sharing with role-based access
- Session permissions (view, comment)
- Activity logging

### Public Directory
- Browse public sessions and projects
- Filter and search functionality
- Community sharing

## 🔒 Security Best Practices

1. **Environment Security:**
   ```bash
   # Use strong JWT secret (64+ characters)
   JWT_SECRET="$(openssl rand -hex 64)"
   
   # Optional API key for additional protection
   API_KEY="$(openssl rand -hex 32)"
   ```

2. **Database Security:**
   - Use PostgreSQL in production
   - Enable SSL connections
   - Regular backups

3. **Network Security:**
   - Use HTTPS in production
   - Configure CORS properly
   - Implement rate limiting

4. **Access Control:**
   - Review user permissions regularly
   - Monitor activity logs
   - Implement proper session timeouts

## 📊 Monitoring and Maintenance

### Health Checks
- Endpoint: `/api/config`
- WebSocket: `/ws/private`
- Database connectivity check

### Logging
```bash
# View logs (Docker)
docker logs claude-code-ui -f

# View logs (Cloud platforms)
flyctl logs        # Fly.io
railway logs       # Railway
vercel logs        # Vercel
```

### Backups
```bash
# SQLite backup
cp ./data/cloud.db ./backups/cloud-$(date +%Y%m%d).db

# PostgreSQL backup
pg_dump claude_code_ui > backup-$(date +%Y%m%d).sql
```

## 🚨 Troubleshooting

### Common Issues

1. **WebSocket connection fails:**
   - Check CORS settings
   - Verify JWT token
   - Ensure proxy supports WebSocket upgrades

2. **Database errors:**
   - Check file permissions (SQLite)
   - Verify connection string (PostgreSQL)
   - Ensure database exists

3. **Authentication issues:**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Review user permissions

### Debug Mode
```bash
DEBUG=true node server/cloud-server.js
```

### Reset Admin Password
```bash
# Connect to database and update
sqlite3 ./server/database/cloud.db
UPDATE users SET password_hash = '$2b$10$...' WHERE username = 'admin';
```

## 📈 Scaling Considerations

### Performance Optimization
- Use Redis for session storage
- Implement database connection pooling
- Enable response compression
- Use CDN for static assets

### High Availability
- Multi-region deployment
- Database replication
- Load balancer configuration
- Health check monitoring

## 🤝 Support

For deployment issues:
1. Check the [troubleshooting section](#-troubleshooting)
2. Review platform-specific documentation
3. Open an issue on GitHub with deployment logs

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] JWT_SECRET generated and set
- [ ] Database initialized
- [ ] Migration completed (if applicable)
- [ ] SSL/HTTPS configured
- [ ] Health checks passing
- [ ] Admin password changed
- [ ] Backups scheduled
- [ ] Monitoring configured

---

**🎉 Congratulations!** Your Claude Code UI Cloud instance is ready for shared coding sessions!

Access your deployment and create your first shared session to start collaborating with your team.