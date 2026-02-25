#!/bin/bash

APP_NAME="Jenkins UI.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$SCRIPT_DIR/$APP_NAME"

if [ ! -d "$APP_PATH" ]; then
  echo "Errore: $APP_NAME non trovata in $SCRIPT_DIR"
  exit 1
fi

xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null
chmod +x "$APP_PATH/Contents/MacOS/"*

echo "Fatto! Puoi aprire $APP_NAME normalmente."