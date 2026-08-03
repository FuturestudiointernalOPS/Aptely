# ── Dependencies stage (cached) ──────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Dev stage (used by docker-compose) ───────────────────────────────────────
FROM deps AS dev

WORKDIR /app

COPY tsconfig.json ./
COPY nodemon.json ./
COPY src ./src

EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── Build stage ──────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npx tsc-alias

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/index.js"]
