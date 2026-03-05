import {
  TFT_DDRAGON_BASE,
  TFT_CHAMPION_DATA_URL,
  TFT_ITEM_DATA_URL,
  TFT_AUGMENT_DATA_URL
} from "./constants.js";

let championIconMap = new Map();
let itemIconMap = new Map();
let augmentIconMap = new Map();
let itemNameMap = new Map();
let augmentNameMap = new Map();
let championCostMap = new Map();

export async function initAssetCatalog() {
  const [champData, itemData, augmentData] = await Promise.all([
    fetch(TFT_CHAMPION_DATA_URL).then(r => r.json()),
    fetch(TFT_ITEM_DATA_URL).then(r => r.json()),
    fetch(TFT_AUGMENT_DATA_URL).then(r => r.json()).catch(() => ({ data: {} }))
  ]);

  championIconMap = buildIconMap(champData?.data || {});
  itemIconMap = buildIconMap(itemData?.data || {});
  augmentIconMap = buildIconMap(augmentData?.data || {});

  itemNameMap = buildNameMap(itemData?.data || {});
  augmentNameMap = buildNameMap(augmentData?.data || {});
  championCostMap = buildChampionCostMap(champData?.data || {});
}

function buildIconMap(dataSection) {
  const map = new Map();
  Object.entries(dataSection).forEach(([key, val]) => {
    const id = val?.id || key;
    const image = val?.image || {};
    const group = image.group;
    const full = image.full;
    if (!group || !full) return;

    const url = `${TFT_DDRAGON_BASE}/img/${group}/${full}`;
    const cleanId = String(id).replace(/^TFT16_/, "").replace(/^TFT_/, "");

    [key, id, cleanId].forEach(alias => {
      if (!alias) return;
      map.set(String(alias), url);
      map.set(String(alias).toLowerCase(), url);
    });
  });
  return map;
}

function buildNameMap(dataSection) {
  const map = new Map();
  Object.entries(dataSection).forEach(([key, val]) => {
    const id = val?.id || key;
    const name = val?.name || key;
    const cleanId = String(id).replace(/^TFT16_/, "").replace(/^TFT_/, "");
    [key, id, cleanId].forEach(alias => {
      if (!alias) return;
      map.set(String(alias), name);
      map.set(String(alias).toLowerCase(), name);
    });
  });
  return map;
}

function buildChampionCostMap(dataSection) {
  const map = new Map();
  Object.entries(dataSection).forEach(([key, val]) => {
    const id = val?.id || key;
    const cleanId = String(id).replace(/^TFT16_/, "").replace(/^TFT_/, "");

    let cost = Number(val?.cost);
    if (!Number.isFinite(cost)) cost = Number(val?.tier);
    if (!Number.isFinite(cost) || cost <= 0) return;

    [key, id, cleanId].forEach(alias => {
      if (!alias) return;
      map.set(String(alias), cost);
      map.set(String(alias).toLowerCase(), cost);
    });
  });
  return map;
}

export function championCostFromCatalog(idOrName) {
  if (!idOrName) return null;
  return championCostMap.get(String(idOrName)) || championCostMap.get(String(idOrName).toLowerCase()) || null;
}

export function boardKey(matchId, puuid) {
  return `${matchId}|${puuid}`;
}

export function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function cleanChampionName(raw) {
  return (raw || "")
    .replace(/^TFT16_/, "")
    .replace(/^TFT_/, "")
    .replace(/[^A-Za-z0-9]/g, "");
}

export function cleanTraitName(raw) {
  return (raw || "").replace(/^TFT16_/, "").replace(/^TFT_/, "");
}

export function cleanItemName(raw) {
  return (raw || "")
    .replace(/^TFT16_Item_/, "")
    .replace(/^TFT_Item_/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

export function cleanAugmentName(raw) {
  return (raw || "")
    .replace(/^TFT16_Augment_/, "")
    .replace(/^TFT_Augment_/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
}

export function parseItems(raw) {
  if (!raw || raw === "[]") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function dominantCost(map) {
  if (!map || map.size === 0) return 1;
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

export function mapStyleMapToArray(styleMap) {
  return Array.from(styleMap.entries()).map(([key, styles]) => ({
    key,
    styles,
    total: styles.reduce((a, b) => a + b, 0)
  }));
}

export function champIconUrl(champion) {
  const hit = championIconMap.get(champion) || championIconMap.get(String(champion).toLowerCase());
  if (hit) return hit;
  return `${TFT_DDRAGON_BASE}/img/tft-champion/TFT16_${champion}.png`;
}

export function itemIconUrl(itemId) {
  const hit = itemIconMap.get(itemId) || itemIconMap.get(String(itemId).toLowerCase());
  if (hit) return hit;
  return `${TFT_DDRAGON_BASE}/img/tft-item/${itemId}.png`;
}

export function itemDisplayName(itemId) {
  return itemNameMap.get(itemId) || itemNameMap.get(String(itemId).toLowerCase()) || cleanItemName(itemId);
}

export function augmentIconCandidates(augmentId) {
  const id = String(augmentId || "");
  const lower = id.toLowerCase();
  const hit = augmentIconMap.get(id) || augmentIconMap.get(lower);
  if (hit) return [hit];
  return [
    `${TFT_DDRAGON_BASE}/img/tft-item/${id}.png`,
    `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/tft/augments/icons/${lower}.png`
  ];
}

export function augmentDisplayName(augmentId) {
  return augmentNameMap.get(augmentId) || augmentNameMap.get(String(augmentId).toLowerCase()) || cleanAugmentName(augmentId);
}

export function fmtPct(v) {
  return `${d3.format(".1f")(v)}%`;
}

export function fmtFloat(v) {
  return d3.format(".2f")(v);
}

export function showTooltip(ev, html) {
  const tooltip = document.getElementById("tooltip");
  tooltip.innerHTML = html;
  tooltip.classList.add("visible");
  moveTooltip(ev);
}

export function moveTooltip(ev) {
  const tooltip = document.getElementById("tooltip");
  tooltip.style.left = `${ev.clientX + 14}px`;
  tooltip.style.top = `${ev.clientY + 14}px`;
}

export function hideTooltip() {
  document.getElementById("tooltip").classList.remove("visible");
}
