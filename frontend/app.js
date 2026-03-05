const COST_TIERS = [1, 2, 3, 5, 7, 8, 10];
const CO_OCCURRENCE_THRESHOLD = 5;
const TRAIT_ASSOC_MIN_LIFT = 1.25;
const TRAIT_ASSOC_MIN_CONDITIONAL = 0.22;
const TRAIT_ASSOC_MIN_SUPPORT = 12;

const META_COMPS = [
  {
    id: "comp5",
    label: "Comp 5: Ambessa Carry",
    champs: ["Ambessa", "Swain", "Belveth", "Fiddlesticks", "Sion"],
    avgPlacement: 4.25,
    top4: 55.7,
    note: "Best performing shell in this sample."
  },
  {
    id: "comp4",
    label: "Comp 4: Void Monsters",
    champs: ["RiftHerald", "Chogath", "Swain", "Wukong", "Volibear"],
    avgPlacement: 4.28,
    top4: 54.7,
    note: "Heavy frontline and void core."
  },
  {
    id: "comp6",
    label: "Comp 6: Gunslinger/ADC",
    champs: ["Nautilus", "MissFortune", "Lucian", "Shyvana", "Kindred"],
    avgPlacement: 4.25,
    top4: 54.0,
    note: "Ranged carry-oriented composition."
  },
  {
    id: "comp1",
    label: "Comp 1: Soulbound",
    champs: ["Wukong", "Yunara", "Sett", "Shen", "Kindred"],
    avgPlacement: 4.41,
    top4: 51.9,
    note: "Trait commitment with stable top-4 rate."
  },
  {
    id: "comp3",
    label: "Comp 3: Sorcerers",
    champs: ["Loris", "Seraphine", "Braum", "Orianna", "Vi", "Azir"],
    avgPlacement: 4.57,
    top4: 48.4,
    note: "Below average outcomes in this snapshot."
  },
  {
    id: "comp7",
    label: "Comp 7: Flex/Transition",
    champs: ["Kennen", "Kobuko", "Wukong", "Volibear"],
    avgPlacement: 4.6,
    top4: 47.4,
    note: "Loose shell without a stable carry identity."
  },
  {
    id: "comp2",
    label: "Comp 2: Loose Swain",
    champs: ["Swain", "Vi", "Neeko"],
    avgPlacement: 4.77,
    top4: 44.9,
    note: "Most frequent pitfall: value pile without full synergy."
  }
];

const state = {
  selectedChampion: null,
  selectedComp: "all",
  activeCosts: new Set(COST_TIERS),
  data: null,
  network: null,
  traitChart: null
};

init();

async function init() {
  try {
    const [matches, participants, units, traits] = await Promise.all([
      d3.csv("./data/matches.csv"),
      d3.csv("./data/participants.csv", d => ({
        match_id: d.match_id,
        puuid: d.puuid,
        placement: +d.placement,
        level: +d.level,
        last_round: +d.last_round,
        total_damage_to_players: +d.total_damage_to_players
      })),
      d3.csv("./data/units.csv", d => ({
        match_id: d.match_id,
        puuid: d.puuid,
        champion: cleanChampionName(d.character_id),
        tier: +d.tier,
        rarity: +d.rarity,
        cost: (+d.rarity || 0) + 1,
        items: parseItems(d.items)
      })),
      d3.csv("./data/traits.csv", d => ({
        match_id: d.match_id,
        puuid: d.puuid,
        trait: cleanTraitName(d.name),
        style: +d.style,
        num_units: +d.num_units
      }))
    ]);

    state.data = buildModel({ matches, participants, units, traits });
    buildControls();
    buildNetwork();
    buildTraitChart();
    renderDetailPanel();
    wireActions();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<p style="padding:24px;color:#fff">Failed to load data. Run this from a local server (for example: <code>python -m http.server</code>) and open <code>frontend/index.html</code>.</p>`;
  }
}

function buildModel({ matches, participants, units, traits }) {
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
        championCosts: new Map(),
        units: [],
        traits: []
      });
    }

    const board = boardMap.get(key);
    board.champs.add(u.champion);
    board.units.push(u);

    if (!board.championCosts.has(u.champion)) {
      board.championCosts.set(u.champion, u.cost);
    }

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

  const boards = Array.from(boardMap.values());
  const totalBoards = boards.length;

  const championBoardCount = new Map();
  const championPlacement = new Map();
  const championPlacementDist = new Map();

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
    });
  });

  const championStats = Array.from(championBoardCount.entries()).map(([champion, count]) => {
    const placement = championPlacement.get(champion) || { total: 0, count: 0, top4: 0 };
    const itemMap = championItemCounts.get(champion) || new Map();
    const topItems = Array.from(itemMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item, c]) => ({ item, count: c }));

    const cost = dominantCost(championCostCounts.get(champion));

    return {
      champion,
      pickCount: count,
      pickRate: (count / totalBoards) * 100,
      avgPlacement: placement.count ? placement.total / placement.count : NaN,
      top4Rate: placement.count ? (placement.top4 / placement.count) * 100 : 0,
      placementDist: championPlacementDist.get(champion) || Array(8).fill(0),
      cost,
      topItems
    };
  });

  const top30 = championStats
    .slice()
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 30);

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
      const styleIdx = Math.max(0, Math.min(3, t.style - 1));
      if (!traitStyleGlobal.has(t.name)) traitStyleGlobal.set(t.name, [0, 0, 0, 0]);
      traitStyleGlobal.get(t.name)[styleIdx] += 1;
      traitBoardCount.set(t.name, (traitBoardCount.get(t.name) || 0) + 1);

      board.champs.forEach(champ => {
        if (!champTraitStyleRaw.has(champ)) champTraitStyleRaw.set(champ, new Map());
        if (!champTraitBoardCount.has(champ)) champTraitBoardCount.set(champ, new Map());

        const styleMap = champTraitStyleRaw.get(champ);
        const boardCountMap = champTraitBoardCount.get(champ);
        if (!styleMap.has(t.name)) styleMap.set(t.name, [0, 0, 0, 0]);

        styleMap.get(t.name)[styleIdx] += 1;
        boardCountMap.set(t.name, (boardCountMap.get(t.name) || 0) + 1);
      });
    });
  });

  // Keep only champion-trait links that are meaningfully associated with the champion.
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

  const championById = new Map(nodes.map(d => [d.id, d]));

  return {
    matches,
    boards,
    totalBoards,
    nodes,
    links,
    championById,
    pairCountGlobal,
    championTraitStyle,
    traitGlobal
  };
}

function buildControls() {
  const wrap = document.getElementById("cost-filters");
  wrap.innerHTML = "";

  COST_TIERS.forEach(cost => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip active";
    btn.textContent = `${cost}-cost`;
    btn.dataset.cost = String(cost);
    btn.addEventListener("click", () => {
      if (state.activeCosts.has(cost)) {
        state.activeCosts.delete(cost);
      } else {
        state.activeCosts.add(cost);
      }
      btn.classList.toggle("active", state.activeCosts.has(cost));
      updateLinkedViews();
    });
    wrap.appendChild(btn);
  });

  const select = document.getElementById("comp-select");
  const options = [{ id: "all", label: "No composition highlight" }, ...META_COMPS];
  options.forEach(opt => {
    const el = document.createElement("option");
    el.value = opt.id;
    el.textContent = opt.label;
    select.appendChild(el);
  });

  select.addEventListener("change", () => {
    state.selectedComp = select.value;
    writeCompDescription();
    updateLinkedViews();
  });

  writeCompDescription();
}

function buildNetwork() {
  const container = document.getElementById("network-view");
  const w = container.clientWidth || 900;
  const h = Math.max(420, container.clientHeight || 520);

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g");

  const zoom = d3.zoom().scaleExtent([0.5, 2.2]).on("zoom", ev => {
    g.attr("transform", ev.transform);
  });
  svg.call(zoom);

  const placementExtent = d3.extent(state.data.nodes, d => d.avgPlacement);
  const nodeColor = d3.scaleLinear()
    .domain([placementExtent[0], 4.5, placementExtent[1]])
    .range(["#22c55e", "#eab308", "#ef4444"])
    .clamp(true);

  const nodeSize = d3.scaleSqrt()
    .domain(d3.extent(state.data.nodes, d => d.pickRate))
    .range([8, 26]);

  const linkW = d3.scaleLinear()
    .domain(d3.extent(state.data.links, d => d.rate))
    .range([1.4, 6]);

  const link = g.append("g")
    .selectAll("line")
    .data(state.data.links)
    .join("line")
    .attr("stroke", "#5b6f95")
    .attr("stroke-opacity", d => d3.scaleLinear().domain([CO_OCCURRENCE_THRESHOLD, 20]).range([0.2, 0.85]).clamp(true)(d.rate))
    .attr("stroke-width", d => linkW(d.rate));

  const node = g.append("g")
    .selectAll("circle")
    .data(state.data.nodes)
    .join("circle")
    .attr("r", d => nodeSize(d.pickRate))
    .attr("fill", d => nodeColor(d.avgPlacement))
    .attr("stroke", "#dfe7f5")
    .attr("stroke-width", 0.8)
    .style("cursor", "pointer")
    .on("mouseenter", (ev, d) => showTooltip(ev, d))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (ev, d) => {
      ev.stopPropagation();
      state.selectedChampion = d.id;
      updateLinkedViews();
    })
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded));

  const label = g.append("g")
    .selectAll("text")
    .data(state.data.nodes)
    .join("text")
    .attr("class", "node-label")
    .text(d => d.id)
    .attr("dy", d => -(nodeSize(d.pickRate) + 6));

  const simulation = d3.forceSimulation(state.data.nodes)
    .force("link", d3.forceLink(state.data.links).id(d => d.id).distance(80).strength(0.35))
    .force("charge", d3.forceManyBody().strength(-180))
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force("collide", d3.forceCollide().radius(d => nodeSize(d.pickRate) + 4))
    .on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

  svg.on("click", () => {
    state.selectedChampion = null;
    updateLinkedViews();
  });

  state.network = {
    svg,
    node,
    link,
    label,
    simulation,
    nodeColor
  };

  updateLinkedViews();

  function dragStarted(ev, d) {
    if (!ev.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(ev, d) {
    d.fx = ev.x;
    d.fy = ev.y;
  }

  function dragEnded(ev, d) {
    if (!ev.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function buildTraitChart() {
  const container = document.getElementById("trait-view");
  const w = container.clientWidth || 420;
  const h = Math.max(250, container.clientHeight || 300);

  const margin = { top: 12, right: 12, bottom: 24, left: 130 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, innerW]);
  const y = d3.scaleBand().range([0, innerH]).padding(0.16);

  const color = d3.scaleOrdinal()
    .domain([0, 1, 2, 3])
    .range(["#99cee2", "#5ca9d1", "#2f7fb4", "#f39c12"]);

  const gx = g.append("g").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g");

  state.traitChart = { svg, g, x, y, color, gx, gy, innerH };
  renderTraitChart();
}

function renderTraitChart() {
  const chart = state.traitChart;
  let data;

  if (state.selectedChampion) {
    const traitMap = state.data.championTraitStyle.get(state.selectedChampion) || new Map();
    data = mapStyleMapToArray(traitMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  } else {
    data = state.data.traitGlobal;
  }

  const visible = data.length ? data : [{ key: "NoData", styles: [0, 0, 0, 0], total: 0 }];

  chart.x.domain([0, d3.max(visible, d => d.total) || 1]);
  chart.y.domain(visible.map(d => d.key));

  chart.gx
    .transition()
    .duration(350)
    .call(d3.axisBottom(chart.x).ticks(5))
    .call(g => g.selectAll("text").attr("fill", "#c8d3e8"))
    .call(g => g.selectAll("line,path").attr("stroke", "#4d607f"));

  chart.gy
    .transition()
    .duration(350)
    .call(d3.axisLeft(chart.y))
    .call(g => g.selectAll("text").attr("fill", "#dce4f3").style("font-size", "11px"))
    .call(g => g.selectAll("line,path").attr("stroke", "#4d607f"));

  const stacked = d3.stack().keys([0, 1, 2, 3]).value((d, key) => d.styles[key])(visible);

  const groups = chart.g.selectAll(".stack-layer").data(stacked, d => d.key);
  groups.join(
    enter => enter.append("g").attr("class", "stack-layer").attr("fill", d => chart.color(d.key)),
    update => update,
    exit => exit.remove()
  );

  chart.g.selectAll(".stack-layer")
    .selectAll("rect")
    .data(d => d.map(v => ({ ...v, key: d.key })), d => d.data.key)
    .join(
      enter => enter.append("rect")
        .attr("x", d => chart.x(d[0]))
        .attr("y", d => chart.y(d.data.key))
        .attr("height", chart.y.bandwidth())
        .attr("width", d => Math.max(0, chart.x(d[1]) - chart.x(d[0])))
        .attr("opacity", 0.9),
      update => update,
      exit => exit.remove()
    )
    .transition()
    .duration(400)
    .attr("x", d => chart.x(d[0]))
    .attr("y", d => chart.y(d.data.key))
    .attr("height", chart.y.bandwidth())
    .attr("width", d => Math.max(0, chart.x(d[1]) - chart.x(d[0])));
}

function renderDetailPanel() {
  const container = document.getElementById("detail-view");
  container.innerHTML = "";

  if (!state.selectedChampion) {
    const bestComp = META_COMPS.slice().sort((a, b) => a.avgPlacement - b.avgPlacement)[0];
    container.innerHTML = `
      <p class="muted">Click a champion node in the network to inspect its outcomes, items, and partner synergies.</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Boards</div><div class="stat-value">${state.data.totalBoards.toLocaleString()}</div></div>
        <div class="stat-card"><div class="stat-label">Matches</div><div class="stat-value">${state.data.matches.length.toLocaleString()}</div></div>
        <div class="stat-card"><div class="stat-label">Top Champions</div><div class="stat-value">${state.data.nodes.length}</div></div>
        <div class="stat-card"><div class="stat-label">Best Meta Comp</div><div class="stat-value">${bestComp.label.replace("Comp 5: ", "")}</div></div>
      </div>
      <p class="muted">Current finding: Swain is central in the network, but tight high-cost pairings outperform loose value boards.</p>
    `;
    return;
  }

  const champ = state.data.championById.get(state.selectedChampion);
  if (!champ) return;

  const partners = Array.from(state.data.pairCountGlobal.entries())
    .filter(([key]) => key.includes(`|${champ.id}`) || key.startsWith(`${champ.id}|`))
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      const other = a === champ.id ? b : a;
      return {
        name: other,
        count,
        rateWithChampion: (count / champ.pickCount) * 100
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const header = document.createElement("div");
  header.className = "detail-header";
  header.innerHTML = `
    <img src="${champIconUrl(champ.id)}" alt="${champ.id}" onerror="this.style.display='none'" />
    <div>
      <div style="font-size:1.1rem;font-weight:600">${champ.id}</div>
      <div class="muted">${champ.cost}-cost | Pick Rate ${fmtPct(champ.pickRate)} | Avg Place ${fmtFloat(champ.avgPlacement)}</div>
    </div>
  `;

  const stat = document.createElement("div");
  stat.className = "stat-grid";
  stat.innerHTML = `
    <div class="stat-card"><div class="stat-label">Top 4 Rate</div><div class="stat-value">${fmtPct(champ.top4Rate)}</div></div>
    <div class="stat-card"><div class="stat-label">Boards Played</div><div class="stat-value">${champ.pickCount}</div></div>
    <div class="stat-card"><div class="stat-label">Best Item</div><div class="stat-value">${champ.topItems[0] ? cleanItemName(champ.topItems[0].item) : "N/A"}</div></div>
    <div class="stat-card"><div class="stat-label">Strongest Partner</div><div class="stat-value">${partners[0] ? partners[0].name : "N/A"}</div></div>
  `;

  const placementBox = document.createElement("div");
  placementBox.innerHTML = `<h3 style="margin:0 0 4px 0;font-size:0.95rem">Placement Distribution</h3><div id="placement-hist"></div>`;

  const itemBox = document.createElement("div");
  itemBox.innerHTML = `<h3 style="margin:0 0 4px 0;font-size:0.95rem">Top Items</h3><div id="item-bars"></div>`;

  const partnerBox = document.createElement("div");
  partnerBox.innerHTML = "<h3 style='margin:0 0 4px 0;font-size:0.95rem'>Best Partners</h3>";
  const ul = document.createElement("ul");
  ul.className = "partner-list";
  partners.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${fmtPct(p.rateWithChampion)} co-play rate`;
    ul.appendChild(li);
  });
  partnerBox.appendChild(ul);

  container.appendChild(header);
  container.appendChild(stat);
  container.appendChild(placementBox);
  container.appendChild(itemBox);
  container.appendChild(partnerBox);

  drawPlacementHistogram("#placement-hist", champ.placementDist);
  drawTopItems("#item-bars", champ.topItems.slice(0, 5));
}

function drawPlacementHistogram(selector, values) {
  const w = 360;
  const h = 130;
  const margin = { top: 4, right: 8, bottom: 20, left: 26 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const data = values.map((v, i) => ({ place: i + 1, count: v }));

  const x = d3.scaleBand().domain(data.map(d => d.place)).range([0, innerW]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).nice().range([innerH, 0]);

  const svg = d3.select(selector).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", d => x(d.place))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => innerH - y(d.count))
    .attr("fill", "#1bb5a5");

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y).ticks(3));
}

function drawTopItems(selector, items) {
  const data = items.map(d => ({ label: cleanItemName(d.item), count: d.count }));
  const w = 360;
  const h = 148;
  const margin = { top: 4, right: 6, bottom: 8, left: 120 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).range([0, innerW]);
  const y = d3.scaleBand().domain(data.map(d => d.label)).range([0, innerH]).padding(0.15);

  const svg = d3.select(selector).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", 0)
    .attr("y", d => y(d.label))
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.count))
    .attr("fill", "#c8aa6e");

  g.append("g").call(d3.axisLeft(y).tickSize(0)).call(gx => gx.selectAll("text").style("font-size", "10px"));
  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(4));
}

function updateLinkedViews() {
  updateNetworkStyles();
  renderTraitChart();
  renderDetailPanel();
  writeCompDescription();
}

function updateNetworkStyles() {
  if (!state.network) return;

  const selectedComp = META_COMPS.find(c => c.id === state.selectedComp);
  const compSet = selectedComp ? new Set(selectedComp.champs) : null;
  const selected = state.selectedChampion;

  const connectedSet = new Set();
  if (selected) {
    connectedSet.add(selected);
    state.data.links.forEach(l => {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      if (s === selected) connectedSet.add(t);
      if (t === selected) connectedSet.add(s);
    });
  }

  state.network.node
    .attr("display", d => state.activeCosts.has(d.cost) ? null : "none")
    .attr("fill", d => state.network.nodeColor(d.avgPlacement))
    .attr("opacity", d => {
      if (!state.activeCosts.has(d.cost)) return 0;
      if (selected) return connectedSet.has(d.id) ? 1 : 0.18;
      if (compSet) return compSet.has(d.id) ? 1 : 0.45;
      return 0.95;
    })
    .attr("stroke-width", d => {
      if (selected && d.id === selected) return 2.2;
      if (compSet && compSet.has(d.id)) return 1.8;
      return 0.8;
    })
    .attr("stroke", d => {
      if (selected && d.id === selected) return "#f2d38f";
      if (compSet && compSet.has(d.id)) return "#f2d38f";
      return "#dfe7f5";
    });

  state.network.label
    .attr("display", d => state.activeCosts.has(d.cost) ? null : "none")
    .attr("opacity", d => {
      if (!state.activeCosts.has(d.cost)) return 0;
      if (selected) return connectedSet.has(d.id) ? 0.95 : 0.15;
      if (compSet) return compSet.has(d.id) ? 0.95 : 0.45;
      return 0.85;
    });

  state.network.link
    .attr("display", d => {
      const s = typeof d.source === "string" ? d.source : d.source.id;
      const t = typeof d.target === "string" ? d.target : d.target.id;
      const sourceNode = state.data.championById.get(s);
      const targetNode = state.data.championById.get(t);
      const allowed = sourceNode && targetNode && state.activeCosts.has(sourceNode.cost) && state.activeCosts.has(targetNode.cost);
      return allowed ? null : "none";
    })
    .attr("opacity", d => {
      const s = typeof d.source === "string" ? d.source : d.source.id;
      const t = typeof d.target === "string" ? d.target : d.target.id;
      if (selected) return s === selected || t === selected ? 0.9 : 0.08;
      if (compSet) return compSet.has(s) && compSet.has(t) ? 0.78 : 0.18;
      return 0.36;
    })
    .attr("stroke", d => {
      const s = typeof d.source === "string" ? d.source : d.source.id;
      const t = typeof d.target === "string" ? d.target : d.target.id;
      if (selected && (s === selected || t === selected)) return "#f3d08a";
      if (compSet && compSet.has(s) && compSet.has(t)) return "#f3d08a";
      return "#5b6f95";
    });

  const caption = document.getElementById("network-caption");
  if (selected) {
    caption.textContent = `Selected: ${selected}. Connected champions and linked details are highlighted.`;
  } else if (selectedComp) {
    caption.textContent = `${selectedComp.label} highlighted. Avg placement ${selectedComp.avgPlacement}, Top 4 ${selectedComp.top4}%.`;
  } else {
    caption.textContent = "Top 30 champions, edges show >= 5% co-occurrence.";
  }
}

function wireActions() {
  document.getElementById("reset-btn").addEventListener("click", () => {
    state.selectedChampion = null;
    state.selectedComp = "all";
    state.activeCosts = new Set(COST_TIERS);

    document.querySelectorAll("#cost-filters .chip").forEach(btn => btn.classList.add("active"));
    document.getElementById("comp-select").value = "all";

    updateLinkedViews();
  });
}

function writeCompDescription() {
  const p = document.getElementById("comp-description");
  const comp = META_COMPS.find(c => c.id === state.selectedComp);
  if (!comp) {
    p.textContent = "Highlight known meta shells in the network.";
    return;
  }
  p.textContent = `${comp.note} Avg placement ${comp.avgPlacement}, Top 4 rate ${comp.top4}%.`;
}

function showTooltip(ev, d) {
  const tooltip = document.getElementById("tooltip");
  const top3 = d.topItems.slice(0, 3).map(i => cleanItemName(i.item)).join(", ") || "No items";

  tooltip.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <img src="${champIconUrl(d.id)}" alt="${d.id}" width="24" height="24" style="border-radius:4px;border:1px solid #334155" onerror="this.style.display='none'" />
      <strong>${d.id}</strong>
    </div>
    <div>${d.cost}-cost | Pick rate: ${fmtPct(d.pickRate)}</div>
    <div>Avg placement: ${fmtFloat(d.avgPlacement)}</div>
    <div style="margin-top:3px">Top items: ${top3}</div>
  `;

  tooltip.classList.add("visible");
  moveTooltip(ev);
}

function moveTooltip(ev) {
  const tooltip = document.getElementById("tooltip");
  tooltip.style.left = `${ev.clientX + 14}px`;
  tooltip.style.top = `${ev.clientY + 14}px`;
}

function hideTooltip() {
  document.getElementById("tooltip").classList.remove("visible");
}

function parseItems(raw) {
  if (!raw || raw === "[]") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function cleanChampionName(raw) {
  return (raw || "")
    .replace(/^TFT16_/, "")
    .replace(/^TFT_/, "")
    .replace(/[^A-Za-z0-9]/g, "");
}

function cleanTraitName(raw) {
  return (raw || "").replace(/^TFT16_/, "").replace(/^TFT_/, "");
}

function cleanItemName(raw) {
  return (raw || "")
    .replace(/^TFT16_Item_/, "")
    .replace(/^TFT_Item_/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

function mapStyleMapToArray(styleMap) {
  return Array.from(styleMap.entries()).map(([key, styles]) => ({
    key,
    styles,
    total: styles.reduce((a, b) => a + b, 0)
  }));
}

function dominantCost(map) {
  if (!map || map.size === 0) return 1;
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function boardKey(matchId, puuid) {
  return `${matchId}|${puuid}`;
}

function fmtPct(v) {
  return `${d3.format(".1f")(v)}%`;
}

function fmtFloat(v) {
  return d3.format(".2f")(v);
}

function champIconUrl(champion) {
  return `https://ddragon.leagueoflegends.com/cdn/latest/img/tft-champion/TFT16_${champion}.png`;
}


