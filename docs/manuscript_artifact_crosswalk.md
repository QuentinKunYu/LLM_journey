# Manuscript-to-artifact crosswalk

| Paper component | Repository evidence | Reproduction | Status |
| --- | --- | --- | --- |
| Five categories and six models | `config/category_only_prompts.csv`, `config/models.json` | `npm run verify` | Complete |
| Forty category-only repetitions and 1,200 lists | `config/experiment_protocol.json`, `data/raw/category-only/responses.jsonl` | `npm run analyze:category` | Complete |
| BRP@1, BRP@3, BRP@5, and brand-level MRR@5 | `analysis/analyze-category-only.js` | `npm run analyze:category` | Complete |
| Figure 1 | `data/marketplace/brand_metrics_current.csv`, `analysis/plot-category-only-results.R` | `Rscript analysis/plot-category-only-results.R` | Complete |
| Competitive-set review and final 212 brands | `data/processed/competitive_set_review.csv`, `competitive_set_exclusions.csv`, `final_evaluation_set.csv` | `npm run verify` | Final set included; full 276-to-215 decision trail and source URLs absent |
| Sixteen original positioning attributes | `data/processed/brand_positioning_scores.csv` | Inspection | Averaged scores complete |
| Three-rater reliability | `data/processed/inter_rater_reliability.csv`, `docs/inter-rater-reliability.html`, `analysis/recompute-inter-rater-reliability.R` | Needs the missing item-level workbook | Summary complete; raw ratings missing |
| Correlations and factor analysis | `docs/positiondims.html` | Rendered report | Included |
| Eight final positioning dimensions | `data/processed/positioning_dimensions.csv`, `analysis/construct-positioning-dimensions.R` | `Rscript analysis/construct-positioning-dimensions.R` | Complete |
| Forty-eight needs-based prompts | `config/positioning_prompts.csv`, `config/composite_positioning_mapping.csv` | `npm run verify` | Complete |
| 11,520 needs-based lists | `data/raw/positioning/`, `data/processed/positioning_recommendations_and_ndcg.csv` | `npm run verify` | Complete |
| Linear-gain NDCG@5 | `analysis/recompute-positioning-ndcg.js` | `npm run analyze:positioning` | Complete |
| Figure 2 and the Craftsman, Skil, and Bauer examples | `data/processed/positioning_recommendations_and_ndcg.csv`, `analysis/plot-positioning-results.R` | `Rscript analysis/plot-positioning-results.R` | Complete |
| Marketplace measure definitions and source extracts | `data/marketplace/` | Inspection | Included where available |
| Table 1 correlations, 209 brands | Not present as the final analysis file | None | Missing |
| Table 2 fractional-logit lasso models | Not present as the final four-model script | None | Missing |

The two recommendation experiments and both figures can be reproduced from the repository. The remaining limits are recorded in `REPRODUCIBILITY_STATUS.md`.
