# TK3 Canvas

[Play on GitHub Pages](https://pynttvi.github.io/tk3-web/) · [Source repository](https://github.com/pynttvi/tk3-web)

A standalone, playable Canvas prototype of Tapan Kaikki using assets from the
public GPL release. It includes ten campaign maps, 25 graphics sheets, sound effects,
movement/collision, shooting, basic enemies, fullscreen, and an audio toggle.

This is a prototype. Original AI/RNG/timing are not verified; shop/progression,
all weapons, original lighting/effects, music and multiplayer remain unfinished.
The original DOS executables are not included or needed to play.

## Run after moving this folder

Use Node **22.13+** (Node 24 recommended). There are no dependencies to install.

```bash
npm test
npm run build
npm run verify
npm start
```

Open http://localhost:8080, or http://YOUR_LAN_IP:8080 from another LAN device.
`npm run dev` builds and starts the server together. To limit access locally:

```bash
npm start -- --host 127.0.0.1 --port 8081
```

Start a mission. WASD moves; mouse aims; click/Space fires. Arrow keys provide
tank controls, Q/E strafe, 1–4 switch weapons, Tab shows the map, P/Esc pauses,
and R resets. **Enable sound** plays a confirmation shot. **Fullscreen** expands
the game and controls. Rendering/audio tests use test doubles; real device and
DOS runtime equivalence still need checking.

## Assets and license

All shipped graphics, maps and sounds now come from the [public GPL release](https://github.com/hkroger/ultimatetapankaikki/tree/a3398b6ea1b898c399575c1e48c4564e806bd114).
Original files and upstream credits/license are preserved in `vendor/tk-upstream/`.
The differing supplied v3.0 graphics were replaced; the optional DM map is omitted.
No DOS runtime parity is claimed. See [license audit](docs/license-audit.json) and
[credits and license](THIRD_PARTY_NOTICES.md). `npm run import-assets` reproduces
the indexed PNGs from pinned originals, verifying Git blob IDs first.

## Update GitHub Pages

1. Make changes in `src/`, `index.html`, `canvas.css`, or `public/`, then run
   the test/build/verify commands above. `dist/` is generated and Git-ignored.
2. Commit and push to `main` in [pynttvi/tk3-web](https://github.com/pynttvi/tk3-web).
3. **Publish TK3 to GitHub Pages** runs automatically and deploys after tests,
   build, and verification pass. You can also use **Actions → Publish TK3 to
   GitHub Pages → Run workflow** to deploy manually.
4. The site is served at https://pynttvi.github.io/tk3-web/.

All asset/module links are relative, so a repository subpath needs no base-URL
configuration. Alternatively, host the complete contents of `dist/` with any
static HTTP host. There is no backend, model server or Python requirement.

Workflow references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Files and handoff

- `AGENTS.md`: context and working instructions for continuing in a new checkout.
- `src/`: editable TypeScript; no parent-project imports.
- `public/scene.js`, `public/assets/`: ready-to-use local level and asset data.
- `scripts/`: build, preview server, tests and map verification.
- `tests/`: synthetic simulation, input, fullscreen and audio checks.
- `docs/asset-provenance.json`: asset hashes, source offsets and source citations.
- `docs/HANDOFF.md`: implementation status and validation limits.
- `COPYING`, `THIRD_PARTY_NOTICES.md`: source license and original credits.
- `dist/`: generated website, including a downloadable corresponding-source archive.

The source-assisted game code, build/test scripts and public upstream assets are
distributed under GPL version 3; preserve COPYING and upstream credits. The build includes
`tk3-source.tar.gz` with editable source and build inputs beside the compiled code.

The **Upscaled graphics** button switches between original and 4× nearest-neighbor sheets. Gameplay and aiming use the same coordinates in both modes. The default is off; failed loads leave current graphics active. See `public/assets/upscaled/` for provenance.
