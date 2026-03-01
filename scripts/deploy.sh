#!/bin/bash
set -euo pipefail

REMOTE="rp.local"
REMOTE_DIR="~/gba-web"

echo "Syncing to $REMOTE..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude saves \
  --exclude dist \
  ./ "$REMOTE:$REMOTE_DIR/"

echo "Building and starting on $REMOTE..."
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose up -d --build"

echo "Done! https://gba.mini-mil.com"
