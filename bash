#!/usr/bin/env bash
set -e

echo "Deploying Launch Velocity Warp Engine to GitHub Pages..."

git add index.html
git commit -m "Deploy 3D HTML5 canvas warp tunnel background"
git push origin main

echo "Live at https://launchvelocity-eng.github.io/revenue-engine"
