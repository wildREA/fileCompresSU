#!/bin/bash

# This script verifies that all necessary files have been copied to the dist directory

echo "Verifying dist directory structure..."

# Check if dist directory exists
if [ ! -d "../dist" ]; then
    echo "ERROR: ../dist directory does not exist!"
    exit 1
fi

# Check for important files
REQUIRED_FILES=(
    "../dist/index.html"
    "../dist/main.js"
    "../dist/package.json"
    "../dist/src/styles.css"
    "../dist/src/images/appIcon.png"
    "../dist/src/images/fileCompressor.png"
    "../dist/src/logic/preload.js"
    "../dist/src/logic/renderer.js"
    "../dist/src/logic/utils/compression.js"
    "../dist/build/icon.png"
    "../dist/build/icon.ico"
)

MISSING_FILES=0

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "MISSING: $file"
        MISSING_FILES=$((MISSING_FILES+1))
    fi
done

# Check for required directories
REQUIRED_DIRS=(
    "../dist/src/logic"
    "../dist/src/logic/utils"
    "../dist/src/images"
    "../dist/build"
    "../dist/node_modules"
)

MISSING_DIRS=0

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "MISSING: $dir"
        MISSING_DIRS=$((MISSING_DIRS+1))
    fi
done

# Check TypeScript compilation
if [ ! -f "../dist/src/logic/renderer.js" ] || [ ! -f "../dist/src/logic/preload.js" ] || [ ! -f "../dist/src/logic/utils/compression.js" ]; then
    echo "ERROR: TypeScript files did not compile correctly!"
fi

# Summary
if [ $MISSING_FILES -eq 0 ] && [ $MISSING_DIRS -eq 0 ]; then
    echo "✅ Build verification passed! All required files and directories are present."
else
    echo "❌ Build verification failed! Missing $MISSING_FILES files and $MISSING_DIRS directories."
    exit 1
fi

echo "Build structure appears correct."
