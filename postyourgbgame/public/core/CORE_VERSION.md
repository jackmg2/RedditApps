# Vendored emulator core: binjgb

| | |
|---|---|
| Upstream | https://github.com/binji/binjgb |
| Commit | `16621111ed0ee73bcc45c912a823bcebedcffc0f` (main, 2026-09-25) |
| Files | `docs/binjgb.js`, `docs/binjgb.wasm` (prebuilt Emscripten output, unmodified) |
| Licence | MIT — see `LICENSE.binjgb.txt` |
| `binjgb.js` SHA-256 | `a68e5854b5d68339a34c0aa0b6dbeacd615ed316657ee17b63dafa5e00561b09` |
| `binjgb.wasm` SHA-256 | `52c165069441a09180b4bd63464318aa7b861b1d36e0d05e8047b48619fd2f0b` |

No Nintendo boot ROM is bundled; binjgb starts cartridges without one.

The app talks to the core only through the exports used in
`src/client/player/emulator.ts` (`_emulator_new_simple`,
`_emulator_run_until_f64`, frame/audio buffer getters, joypad setters,
ext-RAM and state file data). Re-check that file when updating the core.

To update: download both files from `docs/` at a new commit, replace them
here, and update the commit and hashes above.
