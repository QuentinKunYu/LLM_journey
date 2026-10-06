# Evaluation protocol

## Categories and models

The study covers boat cruises, cat food, coffee makers, cordless drills, and hiking jackets. The six systems are GPT-5.5, GPT-5.4 Mini, Gemini 3.1 Pro Preview, Gemini 2.5 Flash, Claude Opus 4.7, and Claude Sonnet 4.6.

Requests were made through provider APIs in fresh sessions without conversation history. Web search and other retrieval tools were disabled. Temperature was set to 0.7 when supported, output was capped at 800 tokens, and every prompt requested no more than five ranked brands.

## Competitive sets

Competitive sets were defined independently of the experimental outputs using U.S. market availability. The final set has 212 brands: 37 boat-cruise brands, 58 cat-food brands, 56 coffee-maker brands, 20 cordless-drill brands, and 41 hiking-jacket brands.

`data/processed/competitive_set_review.csv` preserves the 276-brand review-stage table and its available notes. The averaged ratings cover 215 brands. `data/processed/competitive_set_exclusions.csv` records the three final exclusions that reduce that set to 212 brands. `data/processed/final_evaluation_set.csv` contains the final set used for the needs-based evaluation. The complete decision trail from 276 reviewed brands to 215 rated brands, including the underlying retailer and source URLs, was not preserved in the available archive.

## Category-only evaluation

There is one category-only prompt per category. Each was sent to all six models in 40 independent repetitions:

`5 categories × 6 models × 40 repetitions = 1,200 recommendation lists`

The prompts are in `config/category_only_prompts.csv`; the responses are in `data/raw/category-only/responses.jsonl`. `analysis/analyze-category-only.js` recomputes BRP@1, BRP@3, BRP@5, and brand-level MRR@5.

Raw ranked names are preserved. The alias file in `config/brand_aliases_initial.csv` maps name variants to canonical brands. Duplicates are collapsed to their highest-ranked occurrence. Invalid, out-of-category, ambiguous, and unverifiable entities are kept separate from valid brands.

## Needs-based evaluation

Three LLM raters (Gemini, ChatGPT, and Claude) scored brands on 16 original category attributes. The reported interval Krippendorff's alpha values range from .730 to .995 and are stored in `data/processed/inter_rater_reliability.csv`. The rendered calculation report is `docs/inter-rater-reliability.html`. Independent recomputation still requires the missing item-level rating workbook.

Correlations and factor analyses were used to combine related attributes and retain distinct ones. The full rendered analysis is in `docs/positiondims.html`. The eight final dimensions are:

- DIY to professional use for cordless drills
- mass-market to specialized and intimate for boat cruises
- everyday to technical use and low to high sustainability for hiking jackets
- mainstream to premium and general-purpose to veterinary-recommended for cat food
- low to high brewing involvement and drip to espresso orientation for coffee makers

The averaged original attributes are in `data/processed/brand_positioning_scores.csv`; the final dimension scores are in `data/processed/positioning_dimensions.csv`. `analysis/construct-positioning-dimensions.R` rebuilds the 212-brand final set and its composites after applying the final exclusions. For the cruise dimension, larger scores indicate smaller, more specialized ships; this is the same orientation used to compute NDCG@5.

Each dimension has two endpoints and three prompts per endpoint, for 48 prompts. Each prompt was sent to six models in 40 independent repetitions:

`48 prompts × 6 models × 40 repetitions = 11,520 recommendation lists`

The prompts are in `config/positioning_prompts.csv`, the endpoint mapping is in `config/composite_positioning_mapping.csv`, and the six response ledgers are in `data/raw/positioning/`.

## NDCG@5

Brand-positioning scores provide graded relevance. For each endpoint, scores are oriented so that larger values indicate a closer match. Missing ranks, duplicate canonical brands after their first occurrence, unresolved brands, and brands outside the final evaluation set receive zero relevance.

For ranks 1 through 5:

`DCG@5 = sum(relevance at rank r / log2(r + 1))`

The ideal DCG uses the five largest directional relevance scores among rated brands in the relevant category. NDCG@5 is `DCG@5 / IDCG@5`. `analysis/recompute-positioning-ndcg.js` recalculates all 11,520 observations and fails if a stored value differs by more than `1e-10`.

## Marketplace measures

The available files cover Vivvix advertising expenditure, LexisNexis news mentions, Google Trends search interest, Wikipedia pageviews, Brandwatch discussion, and Kantar BrandZ salience. Definitions and available collection details are in `data/marketplace/metric_metadata.csv`.

The paper's Tables 1 and 2 use 209 brands, standardized predictors, category controls, fractional logit lasso, 10-fold cross-validation, and both `lambda.min` and `lambda.1se`. The exact final 209-brand file and the final four-model script are not present. Files under `data/marketplace/` are retained as related source extracts, not as a substitute for the missing final analysis file.

## Live reruns

Reanalysis of the archive needs no credentials. Paid model reruns require provider keys in a local `.env` copied from `.env.example`.

- `analysis/run-live-smoke.js` makes one validation call per selected model.
- `analysis/run-experiment.js` runs the prompt ledger with resumable JSONL output.
- `analysis/run-google-batch.js` runs the Google models through the batch endpoint.

New responses are written under the ignored `data/runs/` directory.
