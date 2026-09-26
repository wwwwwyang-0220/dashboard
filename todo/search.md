# Search

Status: phases 1 and 2 implemented; image understanding remains planned.

## Product contract

- Provide one text-only search experience across project content. Return matching notes and images, with their project context and a way to open the result.
- Let users find a research figure or three-line table by describing its content, even when its filename and title do not contain the query.
- Keep image notes optional. Automatically extracted content must make an image searchable without requiring the user to write a description.
- Keep keyword and OCR search available without internet access. Semantic search may require an online model API, but vector matching and the search index run on the Mac.
- Use one Mac as the data host and source of truth. Do not add application user accounts or multi-host synchronization for search.

## Implementation order

1. Done: add a backend search API and a unified result interface. Search project titles, note titles and bodies, and image titles locally. Return stable result IDs, types, project IDs, and useful result context. The board drawer retains its contextual filter for choosing items to add to that board.
2. Done: process saved images asynchronously with macOS Vision OCR. Search recognized labels and other text offline. Keep the OCR index outside project data, remove entries when images are deleted, and support a full rebuild and retry. Recognition uses the whole image plus automatically sized overlapping regions for large images; it does not require per-image settings.
3. Evaluate cloud image analysis and embedding APIs on representative research material: three-line tables, bar and line charts, histograms, and statistical distributions. Extract searchable descriptions and structure such as variables, axes, legends, comparisons, and trends. Keep the original image and raw OCR as the evidence for any generated description or numeric claim.
4. Add semantic retrieval only after that evaluation. Generate image or extracted-content embeddings when content is added or changes. Generate a compatible text-query embedding for each new semantic query, then perform vector lookup locally and combine those results with keyword and OCR matches. Keep keyword and OCR results usable when the model API is unavailable.

## Storage and operations

- Keep `data/projects.json` and `data/files/` as the canonical project content for now. Store OCR, generated descriptions, model versions, and vectors as derived search data outside the project API payload; allow the index to be rebuilt.
- Run image processing asynchronously so upload completion does not wait for OCR or model calls. Track pending, ready, and failed indexing work and allow retries.
- Do not select a model or vector engine solely from general benchmarks. Compare retrieval quality, Chinese and English queries, latency, cost, and indexing load using actual dashboard images before choosing a provider or changing the primary storage format.
- Use `Figure_3` as a retrieval example: OCR should find `Related Probe`, `Accuracy`, and `YA Strategy`. The last query is a keyword match across recognized lines, not proof that the system knows which bar represents YA Strategy. Future chart analysis must preserve panel, axis, and condition relationships and mark missing legends or ambiguous abbreviations as unknown.

## Current state

- The sidebar and top strip open unified search. `GET /api/search?q=` searches saved projects, note titles and bodies, image titles, and locally recognized image text on the Mac. The board's library drawer still filters its own items in the browser, and the project library filters by item type.
- OCR records include text, confidence, and image coordinates in rebuildable `data/search/index.json`. The API reports pending, ready, and failed counts and can rebuild the index. A failed OCR job keeps any earlier searchable text until retry. No cloud model, embedding job, or vector index is implemented yet.
