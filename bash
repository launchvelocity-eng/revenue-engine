#!/usr/bin/env bash
set -e

echo "=== Launch Velocity: Hardened Git Push ==="

# 1. Remove any stale git lock file if a previous mobile session crashed
rm -f .git/index.lock

# 2. Ensure Git identity is set locally so commit never blocks
if [ -z "$(git config user.email)" ]; then
  git config user.email "deploy@launchvelocity.io"
fi
if [ -z "$(git config user.name)" ]; then
  git config user.name "Launch Velocity Engine"
fi

# 3. Detect active branch name (main or master)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Active branch: $BRANCH"

# 4. Stage all updated frontend files
git add -A

# 5. Commit only if changes exist (avoids 'nothing to commit' exit error)
if git diff-index --quiet HEAD --; then
  echo "No new file changes detected in index.html."
else
  git commit -m "Deploy 3D HTML5 canvas warp tunnel background"
fi

# 6. Sync remote changes cleanly and push
git pull origin "$BRANCH" --rebase --autostash || true
git push -u origin "$BRANCH"

echo "=== Deployed to https://launchvelocity-eng.github.io/revenue-engine ==="
