#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push-force
echo "Post-merge setup complete"
echo "=== Pushing to GitHub ==="
if [ -n "${GITHUB_TOKEN}" ]; then
  git remote set-url github https://listedbydavid:${GITHUB_TOKEN}@github.com/listedbydavid/xucasa.git 2>/dev/null || git remote add github https://listedbydavid:${GITHUB_TOKEN}@github.com/listedbydavid/xucasa.git
  git push github main:main 2>&1 && echo "GitHub push successful" || echo "WARNING: GitHub push failed — continuing"
  git remote set-url github https://github.com/listedbydavid/xucasa.git
else
  echo "WARNING: GITHUB_TOKEN not set — skipping GitHub push"
fi
