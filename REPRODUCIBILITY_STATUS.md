# Reproducibility status

This audit is based on the current anonymous manuscript and the versioned files in this repository.

## Included and verified

- The five category-only prompts, six-model configuration, 40-repetition protocol, and 1,200 completed category-only responses.
- BRP@1, BRP@3, BRP@5, and brand-level MRR@5 recomputed from the archived category-only responses.
- The manuscript examples for Craftsman, Black+Decker, Eddie Bauer, and L.L.Bean under category-only prompting.
- The 48 needs-based positioning prompts covering eight dimensions and both endpoints.
- Source ledgers for 11,520 completed needs-based responses.
- The final evaluation set, averaged brand-positioning scores, prompt-to-dimension mappings, and per-run NDCG@5 values.
- Exact recomputation of all 11,520 stored NDCG@5 values and the brand-level DIY examples for Craftsman, Skil, and Bauer.
- Code and data for both manuscript figures.
- Marketplace files, measure metadata, and code that recomputes descriptive correlations from the supplied merged file.
- Source-file sizes, SHA-256 checksums, anonymization checks, credential checks, and brand-resolution tests.

## Remaining gaps

1. **The exact marketplace analysis sample is missing.** The manuscript reports correlation and lasso models with `n = 209`, while the supplied merged marketplace file contains 100 rows. The supplied correlations also do not match the manuscript's Table 1.
2. **The final lasso analysis is not reproducible.** The retained notebook fits ridge as its primary model and lasso as a robustness check. It does not generate the four lasso specifications reported in Table 2, including the missingness indicators and both lambda rules.
3. **The item-level rater data are missing.** Averaged positioning scores and the 16 reported Krippendorff's alpha values are included, but the original three-rater workbook is not. The reliability coefficients and score-construction steps cannot yet be recomputed independently.
4. **The dimensionality analysis is not documented.** The manuscript reports correlations and factor analysis used to form composite positioning dimensions, but the inputs, script, decision rules, and output are not included.
5. **Competitive-set provenance is incomplete.** The final evaluation set is included, but the retailer/source evidence and category-specific inclusion and exclusion log described in the manuscript are not.
6. **The evaluation set changed during analysis.** An earlier needs-based analysis used 115 rated brands and an exponential gain rule. The current figure uses the expanded 212-brand evaluation set and linear gain. The repository preserves both versions, but the manuscript or supplement should state when and why these decisions changed.
7. **The category-only and marketplace outcomes come from different versions.** The category-only examples and Figure 1 use the current 1,200-response archive. The supplied legacy marketplace files retain recommendation outcomes from an earlier run. A final merged dataset should use one frozen outcome version throughout.
8. **Commercial-data redistribution requires review.** Advertising, BrandZ, Brandwatch, and some other marketplace values may be subject to license restrictions. Public release should follow the relevant source terms.
9. **The manuscript still contains placeholders.** The current PDF includes `[insert methods used in prior work]`, `Give example.`, and `[URL]`. These should be resolved after the final artifact and analysis version are frozen.

The recommendation experiments and their figures are reproducible. The marketplace tables and the construction of the positioning measures require the additional materials listed above.
