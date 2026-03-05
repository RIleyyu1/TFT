export const COST_TIERS = [1, 2, 3, 5, 7, 8, 10];
export const CO_OCCURRENCE_THRESHOLD = 5;
export const TRAIT_ASSOC_MIN_LIFT = 1.25;
export const TRAIT_ASSOC_MIN_CONDITIONAL = 0.22;
export const TRAIT_ASSOC_MIN_SUPPORT = 12;

export const TFT_DDRAGON_VERSION = "16.5.1";
export const TFT_DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${TFT_DDRAGON_VERSION}`;
export const TFT_CHAMPION_DATA_URL = `${TFT_DDRAGON_BASE}/data/en_US/tft-champion.json`;
export const TFT_ITEM_DATA_URL = `${TFT_DDRAGON_BASE}/data/en_US/tft-item.json`;
export const TFT_AUGMENT_DATA_URL = `${TFT_DDRAGON_BASE}/data/en_US/tft-augments.json`;

export const META_COMPS = [
  { id: "comp5", label: "Comp 5: Ambessa Carry", champs: ["Ambessa", "Swain", "Belveth", "Fiddlesticks", "Sion"], avgPlacement: 4.25, top4: 55.7, note: "Best performing shell in this sample." },
  { id: "comp4", label: "Comp 4: Void Monsters", champs: ["RiftHerald", "Chogath", "Swain", "Wukong", "Volibear"], avgPlacement: 4.28, top4: 54.7, note: "Heavy frontline and void core." },
  { id: "comp6", label: "Comp 6: Gunslinger/ADC", champs: ["Nautilus", "MissFortune", "Lucian", "Shyvana", "Kindred"], avgPlacement: 4.25, top4: 54.0, note: "Ranged carry-oriented composition." },
  { id: "comp1", label: "Comp 1: Soulbound", champs: ["Wukong", "Yunara", "Sett", "Shen", "Kindred"], avgPlacement: 4.41, top4: 51.9, note: "Trait commitment with stable top-4 rate." },
  { id: "comp3", label: "Comp 3: Sorcerers", champs: ["Loris", "Seraphine", "Braum", "Orianna", "Vi", "Azir"], avgPlacement: 4.57, top4: 48.4, note: "Below average outcomes in this snapshot." },
  { id: "comp7", label: "Comp 7: Flex/Transition", champs: ["Kennen", "Kobuko", "Wukong", "Volibear"], avgPlacement: 4.6, top4: 47.4, note: "Loose shell without a stable carry identity." },
  { id: "comp2", label: "Comp 2: Loose Swain", champs: ["Swain", "Vi", "Neeko"], avgPlacement: 4.77, top4: 44.9, note: "Most frequent pitfall: value pile without full synergy." }
];
