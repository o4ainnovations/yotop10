FROM node:20-alpine AS base

# Install pnpm and pm2
RUN npm install -g pnpm@9 pm2

# Install dependencies for both
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
RUN cd frontend && pnpm install --frozen-lockfile
RUN cd backend && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend and backend
RUN cd frontend && pnpm build
RUN cd backend && pnpm build

# Final production image
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pm2

# Copy built artifacts
COPY --from=base /app/frontend/.next/standalone ./frontend
COPY --from=base /app/frontend/public ./frontend/public
COPY --from=base /app/backend/dist ./backend/dist
COPY --from=base /app/backend/node_modules ./backend/node_modules
COPY --from=base /app/backend/package.json ./backend/

# Start command
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
