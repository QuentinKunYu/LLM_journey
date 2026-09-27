# Reproducibility status

## Included and checked

- Exact five category-only prompts and 1,200 completed category-only responses.
- Exact 48 positioning prompts and source ledgers covering 11,520 completed responses.
- Six-model configuration and 40-replicate protocol.
- Final brand keys, final brand-positioning scores, composite dimension mapping, and per-run NDCG@5 values used for the current positioning figure.
- Initial alias dictionary, raw name-variant audit, duplicate audit, and out-of-set candidate audit.
- Marketplace measures and the earlier merged regression dataset.
- Source-file sizes and SHA-256 checksums.

## Must be resolved before public review

1. **Individual rater data are missing.** The repository contains averaged positioning scores and the reported Krippendorff's alpha values, but not the three raters' original item-level scores. Inter-rater reliability and the score-construction steps therefore cannot yet be independently recomputed.
2. **Category-only outcomes and the regression file use different runs.** The manuscript's examples match the 1,200-response category-only dataset in this repository. The marketplace regression file contains earlier BRP and MRR values. The manuscript must either retain and clearly label the earlier run or rebuild the regression dataset from the current category-only run and update its tables.
3. **The evaluation set changed after the first analysis.** The initial analysis used 115 rated brands and assigned zero relevance to other returned brands. The current positioning figure uses a later final evaluation set with additional rated brands. The manuscript must state when and how those brands were added, or the figure must be regenerated with the prespecified set.
4. **The NDCG gain rule changed.** The current positioning figure uses linear graded relevance. The earlier protocol used `2^relevance - 1`. The paper and supplement must state the rule used for the reported figure and, ideally, report a sensitivity check.
5. **The regression code does not yet reproduce the displayed table.** The retained R Markdown file fits ridge as the primary model and lasso as a robustness check, while the current manuscript describes and displays lasso with missingness indicators. A final script and exact analysis dataset are still needed.
6. **Competitive-set documentation is incomplete.** The final brand list is present, but the category-specific retailer/source evidence and inclusion/exclusion decision log described in the methods are not yet in the repository.
7. **The manuscript and final evaluation-set counts differ.** The processed final evaluation set contains 212 brands, while one manuscript passage refers to 209 brands. The manuscript count or the supplied set must be reconciled.
8. **The regularization label is internally inconsistent.** The methods discussion motivates and displays lasso results, but one results sentence calls the fitted model ridge. The final paper and script must use the same estimator name.
9. **The displayed correlation tables do not match the supplied merged CSV.** `analysis/summarize-marketplace-results.R` recomputes the descriptive correlations from the exact supplied dataset, but the resulting values differ from the manuscript tables. The dataset or table-generation code used for those displayed values is still needed.
10. **Dimensionality assessment is not yet documented.** The manuscript's evaluation process calls for assessing dimensionality, but no factor-analysis input, script, or output was found among the supplied materials.
11. **Redistribution rights must be checked.** Some marketplace variables come from licensed commercial sources. Confirm that row-level values may be shared in an anonymous public artifact; otherwise provide an access-controlled version or a derived-data alternative permitted by the source licenses.

This file is intentionally explicit so that unresolved methods decisions are not hidden by a polished repository layout.
