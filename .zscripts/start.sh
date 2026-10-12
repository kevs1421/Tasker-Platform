#!/bin/sh

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

# Store PIDs of all child processes
pids=""

# Cleanup function: Gracefully shutdown all services
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    
    # Send SIGTERM signal to all child processes
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   Closing process $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done
    
    # Wait for all processes to exit (wait up to 5 seconds total)
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # If still running, wait up to 4 more seconds
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # If still running, force kill
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force killing process $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done
    
    echo "✅ All services have been shut down"
    exit 0
}

echo "🚀 Starting all services..."
echo ""

# Switch to the build directory
cd "$BUILD_DIR" || exit 1

ls -lah

DEFAULT_PACKAGED_DB_PATH="/app/db/custom.db"
DEFAULT_PACKAGED_DATABASE_URL="file:$DEFAULT_PACKAGED_DB_PATH"

# Start Next.js server
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 Starting Next.js server..."
    cd next-service-dist/ || exit 1
    
    # Set environment variables
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    export DATABASE_URL="${DATABASE_URL:-$DEFAULT_PACKAGED_DATABASE_URL}"

    if [ "$DATABASE_URL" = "$DEFAULT_PACKAGED_DATABASE_URL" ]; then
        if [ ! -f "$DEFAULT_PACKAGED_DB_PATH" ]; then
            echo "❌ Packaged database file not found: $DEFAULT_PACKAGED_DB_PATH"
            echo "   To avoid starting production with an empty database, startup has been aborted"
            exit 1
        fi

        echo "🗄️  Currently using packaged database: $DEFAULT_PACKAGED_DB_PATH"
    else
        echo "🗄️  Currently using externally specified database: $DATABASE_URL"
    fi
    
    # Start Next.js in the background
    bun server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"
    
    # Wait briefly to check if the process started successfully
    sleep 1
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "❌ Next.js server failed to start"
        exit 1
    else
        echo "✅ Next.js server started (PID: $NEXT_PID, Port: $PORT)"
    fi
    
    cd ../
else
    echo "⚠️  Next.js server file not found: ./next-service-dist/server.js"
fi

# Start mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 Starting mini-services..."
    
    # Run the startup script (run from the root directory; the script handles the mini-services-dist directory internally)
    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"
    
    # Wait briefly to check if the process started successfully
    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "⚠️  mini-services may have failed to start, but continuing execution..."
    else
        echo "✅ mini-services started (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  mini-services startup script not found, but directory exists"
else
    echo "ℹ️  mini-services directory does not exist, skipping"
fi

# Start Caddy (if Caddyfile exists)
echo "🚀 Starting Caddy..."

# Caddy runs as a foreground process (main process)
echo "✅ Caddy started (running in foreground)"
echo ""
echo "🎉 All services have started!"
echo ""
echo "💡 Press Ctrl+C to stop all services"
echo ""

# Run Caddy as the main process
exec caddy run --config Caddyfile --adapter caddyfile