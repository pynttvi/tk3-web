# TK3 handoff

Standalone Canvas prototype; no parent project, API or DOS executable required.

The asset set now comes exclusively from public GPL upstream commit
`a3398b6ea1b898c399575c1e48c4564e806bd114` of
https://github.com/hkroger/ultimatetapankaikki.
All 25 PNG sheets were regenerated as indexed PNGs. Ten campaign maps and five
WAVs match public upstream. The differing supplied DM map was removed. Actor
sheets now have 40 columns; rendering derives the count from image width / 29.
Original files and credits are in vendor/tk-upstream/; regenerate with
`npm run import-assets`. See docs/license-audit.json and THIRD_PARTY_NOTICES.md.

Build output includes a corresponding-source archive. The manual Pages workflow
runs tests, build and replay validation. No graphical-browser/device or DOS
runtime parity verification is claimed. AI, RNG, timing, initial loadout, shop,
weapons, lighting/effects, music and multiplayer remain provisional or unfinished.
