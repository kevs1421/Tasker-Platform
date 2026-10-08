#!/bin/bash
echo $$ > /home/z/my-project/server.pid
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
exec node node_modules/.bin/next dev -p 3000
