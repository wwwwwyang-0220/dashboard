# Search

Status: phases 1 and 2 implemented; multimodal retrieval evaluation remains planned.

## Product contract

- Provide one text-only search experience across project content. Return matching notes and images, with their project context and a way to open the result.
- Let users find a research figure or three-line table by describing its content, even when its filename and title do not contain the query.
- Keep image notes optional. Automatically extracted content must make an image searchable without requiring the user to write a description.
- Keep keyword and OCR search available without internet access. Semantic search may require an online model API, but vector matching and the search index run on the Mac.
- Use one Mac as the data host and source of truth. Do not add application user accounts or multi-host synchronization for search.

## Implementation order

1. Done: add a backend search API and a unified result interface. Search project titles, note titles and bodies, and image titles locally. Return stable result IDs, types, project IDs, and useful result context. The board drawer retains its contextual filter for choosing items to add to that board.
2. Done: process saved images asynchronously with macOS Vision OCR. Search recognized labels and other text offline. Keep the OCR index outside project data, remove entries when images are deleted, and support a full rebuild and retry. Recognition uses the whole image plus automatically sized overlapping regions for large images; it does not require per-image settings.
3. Evaluate multimodal embedding APIs for text-to-image retrieval on representative research material: three-line tables, bar and line charts, histograms, and statistical distributions. Use compatible image and text encoders from the same embedding model. Test whether natural-language queries retrieve the intended image without asking a model to explain the chart. Compare against title, project, and OCR search, including queries with extra conversational words and Chinese descriptions. If image embeddings miss a needed visual distinction, evaluate minimal searchable image tags before adding broader image analysis.
4. Add semantic retrieval after that evaluation. Embed each saved image once and each new text query with the compatible encoder, keep image vectors and vector matching on the Mac, and combine vector candidates with local title, project, and OCR candidates. Evaluate a text-only judgment model such as TypeSafe Jev for reranking a bounded shortlist using the query, project identity, title, OCR text, and retrieval signals; do not send raw image vectors to Jev or expect it to inspect the image. Keep keyword and OCR results usable when the model API is unavailable.

## Storage and operations

- Keep `data/projects.json` and `data/files/` as the canonical project content for now. Store OCR, optional image tags, model versions, and vectors as derived search data outside the project API payload; allow the index to be rebuilt.
- Run image processing asynchronously so upload completion does not wait for OCR or model calls. Track pending, ready, and failed indexing work and allow retries.
- Do not select an embedding model, reranker, or vector engine solely from general benchmarks. Compare top-result quality, Chinese and English queries, no-match behavior, latency, cost, and indexing load using actual dashboard images before choosing a provider or changing the primary storage format.
- Use `Figure_3` as a retrieval example: OCR finds `Related Probe`, `Accuracy`, and `YA Strategy`, but the current strict keyword matcher misses a longer query such as “the YA and OA bars for Intact Probe in Strategy Project.” Candidate retrieval must include project context and tolerate extra words; multimodal similarity and reranking should bring the image near the top. A match means “this is likely the image the user wants to inspect,” not a claim about bar heights or statistical meaning.

## Current state

- The sidebar and top strip open unified search. `GET /api/search?q=` searches saved projects, note titles and bodies, image titles, and locally recognized image text on the Mac. The board's library drawer still filters its own items in the browser, and the project library filters by item type.
- OCR records include text, confidence, and image coordinates in rebuildable `data/search/index.json`. The API reports pending, ready, and failed counts and can rebuild the index. A failed OCR job keeps any earlier searchable text until retry. No cloud model, embedding job, or vector index is implemented yet.
