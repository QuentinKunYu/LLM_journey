suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
})

scores <- read_csv(
  "data/processed/brand_positioning_scores.csv",
  show_col_types = FALSE,
  na = c("", "NA")
)
exclusions <- read_csv(
  "data/processed/competitive_set_exclusions.csv",
  show_col_types = FALSE
)

final <- scores %>%
  filter(!Key %in% exclusions$key) %>%
  mutate(
    CruiseL_H = (
      VesselBig + (6 - Service) +
        (6 - Conventional_Expedition) + (6 - Family_AdultOnly)
    ) / 4,
    jacketL_H = (Technical + (6 - Urban) + Value) / 3,
    catfoodL_H = (Science_Natural + Trad_UltPrem) / 2,
    VetFocus = 6 - Vet_General,
    BaristaInvolve = (Auto_Manual + (6 - Convenience)) / 2
  ) %>%
  select(
    Key, Brand, Category, CruiseL_H, DrillDIY_pro, jacketL_H,
    Sustainability, catfoodL_H, VetFocus, BaristaInvolve,
    Drip_Espresso
  )

stopifnot(nrow(final) == 212L)
write_csv(final, "data/processed/positioning_dimensions.csv", na = "NA")
message("Wrote 212 rows to data/processed/positioning_dimensions.csv")
