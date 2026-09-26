# Search

Status: phases 1–4 implemented — ranked keyword and OCR search, automatic image embeddings, and rank fusion behind an Enter-to-search dialog. A reranker (phase 5) is deferred until real misses call for it.

## Product contract

- Provide one text-only search experience across project content. Return matching notes and images, with their project context and a way to open the result.
- Let users find a research figure or three-line table by describing its content, even when its filename and title do not contain the query.
- Keep image notes optional. Automatically extracted content must make an image searchable without requiring the user to write a description.
- Keep keyword and OCR search available without internet access. Semantic search may require an online model API, but vector matching and the search index run on the Mac.
- Expect English queries in normal use. Offline keyword search does not need to match Chinese queries against English figure labels; cross-language matching comes from embeddings when online.
- Use one Mac as the data host and source of truth. Do not add application user accounts or multi-host synchronization for search.

## Implementation order

1. Done: add a backend search API and a unified result interface. Search project titles, note titles and bodies, and image titles locally. Return stable result IDs, types, project IDs, and useful result context. The board drawer retains its contextual filter for choosing items to add to that board.
2. Done: process saved images asynchronously with macOS Vision OCR. Search recognized labels and other text offline. Keep the OCR index outside project data, remove entries when images are deleted, and support a full rebuild and retry. Recognition uses the whole image plus automatically sized overlapping regions for large images; it does not require per-image settings.
3. Done for a small example (2026-09-25): evaluate Google's paid-tier `gemini-embedding-2` for text-to-image retrieval using the procedure in [search-embedding-evaluation.md](search-embedding-evaluation.md). Test representative research material: three-line tables, bar and line charts, histograms, and statistical distributions. Use compatible image and text embeddings from the same model. Test whether natural-language queries retrieve the intended image without asking a model to explain the chart. Compare against title, project, and OCR search, including queries with extra conversational words and Chinese descriptions. If image embeddings miss a needed visual distinction, evaluate minimal searchable image tags or another model before adding broader image analysis.
   Result, promising for this example: four real figures (Figure_3 and Figure_4 in Strategy Project; Figure_2 and Figure_6 in Divided attention Project) and six project-named queries in English and Chinese. Image-only embeddings put the intended figure first for 5 of 6 queries, including Chinese ones and Strategy's forest plot over Divided attention's near-identical one. The miss was “divided attention 项目里 FA、addition、division 的正确率”: Figure_6 shares every English label, and only “accuracy” separates it from Figure_2 (cosine gap 0.017). Each image cost 258 tokens, so fine labels in large multi-panel figures may be downscaled away. Total cost was about US$0.0005.
4. Done: add semantic retrieval after that evaluation. Embed each saved image once and each new text query with the compatible encoder, keep image vectors and vector matching on the Mac, and combine vector candidates with local title, project, and OCR candidates. Merge the BM25 and embedding rankings by rank (Reciprocal Rank Fusion), breaking ties toward the keyword rank, which reflects exact labels and project names while the embedding sees a downscaled image. Add no reranker in this step: fusion put the intended figure first for all six phase 3 queries in an end-to-end check, including the one embeddings alone missed. Keep keyword and OCR results usable when the model API is unavailable.
5. Consider a reranker only if real searches show misses that fusion cannot fix. Then compare a hosted text-only judgment model (TypeSafe Jev) with a local open model (for example Laya) on actual dashboard figures, including latency on this Mac. A local model keeps reranking offline and sends no OCR text or project titles out. Give a reranker only text — query, project, title, OCR, and retrieval signals — never image vectors.

## Keyword ranking

- Local keyword and OCR search uses MiniSearch, an in-memory BM25 index in the API process. Fields are item title, project title, and note body or OCR text, boosted in that order. Queries match any term rather than all terms, ignore common English stop words, split words with `Intl.Segmenter` (so punctuation-joined labels and Chinese runs split), match prefixes, and tolerate small misspellings and OCR misreads in terms longer than three characters.
- The index is derived data. Each search reconciles it with the saved projects and OCR records, so it rebuilds after a restart and follows edits without separate save hooks. The browser still calls `GET /api/search`; page load does not build or download an index.
- Revisit SQLite FTS5 (on-disk BM25) if rebuilding the index at API start becomes noticeably slow or the API's memory use grows clearly. The switch would replace `server/search.js` and rebuild derived data only; project data would not change. FTS5 lacks MiniSearch's built-in fuzzy matching, which matters for OCR misreads.
- In the phase 4 hybrid, merge BM25 and embedding rankings by rank (for example Reciprocal Rank Fusion) rather than by raw score, and fall back to BM25 alone when the model API is unavailable.

## Storage and operations

- Keep `data/projects.json` and `data/files/` as the canonical project content for now. Store OCR, optional image tags, model versions, and vectors as derived search data outside the project API payload; allow the index to be rebuilt.
- Run image processing asynchronously so upload completion does not wait for OCR or model calls. Track pending, ready, and failed indexing work and allow retries.
- Do not select an embedding model, reranker, or vector engine solely from general benchmarks. Compare top-result quality, Chinese and English queries, no-match behavior, latency, cost, and indexing load using actual dashboard images before choosing a provider or changing the primary storage format.
- Use `Figure_3` as a retrieval example: “the YA and OA bars for Intact Probe in Strategy Project” should put it first. The earlier all-terms matcher returned nothing for this query; ranked BM25 search over project, title, and OCR text now puts `Figure_3` first offline. Similar projects are common, so project titles in the query are the main way to separate look-alike figures such as two projects' posterior forest plots. A match means “this is likely the image the user wants to inspect,” not a claim about bar heights or statistical meaning.

## Search interaction

- Search serves describing content more than finding a known item; the project library already covers picking a known note or image. Typing shows up to five quick matches by item title and project name, instantly and locally, in a lighter style. Enter or the Search button runs the full search and shows one stable list under “Results for ‘…’”. The heading alone marks which query the list answers; editing the query does not mark the list as stale.
- The full search embeds the query once (about 0.3–0.4 s measured) and caches it. If Gemini does not answer within 2 seconds or no key is available, the list is keyword and OCR matches with a short note that search by meaning is unavailable.
- Image embedding is always on; there is no setting. New images are embedded in the background after saving, like OCR. Only the image is sent to Google on the paid tier — no titles, notes, OCR text, or project names.

## Current state

- The sidebar and top strip open unified search. `GET /api/search?q=` runs the full search: MiniSearch BM25 over project titles, note titles and bodies, image titles, and OCR text, fused with the ten images closest to the query embedding. `GET /api/search?q=&mode=quick` returns the quick title and project matches. The board's library drawer still filters its own items in the browser, and the project library filters by item type.
- OCR records include text, confidence, and image coordinates in rebuildable `data/search/index.json`. A failed OCR job keeps any earlier searchable text until retry.
- `server/embedding-index.js` embeds each image once with `gemini-embedding-2` at 768 dimensions (the same rankings as 3072 on the phase 3 set, a quarter of the storage) and stores unit vectors as base64 in rebuildable `data/search/embeddings.json`. GIF and WebP images are converted to PNG with `sips` first. Failed embeddings retry after five minutes; deleted images lose their vectors. `GET /api/search/index` reports OCR and embedding counts, and `POST /api/search/rebuild` redoes both.
- The Gemini key comes from `GEMINI_API_KEY`, then the 0600 file `~/.config/gemini/key` (or `GEMINI_API_KEY_FILE`), then the macOS Keychain item `GEMINI_API_KEY`. The Keychain is locked to processes in a detached tmux session or cron, so an API started there needs the environment variable or the key file.
