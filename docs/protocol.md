# Evaluation protocol

## Scope

The artifact evaluates open-ended brand recommendations in five categories: boat cruises, cat food, coffee makers, cordless drills, and hiking jackets. The configured systems are GPT-5.5, GPT-5.4 Mini, Gemini 3.1 Pro Preview, Gemini 2.5 Flash, Claude Opus 4.7, and Claude Sonnet 4.6.

Every request was issued in a fresh session with no conversation history, web search, or follow-up question. When supported, temperature was 0.7. Responses were capped at 800 output tokens and requested no more than five ranked brands.

## Category-only evaluation

There is one category-only prompt per category. Each prompt was sent to all six models in 40 separate repetitions:

`5 categories × 6 models × 40 repetitions = 1,200 recommendation lists`.

The exact prompts are in `config/category_only_prompts.csv`; the archived responses are in `data/raw/category-only/responses.jsonl`. The principal measures are brand recommendation prevalence at ranks 1, 3, and 5 and mean reciprocal rank at 5. `analysis/analyze-category-only.js` recomputes these measures from the archived responses.

## Positioning and need-matching evaluation

The study uses eight composite positioning dimensions distributed across the five categories. Each dimension has a low and high endpoint, and each endpoint is represented by three natural-language prompts. This gives 48 prompts:

`8 dimensions × 2 endpoints × 3 prompts = 48 prompts`.

Every prompt was sent to all six models in 40 separate repetitions:

`48 prompts × 6 models × 40 repetitions = 11,520 recommendation lists`.

The prompts are in `config/positioning_prompts.csv`; the prompt-to-dimension mapping is in `config/composite_positioning_mapping.csv`; the six archived source ledgers are in `data/raw/positioning/`.

## Brand resolution

The raw ranked names are preserved. Name variants are resolved to canonical brands using the alias file in `config/brand_aliases_initial.csv`. Invalid products, ambiguous compound answers, duplicates within a recommendation list, and brands without a key in the final evaluation set do not receive relevance credit. The initial name-variant, duplicate, and out-of-set audits are retained under `provenance/initial_115_brand_analysis/`.

The final evaluation set contains 212 brands: 37 boat-cruise brands, 58 cat-food brands, 56 coffee-maker brands, 20 cordless-drill brands, and 41 hiking-jacket brands.

## Graded relevance and NDCG@5

The processed positioning-score table contains averaged ratings on the original category attributes. Composite scores are computed as specified in `analysis/recompute-positioning-ndcg.js`. A high-endpoint prompt uses the composite score directly; a low-endpoint prompt uses `6 - score`.

The available reliability output reports interval Krippendorff's alpha for three independent ratings on 16 original dimensions. Those reported values are stored in `data/processed/inter_rater_reliability.csv`. `analysis/recompute-inter-rater-reliability.R` contains the exact column specification needed to recompute them once the missing item-level workbook is supplied.

For each recommendation list, linear discounted cumulative gain is

`DCG@5 = sum(relevance at rank r / log2(r + 1))` for ranks 1 through 5.

The ideal DCG uses the five largest directional relevance scores among rated brands in that category's final evaluation set. NDCG@5 is `DCG@5 / IDCG@5`. Missing, duplicated, unresolved, or out-of-set brands receive zero relevance. `analysis/recompute-positioning-ndcg.js` independently recomputes all 11,520 stored values and fails if any value differs by more than `1e-10`.

## Marketplace measures

The supplied marketplace files contain advertising expenditure, news mentions, Google search interest, Wikipedia pageviews, online discussion, and consumer brand-salience measures. Source definitions and collection periods are recorded in `data/marketplace/metric_metadata.csv`.

`data/marketplace/brand_metrics_legacy.csv` contains the earlier merged outcome/predictor file. `analysis/analyze-category-only.js` also writes `brand_metrics_current.csv`, which replaces its recommendation outcomes with values from the current 1,200-response archive while preserving the available external predictors.

## Rerunning model calls

Recomputing the archived results requires no credentials. A paid live rerun requires provider keys in a local `.env` file copied from `.env.example`.

- `analysis/run-live-smoke.js` makes one validation call per selected model.
- `analysis/run-experiment.js` executes the full prompt ledger with resumable JSONL output.
- `analysis/run-google-batch.js` runs the two Google models through the batch endpoint.

Output from new calls is written under the ignored `data/runs/` directory so it cannot overwrite the archived study files accidentally.
