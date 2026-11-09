# V10.1 — Critical startup repair

- Fixed a confirmed scene-initialization `ReferenceError` (`makeEmissive is not defined`) triggered by the Sun's corona. The same helper is needed by atmospheres, planetary rings, solar events and planet breakup effects.
- Added `emissiveMaterial` to `src/graphics.js` and imported it into `src/world.js`.
- Explicitly registered empty resource handlers during PlayCanvas AppBase setup.
- Replaced generic CDN-only startup text with stage-aware error diagnostics and an expanded error trace.
- Added three dedicated mock scene-construction regression tests.
- Live WebGL gameplay testing remains unavailable in this environment; the official PlayCanvas module still needs to be downloaded at deployment through GitHub Actions or the included local-engine script.

---

# HELIOS ARENA CHANGELOG

## V10.0 — Cosmic Warfare

- Replaced 4,600 Oort ice tetrahedra with a single bundled panoramic sky and progressively increasing radial containment acceleration. Retained an inexpensive emergency boundary for ships, projectiles and debris.
- Created a 3072 × 1536 original Milky Way/nebula/galaxy panorama as a compressed local WebP asset, independent of third-party image hosts.
- Rebuilt missile guidance with 115 NU/s launch, 230 NU/s max, strong acceleration, velocity prediction, spherical direction interpolation including 180° reversals, 72-second max life, long-range reacquisition and decoy interception.
- Raised missile reserves to 19–26 per ship depending on class.
- Added 16 physical collectible salvage caches with six item types: Railgun, Plasma Scatter, EMP, Overcharge, Repair and Resupply. Caches respawn after timed cooldowns.
- Introduced three ship-only signature powers: Spectre ten-missile Swarm, Vanguard charged Nova Pulse and Titan Cataclysm area warhead. Independent cooldowns and ammo limits.
- Updated bots with pickup priority, resupply/repair decisions and special-weapon usage under ordinary ammo rules.
- Rebuilt cockpit envelope with side walls, rear pressure bulkheads, reinforced sill and canopy, console metalwork, illuminated command strips and class-specific elements. Kept the cockpit layers independent for split-screen.
- Added functional collected-weapon and special HUD controls, pickup visibility/telemetry, keyboard and gamepad inputs, and improved combat feedback.
- Added Balanced, Ultra and Performance graphics settings for resolution and effect/asteroid budgets.
- Added optional GitHub Pages Actions workflow that vendors official PlayCanvas Engine at deployment, avoiding the engine-load failure on sites that cannot access CDNs.
- Extended tests with navigation math and a combat-runtime mock harness that executes the real `ArenaGame` methods.

## Previous editions

V9.3: Resilient startup, independent menu, local-vendor PlayCanvas fallback, readable boot errors.  
V9.2: 36-body solar-system catalogue, relative radius ratios, small ships, Oort gameplay boundary.  
V9.1: Decoy satellites, solar winds, staged planet breakup, improved ship materials and missile effects.  
V9.0: First-person/chase views, predictive aim, heat-seeking lock and split-screen dogfighting.
