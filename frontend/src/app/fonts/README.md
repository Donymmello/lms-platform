# Fonts

Served from this repository, not fetched from Google Fonts.

`next/font/google` resolves families at **build time**, so a build on a machine
without outbound internet — a CI runner, a closed network, or a flaky
connection — fails outright with `Failed to fetch 'Archivo' from Google Fonts`.
Self-hosted, the build has no network dependency, and the browser makes one
fewer third-party connection.

Only the **latin** subset is included (`U+0000–U+00FF`), which covers
Portuguese in full. Files were taken from the Google Fonts CSS API.

| File | Family | Weight | Style |
|---|---|---|---|
| `archivo-latin-variable.woff2` | Archivo | 100–900 (variable) | normal |
| `instrument-serif-latin-400.woff2` | Instrument Serif | 400 | normal |
| `instrument-serif-latin-400-italic.woff2` | Instrument Serif | 400 | italic |

## Licences

Both families are under the **SIL Open Font License 1.1**, which permits
redistribution with the copyright notice and licence text included — hence
`OFL-Archivo.txt` and `OFL-Instrument-Serif.txt` in this folder. Do not delete
them when moving the fonts around.

- Archivo — Copyright 2020 The Archivo Project Authors, <https://github.com/Omnibus-Type/Archivo>
- Instrument Serif — Copyright 2022 The Instrument Serif Project Authors, <https://github.com/Instrument/instrument-serif>

## Replacing or adding a weight

Fetch the CSS for the family with a modern browser `User-Agent` (Google serves
`woff2` only to those), take the `@font-face` block whose `unicode-range`
starts at `U+0000`, download the `.woff2` it points at, and add it to the
`localFont` call in `../layout.tsx`.
