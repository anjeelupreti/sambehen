# ── MULTI-STAGE DOCKER BUILD ──────────────────────────────────────────

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./

# Only install production dependencies
RUN npm ci --only=production

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/tsconfig.json ./
COPY --from=builder /usr/src/app/tsconfig.build.json ./
COPY --from=builder /usr/src/app/drizzle.config.ts ./
COPY --from=builder /usr/src/app/src/database/migrations ./src/database/migrations

# Expose port (must match APP_PORT)
EXPOSE 3000

# Set Node environment to production
ENV NODE_ENV=production

# Run under a non-privileged system user for security hardening
USER node

# Start Command
CMD ["node", "dist/main.js"]
