# Data dictionary

## Category-only responses

`data/raw/category-only/responses.jsonl` has one JSON object per prompt-model-replicate task. Important fields are `task_key`, `model_id`, `prompt_id`, `category`, `replicate`, `prompt`, `response_text`, and `brands`. Each item in `brands` preserves the original rank and extracted brand text and, when matched, the canonical brand and key.

## Positioning responses

The six files in `data/raw/positioning/` are the source ledgers for the 48 positioning prompts. The files separate direct API runs from Google batch runs and the two supplemental prompt groups. Together they contain 11,520 completed prompt-model-replicate tasks after selecting the latest completed task record.

## Positioning scores and NDCG

- `data/processed/brand_positioning_scores.csv`: averaged brand scores on the original category characteristics.
- `data/processed/inter_rater_reliability.csv`: reported Krippendorff's alpha values for the three-rater item-level coding. It preserves the available reliability output but does not replace the missing individual ratings.
- `data/processed/final_evaluation_set.csv`: brand keys retained in the final evaluation set.
- `config/composite_positioning_mapping.csv`: maps each prompt to an endpoint and a composite score.
- `data/processed/positioning_recommendations_and_ndcg.csv`: one row per run with five ranked brands, brand keys, relevance values, DCG, IDCG, and NDCG@5.

Low-endpoint relevance equals `6 - score`; high-endpoint relevance equals `score`. The current reported figure uses linear gain and discount `log2(rank + 1)`.

## Marketplace measures

`data/marketplace/metric_metadata.csv` defines the external measures. `merged_marketplace_dataset.csv` is the complete merged CSV supplied with the manuscript work. `brand_metrics_legacy.csv` is a reduced version used by the earlier analysis notebook. See `REPRODUCIBILITY_STATUS.md` before using either file as the source for a final regression table.
