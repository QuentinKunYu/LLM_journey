# Reproducibility status

This audit uses the current full manuscript and the files in this repository.

## Complete

- Five category-only prompts, six models, 40 repetitions, and 1,200 completed recommendation lists.
- Category-only BRP@1, BRP@3, BRP@5, and brand-level MRR@5.
- Figure 1 and the reported category-only brand examples.
- The recovered competitive-set review table, three recorded last-stage exclusions, and the 212-brand needs-based evaluation set.
- Averaged positioning scores on 16 original attributes and the reported Krippendorff's alpha summary.
- The factor-analysis report, eight final positioning dimensions, and composite construction code.
- Forty-eight needs-based prompts and 11,520 completed recommendation lists.
- Exact recomputation of every stored NDCG@5 value.
- Figure 2 and the reported Craftsman, Skil, and Bauer examples.
- Integrity checks, anonymization checks, credential checks, and brand-resolution tests.

## Still missing

1. **Item-level ratings from the three raters.** The averaged scores, alpha values, and rendered reliability output are present. The workbook containing each rater's score for each brand and attribute is not. Krippendorff's alpha cannot be recomputed independently without it.
2. **The final 209-brand marketplace analysis file.** The paper reports `n = 209`, but no available file reproduces the exact Table 1 sample and correlations.
3. **The final marketplace model script.** The paper reports four fractional-logit lasso specifications for BRP@5 and MRR using `lambda.min` and `lambda.1se`, category controls, standardized predictors, and missingness indicators. The exact script that generated Table 2 is not present.
4. **Complete competitive-set provenance.** The review table contains the available notes, but the full decision trail from 276 reviewed brands to 215 rated brands is incomplete. The retailer and external-source URLs used to establish U.S. availability were not preserved.
5. **Commercial-data release clearance.** Vivvix, Brandwatch, Kantar BrandZ, and other marketplace measures may be subject to license restrictions.

## Manuscript check

Three statements in the methods section should be reconciled with the archive:

- The paper lists four cruise attributes, four hiking-jacket attributes, one drill attribute, three cat-food attributes, and three coffee-maker attributes. That totals 15. The archived scores, reliability summary, and factor-analysis report contain 16 attributes because coffee makers have four (`Auto_Manual`, `Convenience`, `Drip_Espresso`, and `BuildGrade`). The paper should either say four coffee-maker attributes or explain why `BuildGrade` is excluded from the stated count.
- The paper says category-only prompts required valid JSON. The archived prompts ask for up to five ranked brands but do not request JSON, and many archived responses are prose lists. The methods should describe the actual prompt and parsing procedure unless a missing system-level JSON instruction can be documented.
- The paper says temperature was fixed at 0.7. The archived Anthropic and Google tasks record 0.7, while the OpenAI tasks record no temperature override. The methods should say 0.7 where supported unless there is separate evidence that the OpenAI calls also used that setting.

The category-only and needs-based experiments are reproducible. Tables 1 and 2 remain incomplete until items 2 and 3 are recovered. The inter-rater reliability result remains only partially reproducible until item 1 is recovered.
