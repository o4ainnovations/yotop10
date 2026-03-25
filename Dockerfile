FROM node:20-alpine AS base
# Install pnpm and pm2
RUN npm install -g pnpm@9 pm2

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
RUN cd frontend && pnpm install --frozen-lockfile
RUN cd backend && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
# Explicitly verify the file exists before building
RUN ls -la ecosystem.config.js
RUN cd frontend && pnpm build
RUN cd backend && pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pm2

# Copy built artifacts and config
COPY --from=builder /app/frontend/.next/standalone ./frontend
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/ecosystem.config.js /app/ecosystem.config.js

# Start command
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
