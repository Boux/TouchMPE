#!/bin/sh
#
# Build TouchMPE for GitHub Pages (served at /TouchMPE/)
#
# Vite handles JS/CSS paths via --base, but files in public/ are copied
# verbatim, so we patch their absolute paths after the build.
#

BASE="/TouchMPE"
OUT="docs"

# Build with the subpath base
yarn vite build --base="$BASE/" --outDir="$OUT"

# Patch manifest.json
sed -i \
  -e "s|\"id\": \"/\"|\"id\": \"$BASE/\"|" \
  -e "s|\"start_url\": \"/\"|\"start_url\": \"$BASE/\"|" \
  -e "s|\"/icon|\"$BASE/icon|g" \
  "$OUT/manifest.json"

# Patch service worker paths
sed -i "s|'/|'$BASE/|g" "$OUT/sw.js"

# Patch index.html static links
sed -i \
  -e "s|href=\"/manifest.json\"|href=\"$BASE/manifest.json\"|" \
  -e "s|href=\"/icon-192.png\"|href=\"$BASE/icon-192.png\"|" \
  "$OUT/index.html"

echo ""
echo "Done. Commit and push — GitHub Pages serves from /docs on main."
