# Manuscript-to-artifact crosswalk

| Empirical component | Artifact evidence | Reproduction command | Status |
| --- | --- | --- | --- |
| Five categories and six models | `config/category_only_prompts.csv`, `config/models.json` | `npm run verify` | Complete |
| 40 independent category-only repetitions | `config/experiment_protocol.json`, `data/raw/category-only/responses.jsonl` | `npm run analyze:category` | Complete |
| 1,200 category-only recommendation lists | `data/raw/category-only/responses.jsonl` | `npm run verify` | Complete |
| BRP@1, BRP@3, BRP@5, and MRR@5 | `analysis/analyze-category-only.js` | `npm run analyze:category` | Complete |
| Eight positioning dimensions and 48 prompts | `config/positioning_prompts.csv`, `config/composite_positioning_mapping.csv` | `npm run verify` | Complete |
| 11,520 positioning recommendation lists | `data/raw/positioning/`, `data/processed/positioning_recommendations_and_ndcg.csv` | `npm run verify` | Complete |
| Final 212-brand evaluation set | `data/processed/final_evaluation_set.csv` | `npm run analyze:positioning` | Complete; manuscript count needs reconciliation |
| Averaged brand-positioning scores | `data/processed/brand_positioning_scores.csv` | `npm run analyze:positioning` | Final averages included; individual ratings absent |
| Linear-gain NDCG@5 | `config/experiment_protocol.json`, `analysis/recompute-positioning-ndcg.js` | `npm run analyze:positioning` | Complete for the current figure |
| Positioning-result figure | `analysis/plot-positioning-results.R` | `Rscript analysis/plot-positioning-results.R` | Complete |
| Marketplace predictors and source metadata | `data/marketplace/merged_marketplace_dataset.csv`, `data/marketplace/metric_metadata.csv` | `Rscript analysis/summarize-marketplace-results.R` | Descriptive tables reproducible; penalized model unresolved |
| Three-rater reliability and score construction | `data/processed/inter_rater_reliability.csv`, `analysis/recompute-inter-rater-reliability.R` | Requires the missing item-level workbook | Reported alpha values and exact code included; individual ratings absent |
| Competitive-set source and decision log | Final set only | Not available | Missing source evidence |

The unresolved rows are repeated in `REPRODUCIBILITY_STATUS.md`. They should be resolved before the repository is mirrored for anonymous public review.
