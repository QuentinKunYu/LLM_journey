# Evaluating brand retrieval and ranking in open-ended LLM recommendations

Large language models generate brand alternatives rather than selecting them from a fixed candidate set. This repository contains the prompts, model outputs, brand-positioning measures, marketplace data, and analysis code used to study which brands enter these recommendation sets, how prominently they are ranked, and whether the rankings adapt to expressed consumer needs.

The study covers five categories and six LLMs. Every request was made in a fresh session without conversation history or web search.

## Evaluation design

### Category-only recommendations

One category-only prompt was submitted to each model in 40 independent repetitions for each of the five categories. The resulting dataset contains 1,200 ranked recommendation lists:

`5 categories × 6 models × 40 repetitions = 1,200 lists`

The analysis estimates brand recommendation prevalence at ranks 1, 3, and 5 and brand-level mean reciprocal rank at 5. The archived responses reproduce the category-only measures and the brand-level examples reported in the manuscript.

### Needs-based recommendations

The needs-based evaluation uses eight category-specific positioning dimensions. Each dimension has two endpoints, and each endpoint is represented by three natural-language prompts. Submitting the 48 prompts to all six models in 40 independent repetitions produced 11,520 recommendation lists:

`8 dimensions × 2 endpoints × 3 prompts × 6 models × 40 repetitions = 11,520 lists`

Brand-positioning scores were developed independently of the LLM recommendations and provide graded relevance judgments for NDCG@5. The repository includes the exact prompts, endpoint mappings, final averaged positioning scores, per-run rankings and relevance values, and the code used to recompute every stored NDCG value.

### Marketplace measures

The marketplace files contain measures of advertising expenditure, news coverage, Google search interest, Wikipedia pageviews, online discussion, and consumer brand salience. These data support inspection of the relationships between external brand prominence and LLM recommendation prominence. The exact analysis sample and script used for the manuscript's correlation and lasso tables still need to be frozen; the supplied merged file does not reproduce those tables as written.

## Reproduce the recommendation analyses

Node.js 20 or newer is required.

```bash
npm install
npm run analyze
npm run verify
npm test
```

These commands recompute the category-only brand measures, verify all 11,520 positioning NDCG values, check expected row and prompt counts, scan the artifact for identifying terms and credentials, and run the brand-resolution tests. Derived files are written to `data/derived/`; archived inputs are not modified.

The figures and marketplace summaries require R with `dplyr`, `ggplot2`, `ggrepel`, `readr`, and `tidyr`:

```bash
Rscript analysis/plot-category-only-results.R
Rscript analysis/plot-positioning-results.R
Rscript analysis/summarize-marketplace-results.R
```

The first two commands recreate the category-only and needs-based figures. The third recomputes descriptive correlations from the supplied marketplace file; it is not the final lasso analysis used in the manuscript.

## Repository contents

| Path | Contents |
| --- | --- |
| `config/` | Model definitions, exact prompts, endpoint mappings, alias rules, and protocol settings |
| `data/raw/category-only/` | The 1,200 archived category-only responses |
| `data/raw/positioning/` | Source ledgers for the 11,520 needs-based responses |
| `data/processed/` | Canonical recommendations, final evaluation set, positioning scores, reliability summary, and NDCG values |
| `data/marketplace/` | Marketplace measures, metadata, and supplied merged analysis files |
| `analysis/` | Metric recomputation, figure generation, experiment runners, and integrity checks |
| `docs/` | Protocol, data dictionary, and manuscript-to-artifact crosswalk |
| `provenance/` | Source manifest and the earlier 115-brand positioning analysis retained for comparison |
| `CHECKSUMS.sha256` | SHA-256 checksums for the versioned artifact files |

## Protocol and current limits

The complete implemented protocol is described in [`docs/protocol.md`](docs/protocol.md), and [`docs/manuscript_artifact_crosswalk.md`](docs/manuscript_artifact_crosswalk.md) maps the empirical sections of the manuscript to their supporting files and commands.

The recommendation experiments and both manuscript figures are reproducible from the included files. Three parts are not yet independently reproducible: the item-level three-rater positioning workbook, the factor-analysis record used to form the composite dimensions, and the exact 209-brand marketplace dataset and lasso script used for the reported regression tables. The category-level source log used to construct the competitive sets is also not included. These open items are recorded in [`REPRODUCIBILITY_STATUS.md`](REPRODUCIBILITY_STATUS.md).

Some marketplace measures were obtained from licensed commercial sources. Their redistribution terms should be checked before the repository is made public.

## Optional live reruns

Recomputing the archived results does not require API credentials. New model calls are optional and require provider keys in a local `.env` file copied from `.env.example`. New outputs are written under the ignored `data/runs/` directory so they cannot overwrite the archived study files.
