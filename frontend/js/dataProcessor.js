import {
  CO_OCCURRENCE_THRESHOLD,
  TRAIT_ASSOC_MIN_LIFT,
  TRAIT_ASSOC_MIN_CONDITIONAL,
  TRAIT_ASSOC_MIN_SUPPORT
} from "./constants.js";
import {
  boardKey,
  pairKey,
  cleanChampionName,
  cleanTraitName,
  parseItems,
  dominantCost,
  mapStyleMapToArray,
  championCostFromCatalog
} from "./utils.js";

function mapRarityToCost(rarity) {
  const r = Number.isFinite(rarity) ? rarity : 0;
  return Math.max(1, r + 1);
}

export async function loadData() {
  const [matches, participants, units, traits, augments] = await Promise.all([
    d3.csv("./data/matches.csv"),
    d3.csv("./data/participants.csv", d => ({
      match_id: d.match_id,
      puuid: d.puuid,
      placement: +d.placement,
      level: +d.level,
      last_round: +d.last_round,
      total_damage_to_players: +d.total_damage_to_players
    })),
    d3.csv("./data/units.csv", d => {
      const champion = cleanChampionName(d.character_id);
      const cost =
        championCostFromCatalog(d.character_id) ||
        championCostFromCatalog(champion) ||
        mapRarityToCost(+d.rarity);

      return {
        match_id: d.match_id,
        puuid: d.puuid,
        champion,
        tier: +d.tier,
        rarity: +d.rarity,
        cost,
        items: parseItems(d.items)
      };
    }),
    d3.csv("./data/traits.csv", d => ({
      match_id: d.match_id,
      puuid: d.puuid,
      trait: cleanTraitName(d.name),
      style: +d.style,
      num_units: +d.num_units
    })),
    d3.csv("./data/augments.csv", d => ({
      match_id: d.match_id,
      puuid: d.puuid,
      augment: d.augment_name || d.augment || d.name || "",
      augment_order: +(d.augment_order || 0)
    }))
  ]);

  return { matches, participants, units, traits, augments };
}

export function buildModel({ matches, participants, units, traits, augments }) {
  const participantByBoard = new Map(participants.map(d => [boardKey(d.match_id, d.puuid), d]));

  const boardMap = new Map();
  const championItemCounts = new Map();
  const championCostCounts = new Map();

  units.forEach(u => {
    const key = boardKey(u.match_id, u.puuid);
    if (!boardMap.has(key)) {
      const p = participantByBoard.get(key);
      boardMap.set(key, {
        match_id: u.match_id,
        puuid: u.puuid,
        placement: p ? p.placement : NaN,
        champs: new Set(),
        units: [],
        traits: [],
        augments: []
      });
    }

    const board = boardMap.get(key);
    board.champs.add(u.champion);
    board.units.push(u);

    if (!championItemCounts.has(u.champion)) championItemCounts.set(u.champion, new Map());
    const itemMap = championItemCounts.get(u.champion);
    u.items.forEach(item => itemMap.set(item, (itemMap.get(item) || 0) + 1));

    if (!championCostCounts.has(u.champion)) championCostCounts.set(u.champion, new Map());
    const costMap = championCostCounts.get(u.champion);
    costMap.set(u.cost, (costMap.get(u.cost) || 0) + 1);
  });

  traits.forEach(t => {
    if (t.style <= 0) return;
    const key = boardKey(t.match_id, t.puuid);
    if (!boardMap.has(key)) return;
    boardMap.get(key).traits.push({ name: t.trait, style: t.style });
  });

  augments.forEach(a => {
    if (!a.augment) return;
    const key = boardKey(a.match_id, a.puuid);
    if (!boardMap.has(key)) return;
    boardMap.get(key).augments.push(a.augment);
  });

  const boards = Array.from(boardMap.values());
  const totalBoards = boards.length;

  const championBoardCount = new Map();
  const championPlacement = new Map();
  const championPlacementDist = new Map();
  const championAugmentCounts = new Map();

  boards.forEach(board => {
    board.champs.forEach(champ => {
      championBoardCount.set(champ, (championBoardCount.get(champ) || 0) + 1);
      if (!championPlacement.has(champ)) championPlacement.set(champ, { total: 0, count: 0, top4: 0 });
      if (!championPlacementDist.has(champ)) championPlacementDist.set(champ, Array(8).fill(0));

      const placement = board.placement;
      if (!Number.isNaN(placement)) {
        const stats = championPlacement.get(champ);
        stats.total += placement;
        stats.count += 1;
        if (placement <= 4) stats.top4 += 1;
        championPlacementDist.get(champ)[Math.max(0, Math.min(7, placement - 1))] += 1;
      }

      if (board.augments && board.augments.length) {
        if (!championAugmentCounts.has(champ)) championAugmentCounts.set(champ, new Map());
        const augmentMap = championAugmentCounts.get(champ);
        board.augments.forEach(aug => {
          augmentMap.set(aug, (augmentMap.get(aug) || 0) + 1);
        });
      }
    });
  });

  const championStats = Array.from(championBoardCount.entries()).map(([champion, count]) => {
    const placement = championPlacement.get(champion) || { total: 0, count: 0, top4: 0 };
    const itemMap = championItemCounts.get(champion) || new Map();
    const augmentMap = championAugmentCounts.get(champion) || new Map();

    const topItems = Array.from(itemMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item, c]) => ({ item, count: c }));

    const topAugments = Array.from(augmentMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([augment, c]) => ({ augment, count: c }));

    return {
      champion,
      pickCount: count,
      pickRate: (count / totalBoards) * 100,
      avgPlacement: placement.count ? placement.total / placement.count : NaN,
      top4Rate: placement.count ? (placement.top4 / placement.count) * 100 : 0,
      placementDist: championPlacementDist.get(champion) || Array(8).fill(0),
      cost: dominantCost(championCostCounts.get(champion)),
      topItems,
      topAugments
    };
  });

  const top30 = championStats.slice().sort((a, b) => b.pickCount - a.pickCount).slice(0, 30);
  const topChampSet = new Set(top30.map(d => d.champion));

  const pairCountGlobal = new Map();
  boards.forEach(board => {
    const arr = Array.from(board.champs).sort();
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        const key = pairKey(arr[i], arr[j]);
        pairCountGlobal.set(key, (pairCountGlobal.get(key) || 0) + 1);
      }
    }
  });

  const pairCountTop = new Map();
  boards.forEach(board => {
    const arr = Array.from(board.champs).filter(c => topChampSet.has(c)).sort();
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        const key = pairKey(arr[i], arr[j]);
        pairCountTop.set(key, (pairCountTop.get(key) || 0) + 1);
      }
    }
  });

  const nodes = top30.map(d => ({ ...d, id: d.champion }));
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const links = Array.from(pairCountTop.entries())
    .map(([key, count]) => {
      const [source, target] = key.split("|");
      const rate = (count / totalBoards) * 100;
      return { source, target, count, rate };
    })
    .filter(d => d.rate >= CO_OCCURRENCE_THRESHOLD)
    .filter(d => nodeById.has(d.source) && nodeById.has(d.target));

  const traitStyleGlobal = new Map();
  const traitBoardCount = new Map();
  const champTraitStyleRaw = new Map();
  const champTraitBoardCount = new Map();
  const champBoardCount = new Map();

  boards.forEach(board => {
    board.champs.forEach(champ => {
      champBoardCount.set(champ, (champBoardCount.get(champ) || 0) + 1);
    });

    board.traits.forEach(t => {
      const idx = Math.max(0, Math.min(3, t.style - 1));
      if (!traitStyleGlobal.has(t.name)) traitStyleGlobal.set(t.name, [0, 0, 0, 0]);
      traitStyleGlobal.get(t.name)[idx] += 1;
      traitBoardCount.set(t.name, (traitBoardCount.get(t.name) || 0) + 1);

      board.champs.forEach(champ => {
        if (!champTraitStyleRaw.has(champ)) champTraitStyleRaw.set(champ, new Map());
        if (!champTraitBoardCount.has(champ)) champTraitBoardCount.set(champ, new Map());
        const styleMap = champTraitStyleRaw.get(champ);
        const boardCountMap = champTraitBoardCount.get(champ);
        if (!styleMap.has(t.name)) styleMap.set(t.name, [0, 0, 0, 0]);
        styleMap.get(t.name)[idx] += 1;
        boardCountMap.set(t.name, (boardCountMap.get(t.name) || 0) + 1);
      });
    });
  });

  const championTraitStyle = new Map();
  Array.from(champTraitStyleRaw.entries()).forEach(([champ, traitMap]) => {
    const champBoards = champBoardCount.get(champ) || 0;
    if (!champBoards) return;

    traitMap.forEach((styles, traitName) => {
      const pairBoards = (champTraitBoardCount.get(champ)?.get(traitName)) || 0;
      const traitBoards = traitBoardCount.get(traitName) || 0;
      if (!pairBoards || !traitBoards) return;

      const conditionalRate = pairBoards / champBoards;
      const globalRate = traitBoards / totalBoards;
      const lift = globalRate > 0 ? conditionalRate / globalRate : 0;

      if (
        pairBoards >= TRAIT_ASSOC_MIN_SUPPORT &&
        conditionalRate >= TRAIT_ASSOC_MIN_CONDITIONAL &&
        lift >= TRAIT_ASSOC_MIN_LIFT
      ) {
        if (!championTraitStyle.has(champ)) championTraitStyle.set(champ, new Map());
        championTraitStyle.get(champ).set(traitName, styles);
      }
    });
  });

  const traitGlobal = mapStyleMapToArray(traitStyleGlobal)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const availableCosts = Array.from(new Set(nodes.map(d => d.cost))).sort((a, b) => a - b);

  return {
    matches,
    boards,
    totalBoards,
    nodes,
    links,
    availableCosts,
    championById: new Map(nodes.map(d => [d.id, d])),
    pairCountGlobal,
    championTraitStyle,
    traitGlobal
  };
}
