#!/usr/bin/env bash
# Cross-platform launcher for MPAria (macOS/Linux)
cd "$(dirname "$0")"
echo "MPAria running at http://127.0.0.1:8000"
python3 -m http.server 8000
