# Search

One search box for everything: project names, note titles and text, image titles, text recognised in images, and (with a Gemini key) what images show.

## Sub-features

- `open`: ⌘K, the sidebar search button, or the magnifier at the top.
- `quick`: typing shows up to five title matches.
- `full`: Enter searches everything and lists "Results for …".
- `fallback`: without search-by-meaning, a notice says results are keyword and image-text only.
- `open-result`: choosing a result opens its project and, for notes and images, that item.

## How to get to it (user POV)

Press ⌘K anywhere outside a board, or click **Search projects, notes, images** in the sidebar.

## Driving it with control-dashboard

- Open: `press Meta+KeyK`; `snapshot --role dialog`.
- Quick: `fill --role searchbox --name "Search projects, notes, and images" --value "method"`; the Quick matches region lists "Method notes".
- Full: `press Enter --role searchbox --name "Search projects, notes, and images"`; the region "Results for method" shows a count.
- Open result: `click` the result button (name from `snapshot --role dialog`, e.g. "Method notes Participants read … Note · Reading Study"); the search closes and the focus dialog for that note opens.
- No results: search "zzzz" and expect a zero count, not an error.
- Meaning search: only with `up --semantic`, and name that the query went to Gemini.

## Gotchas

- Default runs have no Gemini key, so the fallback notice is expected there and is not a bug.
- OCR runs in the background after an image is added; image text may not be searchable for a few seconds.
- The fixture image has no text in it, so it cannot prove OCR. Upload an image with visible words to test that path.
