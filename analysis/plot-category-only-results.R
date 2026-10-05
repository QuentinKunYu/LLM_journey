suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(ggrepel)
  library(readxl)
  library(stringr)
  library(tidyr)
})

recommendations <- read_excel("data/processed/Category_Only_Recommendations.xlsx")
brands <- read.csv("data/marketplace/all_new_googletrends_wikipedia.csv") %>%
  select(Key, Category, Brand, BrandShort, logSearch)

denominators <- recommendations %>%
  count(category, name = "n_lists") %>%
  rename(Category = category)

ranked <- recommendations %>%
  mutate(list_id = row_number()) %>%
  pivot_longer(
    cols = brand_key_1:brand_key_5,
    names_to = "rankvar",
    values_to = "Key"
  ) %>%
  mutate(
    rank = as.integer(str_extract(rankvar, "\\d+$")),
    Key = na_if(trimws(Key), "")
  ) %>%
  filter(!is.na(Key)) %>%
  arrange(list_id, rank) %>%
  distinct(list_id, Key, .keep_all = TRUE)

brand_stats <- ranked %>%
  group_by(Key) %>%
  summarise(n_rec = n(), rr_sum = sum(1 / rank), .groups = "drop")

catmetrics <- brands %>%
  left_join(brand_stats, by = "Key") %>%
  left_join(denominators, by = "Category") %>%
  mutate(
    n_rec = coalesce(n_rec, 0L),
    rr_sum = coalesce(rr_sum, 0),
    BRP5 = n_rec / n_lists,
    MRR = rr_sum / n_lists
  )

label_brands <- c(
  "Dewalt", "Milwaukee", "Makita", "Bosch", "Ryobi", "Black+Decker", "Craftsman",
  "Skil", "Flex", "Ridgid", "Royal Caribbean", "Carnival", "Viking", "NCL",
  "Princess", "Celebrity", "MSC", "Holland America", "Disney", "Silversea",
  "Windstar", "Patagonia", "Arc'teryx", "North Face", "Columbia", "Marmot",
  "Outdoor Research", "Black Diamond", "Mammut", "Rab", "Eddie Bauer",
  "L.L.Bean", "REI", "Merrell", "Salomon", "Breville", "Keurig", "Cuisinart",
  "Nespresso", "Ninja", "Technivorm", "DeLonghi", "Mr. Coffee", "Hamilton Beach",
  "OXO", "Bonavita", "KitchenAid", "Purina", "Royal Canin", "Hill's",
  "Blue Buffalo", "IAMS", "Wellness", "Fancy Feast", "Friskies", "Orijen",
  "Purina Pro Plan", "9 Lives"
)

plot <- catmetrics %>%
  ggplot(aes(logSearch, y = BRP5)) +
  geom_point() +
  geom_text_repel(
    data = subset(catmetrics, BrandShort %in% label_brands),
    aes(label = BrandShort), size = 1.7, max.overlaps = Inf, na.rm = TRUE
  ) +
  facet_wrap(~ Category) +
  labs(x = "log(Search)", y = "Brand recommendation probability (BRP@5)") +
  theme(strip.text = element_text(size = 8)) +
  theme(axis.title.y = element_text(size = 8), axis.title.x = element_text(size = 8))

if (!dir.exists("figures")) dir.create("figures", recursive = TRUE)
ggsave("figures/category_only_search_vs_brp5.png", plot, width = 10, height = 6, dpi = 300)
