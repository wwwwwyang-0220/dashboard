# Gemini Embedding 2 retrieval evaluation

## Decision to make

Determine whether Google's paid-tier `gemini-embedding-2` is good enough to retrieve this dashboard's research figures from text queries. The target is to return the image the user wants to inspect, not to interpret chart values. This is a small, isolated experiment before production integration. Use the Gemini Developer API's `embedContent` endpoint, not Google's hosted File Search: image and query embeddings must be available for local ranking.

Start with Google only. Test Voyage only if Google misses the acceptance criteria and the failures plausibly come from the embedding model rather than candidate generation, metadata matching, or evaluation setup.

## What the user needs to provide

1. **API access:** a Google AI Studio / Gemini API key for a project on the paid tier. Make it available to the agent as `GEMINI_API_KEY` in its process environment or another local secret store. Do not paste the key into chat, a tracked file, logs, or the report. The agent should confirm the key works and that the intended project is on the paid tier before sending images. Ask for setup help only if this cannot be established without user action.
2. **Permission to send specific images to Google:** identify which existing dashboard images may be used for this experiment. Paid-tier API use and external transmission are separate decisions. Do not send any image until the user has authorized that set. Do not upload unrelated notes, project JSON, or a whole directory. Query text also goes to Google's API during the experiment; sending OCR text or project metadata with an image needs explicit inclusion in the approved test scope.
3. **Representative images:** use the existing `Figure_3` if authorized, plus enough approved figures to make retrieval meaningful. Aim for 20–30 images spanning bar/line charts, tables, histograms or distributions, and several visually similar figures with repeated labels or figure numbers across projects. If the dashboard does not contain enough approved images, ask the user for more. An 8–12 image smoke test can check the workflow but cannot settle model quality.
4. **Search intent:** the user should provide or approve 5–10 realistic searches in their own wording and identify the intended image(s). The agent may draft the rest from the approved images and their project context for user confirmation. Include English and Chinese, short and conversational queries, repeated labels across projects, and a few searches for which no image in the set is correct. Do not use filenames as a shortcut unless that is how the user would naturally search.

The known motivating query is approximately: “the YA and OA bars for Intact Probe in Strategy Project.” Verify the exact terminology and intended Figure_3 match with the user; OCR currently contains terms such as `Related Probe`, `Accuracy`, and `YA Strategy`, so an invented label could make this an invalid test.

## Agent procedure

1. Read `todo/search.md`, the current search code, and the approved image inventory. Record image IDs, project IDs/titles, type, pixel size, and OCR availability without modifying canonical project data. Keep a private mapping from each test query to its relevant image IDs. Never infer relevance solely from model scores.
2. Check Google's current official model and pricing documentation for `gemini-embedding-2`, image input limits, and API request format. Confirm the paid-tier project and set a small experiment budget cap (default: **US$2 of API usage**). Estimate request count and cost before sending data. If paid-tier status or cost cannot be verified, stop before uploading images and report what is needed.
3. In a disposable local harness, embed each approved image with `gemini-embedding-2`. Generate one vector per image; record model ID, output dimension, and input/image handling. Use one consistent dimension for images and queries (start with 1536; compare 3072 only if retrieval misses suggest a dimension issue). Do not mix vectors from different models. Keep vectors and raw API responses out of Git and outside `data/projects.json`.
4. Embed each approved text query with the same model, then rank image vectors locally by cosine similarity. Preserve the complete ranked list and scores for analysis. Measure API latency for image indexing and query embedding separately; local similarity time is separate. Do not send every stored image on each search.
5. Run the current title/project/OCR search as a baseline on the same queries. Then test a simple combined candidate list: union the top semantic images with any relevant title, project, or OCR candidates. The existing strict keyword matcher may omit a correct image when the query has extra words; record this as a baseline limitation, not a model failure. Use project IDs/titles as explicit metadata rather than expecting the image vector to know its project.
6. Review failures by category: small chart text/labels, visually similar figures, project disambiguation, Chinese wording, query length, incorrect ground truth, or no-match cases. If a comparison is needed, test a minimal image-plus-existing-OCR/metadata embedding variant separately from the image-only baseline. Do not introduce generated chart explanations or Jev reranking in this experiment.
7. Do not change the production search API, OCR index, or UI during the evaluation. Use read-only access to personal project data; any temporary outputs must be disposable and excluded from Git. Remove only temporary image/API-response copies created by the harness when finished; never delete or overwrite canonical project files. Preserve safe aggregate findings and the reproducible harness.

## Measurements and decision rule

- For each query, report target image rank, Recall@1 and Recall@5, and whether project context selects the right duplicate. Report image-only semantic, existing search, and combined candidates separately.
- For no-match queries, record whether the top results look misleading. Similarity scores alone do not define a universal rejection threshold; inspect their distribution and recommend a threshold only if supported by the sample.
- Record Chinese and English results separately, plus total API calls, observed cost or billable units, mean and worst-case query latency, and initial indexing time.
- **Proceed with Google** if the intended image reaches the top five for nearly all user-approved queries, most clear queries place it first, and there is no recurring failure on the core Figure_3-style search after project/OCR candidates are combined. Treat 90% Recall@5 and 75% Recall@1 on the approved positive queries as a provisional bar, not a claim of statistical confidence from a small sample. If the sample is too small or ambiguous, report "inconclusive".
- **Investigate before switching providers** if failures are concentrated in project-title matching or exact OCR labels; those are likely retrieval/pipeline issues. Consider a Voyage comparison if Google consistently misses visual distinctions across multiple images despite correct ground truth and candidate handling.

## Deliverables for the next agent

- A reproducible local experiment script and run instructions, with no embedded credentials or copied user images in Git.
- A concise results report with the approved sample size, representative queries, ranks, failure examples, cost/latency, and a clear recommendation: proceed, revise the pipeline, compare Voyage, or gather more examples.
- A short list of any user input still needed. Keep the current dashboard and personal data unchanged during this test.

Official references: [Gemini Embedding 2 model](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2), [embedding API guide](https://ai.google.dev/gemini-api/docs/embeddings), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).
