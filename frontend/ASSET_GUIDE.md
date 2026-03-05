# TFT Avatar / Icon Sources

Project is now pinned to Data Dragon version `16.5.1`.

## Data endpoints
- Champions: `https://ddragon.leagueoflegends.com/cdn/16.5.1/data/en_US/tft-champion.json`
- Items: `https://ddragon.leagueoflegends.com/cdn/16.5.1/data/en_US/tft-item.json`
- Augments: `https://ddragon.leagueoflegends.com/cdn/16.5.1/data/en_US/tft-augments.json`

This avoids broken URLs from guessing filenames.

## In-project helper functions
See `frontend/js/utils.js`:
- `initAssetCatalog()`
- `champIconUrl(champion)`
- `itemIconUrl(itemId)`
- `augmentIconCandidates(augmentId)`
