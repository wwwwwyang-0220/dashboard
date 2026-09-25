# Search

Status: planned.

## Product contract

- Provide one text-only search experience across project content. Return matching notes and images, with their project context and a way to open the result.
- Let users find a research figure or three-line table by describing its content, even when its filename and title do not contain the query.
- Keep image notes optional. Automatically extracted content must make an image searchable without requiring the user to write a description.
- Keep keyword and OCR search available without internet access. Semantic search may require an online model API, but vector matching and the search index run on the Mac.
- Use one Mac as the data host and source of truth. Do not add application user accounts or multi-host synchronization for search.

## Implementation order

1. Add a backend search API and a unified result interface. Search project titles, note titles and bodies, and image titles locally. Return stable result IDs, types, project IDs, and useful result context. Replace the current UI-only filters as the source of search results.
2. Process images after upload with local OCR. Index recognized text so labels, legends, table cells, and statistical terms remain searchable offline. Update the index when an item changes or is deleted, and support rebuilding it from saved content.
3. Evaluate cloud image analysis and embedding APIs on representative research material: three-line tables, bar and line charts, histograms, and statistical distributions. Extract searchable descriptions and structure such as variables, axes, legends, comparisons, and trends. Keep the original image and raw OCR as the evidence for any generated description or numeric claim.
4. Add semantic retrieval only after that evaluation. Generate image or extracted-content embeddings when content is added or changes. Generate a compatible text-query embedding for each new semantic query, then perform vector lookup locally and combine those results with keyword and OCR matches. Keep keyword and OCR results usable when the model API is unavailable.

## Storage and operations

- Keep `data/projects.json` and `data/files/` as the canonical project content for now. Store OCR, generated descriptions, model versions, and vectors as derived search data outside the project API payload; allow the index to be rebuilt.
- Run image processing asynchronously so upload completion does not wait for OCR or model calls. Track pending, ready, and failed indexing work and allow retries.
- Do not select a model or vector engine solely from general benchmarks. Compare retrieval quality, Chinese and English queries, latency, cost, and indexing load using actual dashboard images before choosing a provider or changing the primary storage format.

## Current state

- The sidebar filters project titles in the browser. The board's library drawer filters item titles and note bodies in the browser. The project library only filters by item type.
- The Express API has no search endpoint, OCR pipeline, embedding job, or search index. Images currently have a stored file, title, and dimensions, but no automatically extracted searchable content.
