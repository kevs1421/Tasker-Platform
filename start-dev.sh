#!/bin/bash
# Persistent Next.js dev server wrapper
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PATH="/home/z/postgresql/bin:$PATH"
export LD_LIBRARY_PATH="/home/z/postgresql/lib:$LD_LIBRARY_PATH"
cd /home/z/my-project

# Keep trying to restart if it dies
while true; do
  echo "=== Starting Next.js dev server ===" >> /home/z/my-project/dev.log
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "=== Server exited with code $EXIT_CODE, restarting in 3s ===" >> /home/z/my-project/dev.log
  sleep 3
done
