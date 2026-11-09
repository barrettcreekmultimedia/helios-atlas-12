#!/usr/bin/env sh
set -eu
mkdir -p vendor
for url in \
  'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas.mjs' \
  'https://unpkg.com/playcanvas@2.23.3/build/playcanvas.mjs'
do
  echo "Trying $url"
  if curl -fLsS --connect-timeout 8 --max-time 40 "$url" -o vendor/playcanvas.mjs; then
    if [ "$(wc -c < vendor/playcanvas.mjs)" -gt 100000 ]; then
      echo 'PlayCanvas vendored successfully. Upload vendor/ with your GitHub Pages source.'
      exit 0
    fi
  fi
done
echo 'Unable to retrieve the PlayCanvas module. Check your network or copy playcanvas.mjs manually.' >&2
exit 1
