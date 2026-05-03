FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ARG SERVICE
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY services/${SERVICE}/package.json services/${SERVICE}/

# Install
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY packages/shared/ packages/shared/
COPY services/${SERVICE}/ services/${SERVICE}/

WORKDIR /app/services/${SERVICE}
CMD ["node", "--import", "tsx", "src/index.ts"]
