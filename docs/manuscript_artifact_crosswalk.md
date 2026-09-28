# Manuscript-to-artifact crosswalk

| Manuscript component | Artifact evidence | Reproduction command | Status |
| --- | --- | --- | --- |
| Five categories and six models | `config/category_only_prompts.csv`, `config/models.json` | `npm run verify` | Complete |
| Forty independent category-only repetitions | `config/experiment_protocol.json`, `data/raw/category-only/responses.jsonl` | `npm run analyze:category` | Complete |
| 1,200 category-only recommendation lists | `data/raw/category-only/responses.jsonl` | `npm run verify` | Complete |
| BRP@1, BRP@3, BRP@5, and brand-level MRR@5 | `analysis/analyze-category-only.js` | `npm run analyze:category` | Complete |
| Figure 1 and category-only brand examples | `data/marketplace/brand_metrics_current.csv`, `analysis/plot-category-only-results.R` | `Rscript analysis/plot-category-only-results.R` | Complete |
| Eight positioning dimensions and 48 prompts | `config/positioning_prompts.csv`, `config/composite_positioning_mapping.csv` | `npm run verify` | Complete |
| 11,520 needs-based recommendation lists | `data/raw/positioning/`, `data/processed/positioning_recommendations_and_ndcg.csv` | `npm run verify` | Complete |
| Final 212-brand evaluation set | `data/processed/final_evaluation_set.csv` | `npm run analyze:positioning` | Complete for the current analysis |
| Averaged brand-positioning scores | `data/processed/brand_positioning_scores.csv` | `npm run analyze:positioning` | Final averages included; item-level ratings absent |
| Reported inter-rater reliability | `data/processed/inter_rater_reliability.csv`, `analysis/recompute-inter-rater-reliability.R` | Requires the missing item-level workbook | Summary included; independent recomputation unavailable |
| Correlations and factor analysis used to form composites | No complete input, script, or output | Not available | Missing |
| Linear-gain NDCG@5 | `config/experiment_protocol.json`, `analysis/recompute-positioning-ndcg.js` | `npm run analyze:positioning` | Complete for the current figure |
| Figure 2 and the Craftsman, Skil, and Bauer examples | `data/processed/positioning_recommendations_and_ndcg.csv`, `analysis/plot-positioning-results.R` | `Rscript analysis/plot-positioning-results.R` | Complete |
| Marketplace measure definitions | `data/marketplace/metric_metadata.csv` | Manual inspection | Included, with some collection details incomplete |
| Table 1 marketplace correlations | `data/marketplace/merged_marketplace_dataset.csv`, `analysis/summarize-marketplace-results.R` | `Rscript analysis/summarize-marketplace-results.R` | Supplied file does not reproduce the manuscript table |
| Table 2 four lasso models, both lambda rules, and `n = 209` | Earlier files under `data/marketplace/` and `provenance/marketplace_analysis_legacy.Rmd` | No exact command available | Exact sample and final script missing |
| Competitive-set source and decision log | `data/processed/final_evaluation_set.csv` | Not available | Final set included; source evidence missing |

See `REPRODUCIBILITY_STATUS.md` for the remaining decisions and materials needed before anonymous public release.
