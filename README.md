# Open-ended brand recommendation evaluation

This repository contains the prompts, model outputs, brand-positioning scores, marketplace measures, and analysis code used to evaluate open-ended brand recommendations from six LLMs across five product and service categories.

The artifact has two experiments:

1. **Category-only recommendations.** Five prompts were each submitted to six models in 40 independent stateless sessions, producing 1,200 ranked recommendation lists.
2. **Positioning-based recommendations.** Forty-eight prompts represent the two endpoints of eight category-specific positioning dimensions. Each prompt was submitted to six models in 40 independent stateless sessions, producing 11,520 ranked recommendation lists.

## Reproduce the reported measures

Requires Node.js 20 or newer.

```bash
npm install
npm run analyze
npm run verify
npm test
```

The analysis writes derived CSV files under `data/derived/`. Existing raw and processed inputs are not modified.

To recreate the positioning figure after running the analysis, install R with `ggplot2`, `dplyr`, `readr`, and `tidyr`, then run:

```bash
Rscript analysis/plot-positioning-results.R
Rscript analysis/plot-category-only-results.R
Rscript analysis/summarize-marketplace-results.R
```

The commands above reproduce the category-only brand-level measures, verify every stored positioning NDCG value, and recreate `figures/positioning_ndcg.png`. They do not make paid API calls. Live reruns are optional and require provider credentials in a local `.env` file.

## Repository map

| Path | Contents |
| --- | --- |
| `config/` | Model list, exact prompts, endpoint mappings, initial alias dictionary, and protocol settings |
| `data/raw/category-only/` | 1,200 category-only model responses |
| `data/raw/positioning/` | Source response ledgers for the 11,520 positioning runs |
| `data/processed/` | Final evaluation set, positioning scores, canonical recommendation rows, and NDCG values |
| `data/marketplace/` | Marketplace measures and the earlier merged analysis file |
| `analysis/` | Experiment runners, metric recomputation, figure generation, and artifact checks |
| `provenance/` | Checksums and the earlier 115-brand scoring analysis retained for comparison |

The exact protocol is documented in `docs/protocol.md`; `docs/manuscript_artifact_crosswalk.md` maps each empirical claim to its supporting file.

## Important version note

The current positioning figure uses the final evaluation set and composite positioning dimensions in `data/processed/`. An earlier analysis treated brands outside the initial 115-brand set as zero relevance and used a different gain function. That earlier output is retained under `provenance/initial_115_brand_analysis/`; it is not the source of the current positioning figure.

See `REPRODUCIBILITY_STATUS.md` for the remaining manuscript-to-artifact issues that must be resolved before making this repository the anonymous review artifact.
