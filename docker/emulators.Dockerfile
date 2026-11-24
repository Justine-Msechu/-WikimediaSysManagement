# Firebase Local Emulator Suite (Auth + Firestore + Emulator UI).
# firebase-tools needs Java 21 and Node; both are inside this image, so nothing
# extra is needed on your computer.
FROM node:20-bookworm-slim AS node

FROM eclipse-temurin:21-jre
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && npm install -g firebase-tools@15.37.0 --no-audit --no-fund \
 && firebase setup:emulators:firestore \
 && firebase setup:emulators:ui

WORKDIR /workspace
# Config and rules are copied in (and synced by `docker compose up --watch`).
COPY firebase.json firestore.rules firestore.indexes.json ./
COPY docker/emulators-start.sh ./docker/emulators-start.sh
EXPOSE 4000 4400 4500 8080 9099 9150
CMD ["sh", "/workspace/docker/emulators-start.sh"]
