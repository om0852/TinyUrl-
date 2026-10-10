# Multi-stage Dockerfile for Next.js URL Shortener Platform

# ------------------------------------------
# Stage 1: Base Dependencies
# ------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-libc6-compat

# ------------------------------------------
# Stage 2: Install Dependencies
# ------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------
# Stage 3: Build Application
# ------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

RUN npm run build

# ------------------------------------------
# Stage 4: Production Runner
# ------------------------------------------
FROM base AS runner
ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
