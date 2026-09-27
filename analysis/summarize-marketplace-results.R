suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyr)
})

input <- "data/marketplace/merged_marketplace_dataset.csv"
output_dir <- "data/derived/marketplace"
if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)

data <- read_csv(input, show_col_types = FALSE, na = c("", "NA"))
predictors <- c("logSearch", "lBrandwatch", "logAdSpend", "logNews", "logWiki")

category_correlations <- data %>%
  filter(!is.na(Category)) %>%
  group_by(Category) %>%
  summarise(
    across(
      all_of(predictors),
      ~ cor(MRR, .x, use = "pairwise.complete.obs"),
      .names = "cor_mrr_{.col}"
    ),
    .groups = "drop"
  )

correlation_variables <- c(
  "logAdSpend", "logNews", "lBrandwatch", "logWiki",
  "logSearch", "Salient", "BRP5", "MRR"
)
matrix <- cor(data[correlation_variables], use = "pairwise.complete.obs")
overall_correlations <- as.data.frame(as.table(matrix)) %>%
  rename(variable_1 = Var1, variable_2 = Var2, correlation = Freq)

write_csv(category_correlations, file.path(output_dir, "mrr_correlations_by_category.csv"))
write_csv(overall_correlations, file.path(output_dir, "pairwise_correlations.csv"))

message("Wrote descriptive correlations from the supplied merged marketplace dataset.")
