# ==============================================================================
# LOGIN 2026 NETHUNT - PRODUCTION DOCKERFILE
# PSG College of Technology - MCA Alumni Cryptic Hunt Platform
# Node.js 22 Alpine (Native node:sqlite support & minimal image footprint)
# ==============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package descriptors
COPY package.json pnpm-lock.yaml* ./

# Install dependencies (including devDependencies needed for Vite build)
RUN pnpm install

# Copy application source code
COPY . .

# Build the production React frontend bundle into /app/dist
RUN pnpm run build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package descriptors and install production-only dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code and public assets
COPY server ./server
COPY public ./public

# Create data directory for SQLite database persistence
RUN mkdir -p /app/server/data

# Persistent storage volume for SQLite database (nethunt.db)
VOLUME ["/app/server/data"]

# Expose backend & frontend unified port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Start the unified backend server
CMD ["node", "server/index.js"]
