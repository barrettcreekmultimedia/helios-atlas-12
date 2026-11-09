HELIOS ARENA V10 — PLAYCANVAS ENGINE

The full PlayCanvas Engine is NOT bundled in the ZIP. It could not be downloaded in the creation environment.

OPTION 1 — GitHub Actions (recommended):
Upload repository including .github/workflows/pages.yml, then in your repo Settings > Pages choose GitHub Actions.
The workflow fetches the official PlayCanvas 2.23.3 engine at build time and includes it in the deployed site.

OPTION 2 — Branch-based Pages (existing setup):
Run fetch-engine.bat on Windows BEFORE uploading, and verify vendor/playcanvas.mjs is larger than 100 KB.
Then commit it to your main branch with the rest of the project.

OPTION 3 — Automatic CDN fallback at runtime:
If no vendor copy exists, startup will try jsDelivr, unpkg and esm.sh.
This needs a browser that can reach at least one source.
