FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --no-frozen-lockfile

# Rebuild the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

USER nodejs

EXPOSE 8000

ENV PORT=8000

CMD ["node", "dist/server.js"]
