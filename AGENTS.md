# TK3 Canvas — agent handoff

This is the standalone native Canvas TK3 game. Work in this repository only.
It has no dependency on the former parent project, model API, inference worker,
Python analysis tooling, Docker, Ollama, or Ghidra.

## Current result

- Assets from the pinned public GPL release: 25 indexed PNG sheets,
  5 WAV files, and 10 campaign maps. The differing supplied DM map is omitted.
- TypeScript simulation, sprite/tile renderer, keyboard/mouse input, basic enemies,
  four weapons, pickups, map overlay, pause/restart, fullscreen, and audio.
- Audio uses one AudioContext resumed directly in a user gesture. Enable sound
  plays a test shot. Never swallow audio failures or move resume() behind an await.
- Fullscreen includes game controls and tracks fullscreenchange/browser exit.
- This is a playable source-assisted prototype, not a verified full v3.0 port.
  Enemy AI, RNG, 40Hz timing, initial loadout and several systems are provisional.
  Shop, all weapons, original lighting/effects, tracker music and multiplayer
  are unfinished. Existing automated tests are not DOS runtime parity fixtures.

## Commands and structure

Node 22.13+ is required (the Pages workflow uses Node 24). There are no npm
packages to install. Do not introduce a build framework just to deploy to Pages.

- `npm test`: simulation, Canvas/DOM adapter and audio lifecycle tests.
- `npm run build`: compile src/*.ts with Node stripTypeScriptTypes, copy public
  assets into dist/. This strips types; it does not run a type checker.
- `npm run verify`: all-map deterministic replay and finite-state checks on dist/.
- `npm run dev`: build and serve dist/ on port 8080, including LAN access.
- `npm start -- --host 127.0.0.1 --port 8081`: local-only alternative after build.

Edit `src/`, `index.html` and `canvas.css`. `public/scene.js` holds level/asset
metadata; `public/assets/` contains the game assets. `vendor/tk-upstream/` preserves the
pinned public originals and license. `npm run import-assets` regenerates the PNGs
and provenance; it does not replace or move campaign spawns. `dist/` and `.test-build/`
are generated. Do not edit generated copies to implement a change.

## Evidence and preservation rules

1. Preserve COPYING and THIRD_PARTY_NOTICES.md. Source-assisted code carries
   GPL-3.0 notices. Asset provenance is recorded in docs/asset-provenance.json.
2. Do not change maps/graphics to hide a decoder or renderer bug. Keep indexed
   palette presentation, 20px tile addressing and source image dimensions intact.
3. EFP decoder behavior was statically correlated with the supplied binary:
   values above 192 are runs, 192 is literal; palettes are the final 768 bytes.
   The original binary was not included in this standalone game bundle.
4. Public GPL actor sheets have 40 direction columns; the former supplied sheets
   had 32. Derive frame columns from sheet width / 29. Frames are
   28x28 pixels with 1px cell padding; do not hard-code a column count.
5. Preserve level 6's stored spawn. It overlaps a neighboring wall; directional
   collision checks allow moving away. Do not invent a replacement spawn.
6. Seeded replay tests establish determinism, not compatibility with DOS rand().
   Do not label model suggestions or unmeasured game behavior as verified.
7. Keep asset URLs and module imports relative (`assets/...`, `./scene.js`).
   Root-absolute URLs break GitHub Pages project sites under /REPOSITORY/.
8. Test meaningful changed behavior. Validate build and all-map replay before
   publication. Report browser/runtime checks that could not be performed.

## GitHub Pages

The .github/workflows/pages.yml runs on pushes to main and supports manual runs.
It runs tests/build/verification, then publishes dist/. In repository Settings →
Pages select GitHub Actions. No repository/account identity or credentials are
embedded. Do not publish or push without the user's instruction.

The bundle was validated with automated tests and HTTP checks. A graphical
browser and DOS emulator were unavailable during the initial reconstruction.
Useful next work is real browser QA (including sound/fullscreen), Pages project
subpath testing, and measured DOS behavior comparison before parity claims.
