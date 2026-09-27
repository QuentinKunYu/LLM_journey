suppressPackageStartupMessages({
  library(irr)
  library(readr)
  library(readxl)
})

input <- Sys.getenv("RATING_WORKBOOK", "data/source/brand_positioning_ratings.xlsx")
output <- "data/processed/inter_rater_reliability.csv"
if (!file.exists(input)) {
  stop(
    paste0(
      "The item-level three-rater workbook is not included. ",
      "Set RATING_WORKBOOK to its path after adding the source file."
    )
  )
}

specs <- list(
  list("Cat Food", "Vet - Commercial", "Vet_General"),
  list("Cat Food", "Science - Natural", "Science_Natural"),
  list("Cat Food", "Traditional - Ultra Premium", "Trad_UltPrem"),
  list("Coffee Maker", "Auto - Manual", "Auto_Manual"),
  list("Coffee Maker", "Convenience - Ritual", "Convenience"),
  list("Coffee Maker", "Brew Style: Drip - Espresso", "Drip_Espresso"),
  list("Coffee Maker", "Build", "BuildGrade"),
  list("Hiking Jackets", "Technical", "Technical"),
  list("Hiking Jackets", "Urban", "Urban"),
  list("Hiking Jackets", "Value", "Value"),
  list("Hiking Jackets", "Sustainability", "Sustainability"),
  list("Cruises", "Vessel Size", "VesselBig"),
  list("Cruises", "Service", "Service"),
  list("Cruises", "Conventional - Expedition", "Conventional_Expedition"),
  list("Cruises", "Family - Adult Only", "Family_AdultOnly"),
  list("Drills", "DIY - Prosumer - Pro", "DrillDIY_pro")
)

category_names <- c(
  "Hiking Jackets" = "Hiking Jacket",
  "Cruises" = "Boat Cruise",
  "Drills" = "Cordless Drill"
)

results <- lapply(specs, function(spec) {
  sheet <- spec[[1]]
  dimension <- spec[[2]]
  field <- spec[[3]]
  data <- read_excel(input, sheet = sheet)
  columns <- c(
    paste0("Gemini: ", field),
    paste0("ChatGPT: ", field),
    paste0("Claude: ", field)
  )
  if (sheet == "Hiking Jackets" && field == "Urban" && !columns[[3]] %in% names(data)) {
    columns[[3]] <- "Claude:Urban"
  }
  if (!all(columns %in% names(data))) {
    stop(paste("Missing rating columns for", sheet, dimension))
  }
  alpha <- kripp.alpha(t(data[columns]), method = "interval")
  data.frame(
    category = if (sheet %in% names(category_names)) category_names[[sheet]] else sheet,
    dimension = dimension,
    subjects = nrow(data),
    raters = length(columns),
    krippendorff_alpha = unname(alpha$value)
  )
})

write_csv(do.call(rbind, results), output)
message("Wrote ", output)
