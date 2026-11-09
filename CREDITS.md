# Art, technology and provenance

- **PlayCanvas Engine 2.23.3**, the real engine used by the project; MIT License. <https://github.com/playcanvas/engine>. The engine binary is fetched by the included deployment workflow or `fetch-engine` script rather than enclosed in the delivered ZIP.
- **Planet textures** in `assets/*.jpg` are carried forward from earlier Helios Atlas versions as local fallback map artwork. Some of the earlier optional imagery sources were the Solar System Scope texture catalogue (CC BY 4.0). **V10 does not load those external maps at runtime**; it uses the files included in the repository. Planet maps may be artist-made, stylized or representative, particularly for small moons.
- **360° cosmic panorama** in `assets/sky/cosmic-panorama.webp` was generated for this project from original layered procedural noise, stars, galactic structures and color grading. It does not represent a photographic sky survey or a literal view of the real Oort Cloud.
- **Vessel geometry, cockpit designs, collectible pickups, weapons, destruction effects and HUD** are original procedural assets and code developed for Helios Arena. The command bridge evokes a general premium sci-fi style; no existing fictional franchise vessel model is supplied.
- **Music and sound effects** are synthesized using Web Audio from original procedural patterns; no commercial recording is embedded.
- **Scientific distinction:** Ship dynamics, world positions/distances, solar wind effects, weapon effectiveness, destructible planets and the Oort boundary are intentionally fictional game abstractions. Planet and major-moon visual radii are approximate relative sizes only.
- **Project code and asset use:** See `LICENSE` for project licensing. Third-party engine licensing is separate.
