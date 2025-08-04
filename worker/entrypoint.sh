#!/usr/bin/env bash
set -euo pipefail

# 1. Clone or pull latest code
if [ ! -d "/app/tangle-sg" ]; then
  git clone --branch "$REPO_BRANCH" "$REPO_URL" /app/tangle-sg
else
  cd /app/tangle-sg && git pull
fi

# 2. Build the tangle-sg binary
cd /app/tangle-sg
# Assuming your repo has a Makefile that produces `tangle_poc`
./install.sh

# 3. Copy the built binary to /app
cp ./tangle_poc /app/tangle_poc
chmod +x /app/tangle_poc

# 4. Start the tangle_poc node in background

exec /app/tangle_poc


