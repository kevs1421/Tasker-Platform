#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS='--dns-result-order=ipv4first'
exec npx next dev -p 3000 2>&1 | tee dev.log