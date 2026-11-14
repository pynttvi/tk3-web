# TK3 Canvas — license and credits

## Source-assisted game code

The TK asset readers and selected gameplay/rendering translations derive from
Ultimate Tapan Kaikki, originally created by Error Free Productions, published
by hkroger under the GNU General Public License version 3:

https://github.com/hkroger/ultimatetapankaikki
Commit: a3398b6ea1b898c399575c1e48c4564e806bd114
License: https://github.com/hkroger/ultimatetapankaikki/blob/a3398b6ea1b898c399575c1e48c4564e806bd114/LICENSE

Relevant source: SRC/EFP/EFP.CPP, TYPES.H, DRAW.CPP, CLASSES.CPP, MISCFUNC.CPP,
GAME.CPP, GLOBVAR.CPP and DEFINES.H. The source-assisted TypeScript code and
project build/test scripts are provided under GPL version 3; see COPYING.
Preserve these notices and provide corresponding source when distributing builds.
The site includes tk3-source.tar.gz containing editable source, assets, tests,
license records and build instructions. Run `npm run build` with Node 22.13+
to reproduce the static build; no npm dependencies are needed.

This modified Canvas/TypeScript reconstruction was prepared in 2026. It is not
an official Error Free Productions release. Original v3.0 timing, AI, randomness
and unsupported subsystems have not been independently verified.

## Original credits

The upstream README.TXT credits Allu for main programming and graphics, Unski
for additional programming, and Raipe, Allu and Unski for music. Music, the
Midas Digital Audio System and the original DOS executables are not included
in this project. Original credits are preserved without claiming ownership of
their work.

## Graphics, maps and sounds from the public GPL release

All 25 graphics sources, ten campaign maps and five WAV files are taken from
the pinned public upstream commit above, under its repository-wide GPL version 3
license. Original EFP/LEV/WAV files, LICENSE and README.TXT are preserved in
vendor/tk-upstream/. docs/upstream-files.json pins their Git blob IDs;
docs/license-audit.json records SHA-256 hashes. No external artwork or sounds
from the previously supplied copy remain in the game.

The EFP images are converted to indexed PNGs, preserving their source dimensions,
palette indices, six-bit palette scaling and configured transparency. Actor
sheets now have 40 direction columns, derived at runtime from width / 29.
The ten campaign maps match upstream exactly, including level 6's stored spawn.
The differing supplied DM map is omitted. npm run import-assets reproduces the
conversion from the preserved originals and rejects input blob mismatches.

This documents reliance on the upstream repository's GPL grant; it does not
claim independent authorship or DOS runtime compatibility.
