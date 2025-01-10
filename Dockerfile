# Install dependencies only when needed
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 py3-pip make g++ && ln -sf python3 /usr/bin/python

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN yarn global add pnpm && pnpm i

# Rebuild the source code only when needed
FROM deps AS builder

# These variables are passed on build time
ARG REDIS_URL

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN SKIN_ENV_VALIDATION=1 pnpm run build

FROM node:20-alpine AS runner

ENV NODE_ENV production

WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./package.json

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

ENV TZ="America/Argentina/Buenos_Aires"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["server.js"]
