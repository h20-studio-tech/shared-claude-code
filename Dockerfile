# Multi-stage Docker build for Claude Code UI Cloud
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Create directory for database
RUN mkdir -p /app/server/database && chown -R nextjs:nodejs /app/server/database

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV CLOUD_MODE=true

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/cloud-server.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/config', (res) => { \
    if (res.statusCode === 200 || res.statusCode === 401) process.exit(0); \
    else process.exit(1); \
  }).on('error', () => process.exit(1));"