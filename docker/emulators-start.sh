#!/bin/sh
# Starts the emulators with the project's real firestore.rules. Data is kept in
# .emulator-data/ between runs (exported when the container stops).
set -e
cd /workspace
mkdir -p .emulator-data
IMPORT=""
if [ -f .emulator-data/firebase-export-metadata.json ]; then
  IMPORT="--import=.emulator-data"
fi
exec firebase emulators:start --only auth,firestore \
  --project demo-wikikilimanjaro $IMPORT --export-on-exit=.emulator-data
