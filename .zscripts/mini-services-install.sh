#!/bin/bash

# Configuration
ROOT_DIR="/home/z/my-project/mini-services"

main() {
    echo "🚀 Starting batch dependency installation..."
    
    # Check if ROOT_DIR exists
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  Directory $ROOT_DIR does not exist, skipping installation."
        return
    fi
    
    # Statistics variables
    success_count=0
    fail_count=0
    failed_projects=""
    
    # Iterate through all folders inside the mini-services directory
    for dir in "$ROOT_DIR"/*; do
        # Check if it is a directory and contains a package.json file
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            echo ""
            echo "📦 Installing dependencies for: $project_name..."
            
            # Enter the project directory and run bun install
            if (cd "$dir" && bun install); then
                echo "✅ Successfully installed dependencies for $project_name"
                success_count=$((success_count + 1))
            else
                echo "❌ Failed to install dependencies for $project_name"
                fail_count=$((fail_count + 1))
                if [ -z "$failed_projects" ]; then
                    failed_projects="$project_name"
                else
                    failed_projects="$failed_projects $project_name"
                fi
            fi
        fi
    done
    
    # Summary of results
    echo ""
    echo "=================================================="
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "🎉 Installation completed!"
        echo "✅ Successful: $success_count"
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count"
            echo ""
            echo "Failed projects:"
            for project in $failed_projects; do
                echo "  - $project"
            done
        fi
    else
        echo "ℹ️  No projects containing package.json were found."
    fi
    echo "=================================================="
}

main