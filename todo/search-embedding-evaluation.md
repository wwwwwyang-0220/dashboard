# Gemini Embedding 2: small retrieval check

## Goal and scope

Use **2–3 approved dashboard images** to see whether Google's paid-tier `gemini-embedding-2` can put the intended research figure first for a natural-language text query. This is a quick feasibility check, not a benchmark or a decision about general search quality. Do not change the production search API or UI.

Use the Gemini Developer API `embedContent` endpoint so the image and query vectors can be compared locally. Start with image-only embeddings. The image's project title is separate metadata; the model cannot infer project membership from the pixels.

## What the user needs to provide

1. A **Google Gemini API key connected to a paid-tier project**. Expose it to the executing agent as `GEMINI_API_KEY` through a local environment variable or secret store. Do not paste it into chat, commit it, or print it in logs. If the paid tier cannot be verified, ask the user to confirm it before sending images.
2. **Approval for the specific 2–3 images to be sent to Google.** Start with `Figure_3` and one or two other figures, preferably visually similar. Existing dashboard images are enough if the user approves them; request extra images only if there is no useful comparison image. Send no other project data. Query text will also be sent to the API.
3. **One real query and its intended image.** The known example is roughly “the YA and OA bars for Intact Probe in Strategy Project,” intended to find `Figure_3`; check the exact wording with the user because the current OCR shows `Related Probe`, `Accuracy`, and `YA Strategy`. The agent may draft 1–2 additional queries for the user to confirm. A Chinese paraphrase is useful but optional.

## Steps for the executing agent

1. Read `todo/search.md` and inspect only the approved images and their existing OCR/project metadata. Note each image's stable ID and project. Do not edit `data/projects.json` or saved image files.
2. Check the current official Google model/API documentation. Confirm the key and paid tier, and keep this run below **US$0.10 in API charges**. Stop and report if access or the approved image set is missing.
3. Write a minimal, disposable local script. Generate one `gemini-embedding-2` vector per approved image, then one vector per confirmed text query using the same output dimension. Store vectors locally outside Git; never put credentials, user images, or raw API responses in a commit.
4. Compute cosine similarity locally and show the complete ranking of the 2–3 images for each query. Record which image was first, the similarity scores, and approximate API usage/cost. Compare briefly with the current keyword/OCR result for the main query. Do not use an LLM to explain charts or add Jev reranking.
5. If the intended image is not first, inspect whether the query depends on small labels or project identity. Optionally try a separate query without the project name, or combine the existing OCR/project metadata locally. Do not send OCR text or project metadata to Google without the user's approval.

## Report and interpretation

Report the approved images and queries, the rankings, the current search result, cost, and any visible failure. State one of: **promising for this example**, **failed this example**, or **inconclusive**. With only 2–3 images, do not report Recall@5, percentage accuracy, a universal similarity threshold, or a claim that Google is generally better than another provider. A successful check is enough to proceed with a small implementation trial; broader reliability can be judged as more real images appear naturally in the dashboard.

Keep the harness reproducible and the user's canonical data untouched. Remove only temporary copies created for this check, not the original images. Do not push results or run another provider unless asked.

Official references: [model](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2), [API guide](https://ai.google.dev/gemini-api/docs/embeddings), [pricing](https://ai.google.dev/gemini-api/docs/pricing).
