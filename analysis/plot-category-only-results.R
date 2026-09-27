suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(readr)
})

input <- "data/marketplace/brand_metrics_current.csv"
output_dir <- "figures"
if (!file.exists(input)) stop("Run npm run analyze:category first.")
if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)

data <- read_csv(input, show_col_types = FALSE, na = c("", "NA")) %>%
  filter(!is.na(Category), Category != "NA", !is.na(GoogleBrandCat)) %>%
  mutate(
    log_search = log(GoogleBrandCat + 1),
    salience_available = if_else(is.na(Salient), "Not measured", "Measured")
  )

plot <- ggplot(data, aes(log_search, BRP5)) +
  geom_point(aes(shape = salience_available), size = 2.2, alpha = 0.8) +
  geom_text(aes(label = BrandShort), size = 2.1, check_overlap = TRUE, vjust = -0.6) +
  facet_wrap(~ Category, scales = "free_x") +
  scale_shape_manual(values = c("Measured" = 16, "Not measured" = 4)) +
  scale_x_continuous(expand = expansion(mult = c(0.12, 0.12))) +
  scale_y_continuous(limits = c(0, 1), breaks = seq(0, 1, 0.2)) +
  labs(
    x = "log(Google Trends search interest + 1)",
    y = "BRP@5",
    shape = "Brand salience"
  ) +
  coord_cartesian(clip = "off") +
  theme_bw(base_size = 10) +
  theme(
    legend.position = "bottom",
    panel.grid.minor = element_blank(),
    plot.margin = margin(12, 24, 12, 24)
  )

ggsave(file.path(output_dir, "category_only_search_vs_brp5.png"), plot, width = 10, height = 6, dpi = 300)
