# ──────────────────────────────────────────────────────────
# bychat CLI — Docker image
#
# Build:
#   docker build -t bychat .
#
# Run (mount your workspace as /workspace):
#   docker run --rm -it \
#     -e OPENAI_API_KEY="sk-..." \
#     -e OPENAI_BASE_URL="https://api.openai.com/v1" \
#     -v $(pwd):/workspace \
#     bychat agent -w /workspace "your prompt here"
#
# Run with embedded workspace (copy files into the image):
#   docker build -t bychat-project --build-arg EMBED_WORKSPACE=./my-project .
#   docker run --rm -it \
#     -e OPENAI_API_KEY="sk-..." \
#     bychat-project agent -w /workspace "add tests"
#
# Examples:
#   docker run --rm -it -v $(pwd):/workspace bychat ask -w /workspace "explain the auth flow"
#   docker run --rm -it -v $(pwd):/workspace bychat agent -w /workspace "add input validation"
#   docker run --rm -it bychat chat "what is the difference between REST and GraphQL"
# ──────────────────────────────────────────────────────────

FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY core/ ./core/
COPY main/ ./main/
COPY cli/ ./cli/
COPY connectors/ ./connectors/
COPY server/ ./server/

# Build CLI (compiles TypeScript → dist-cli/)
RUN npx tsc --project cli/tsconfig.json
# Build main (needed for shared modules in dist-main/)
RUN npx tsc

# ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy package manifests and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist-cli/ ./dist-cli/
COPY --from=builder /app/dist-main/ ./dist-main/

# Create default data dir and workspace mount point
RUN mkdir -p /data /workspace
ENV BYCHAT_DATA_DIR=/data

# Optionally embed a workspace at build time
ARG EMBED_WORKSPACE=""
COPY ${EMBED_WORKSPACE:-.dockerignore} /workspace/

ENTRYPOINT ["node", "/app/dist-cli/cli/index.js"]
CMD ["--help"]
