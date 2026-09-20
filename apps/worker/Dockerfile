FROM docker.io/library/node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev

COPY --chown=node:node packages/contracts ./packages/contracts
COPY --chown=node:node apps/worker ./apps/worker

USER node
CMD ["npm", "run", "start", "--workspace", "@clinicos/worker"]
