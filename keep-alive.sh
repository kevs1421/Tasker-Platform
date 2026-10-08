#!/bin/bash
# Persistent wrapper that keeps the dev server alive
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PATH="/home/z/postgresql/bin:$PATH"
export LD_LIBRARY_PATH="/home/z/postgresql/lib:$LD_LIBRARY_PATH"

# Infinite loop to restart if crashes
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> /home/z/my-project/dev.log
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
