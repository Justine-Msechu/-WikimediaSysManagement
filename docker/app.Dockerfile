# Local development image for the React app (Create React App dev server).
# The source is copied in and kept up to date by `docker compose up --watch`
# (not a bind mount — Docker can't reliably read files in an iCloud-synced folder).
FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

ENV HOST=0.0.0.0 \
    PORT=3000 \
    BROWSER=none \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true \
    WDS_SOCKET_PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
