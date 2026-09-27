suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(readr)
  library(tidyr)
})

input <- "data/derived/positioning/ndcg_summary.csv"
output_dir <- "figures"
if (!file.exists(input)) stop("Run npm run analyze:positioning first.")
if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)

model_labels <- c(
  "claude-opus-4-7" = "Claude Opus",
  "claude-sonnet-4-6" = "Claude Sonnet",
  "gemini-2.5-flash" = "Gemini Flash",
  "gemini-3.1-pro-preview" = "Gemini Pro",
  "gpt-5.4-mini" = "GPT 5.4 Mini",
  "gpt-5.5" = "GPT 5.5"
)

panel_labels <- c(
  "User orientation" = "Drill: DIY-Professional",
  "Jacket tier" = "Jacket: Everyday-Technical",
  "Sustainability" = "Jacket: Sustainability",
  "Cruise positioning" = "Cruise: Mass-Specialized",
  "Barista involvement" = "Coffee: Low-high involvement",
  "Brew focus" = "Coffee: Drip-Espresso",
  "Cat food tier" = "Cat: Mainstream-Premium",
  "Veterinary to general" = "Cat: Vet focus-General"
)

dimension_order <- names(panel_labels)
data <- read_csv(input, show_col_types = FALSE) %>%
  mutate(
    model = recode(model, !!!model_labels),
    position_dimension = factor(position_dimension, levels = dimension_order),
    target_endpoint = factor(target_endpoint, levels = c("low", "high"))
  )

plot <- ggplot(data, aes(target_endpoint, mean_ndcg_at_5, group = model, color = model)) +
  geom_line(linewidth = 0.7) +
  geom_point(size = 1.5) +
  facet_wrap(~ position_dimension, ncol = 4, labeller = as_labeller(panel_labels)) +
  scale_y_continuous(limits = c(0, 1), breaks = seq(0, 1, 0.2)) +
  labs(x = "Target endpoint", y = "Mean NDCG@5", color = "LLM") +
  theme_bw(base_size = 10) +
  theme(legend.position = "bottom", panel.grid.minor = element_blank())

ggsave(file.path(output_dir, "positioning_ndcg.png"), plot, width = 10, height = 5.5, dpi = 300)
