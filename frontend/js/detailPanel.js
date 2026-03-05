import { META_COMPS } from "./constants.js";
import { champIconUrl, itemIconUrl, itemDisplayName, augmentIconCandidates, augmentDisplayName, fmtPct, fmtFloat } from "./utils.js";

export class DetailPanel {
  constructor(containerId, model) {
    this.container = document.getElementById(containerId);
    this.model = model;
  }

  update(selectedChampion) {
    this.container.innerHTML = "";

    if (!selectedChampion) {
      const bestComp = META_COMPS.slice().sort((a, b) => a.avgPlacement - b.avgPlacement)[0];
      this.container.innerHTML = `
        <p class="muted">Click a champion node in the network to inspect outcomes, items, augment patterns, and partner synergies.</p>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">Boards</div><div class="stat-value">${this.model.totalBoards.toLocaleString()}</div></div>
          <div class="stat-card"><div class="stat-label">Matches</div><div class="stat-value">${this.model.matches.length.toLocaleString()}</div></div>
          <div class="stat-card"><div class="stat-label">Top Champions</div><div class="stat-value">${this.model.nodes.length}</div></div>
          <div class="stat-card"><div class="stat-label">Best Meta Comp</div><div class="stat-value">${bestComp.label.replace("Comp 5: ", "")}</div></div>
        </div>
        <p class="muted">Current finding: Swain is central in the network, but tight high-cost pairings outperform loose value boards.</p>
      `;
      return;
    }

    const champ = this.model.championById.get(selectedChampion);
    if (!champ) return;

    const partners = Array.from(this.model.pairCountGlobal.entries())
      .filter(([key]) => key.includes(`|${champ.id}`) || key.startsWith(`${champ.id}|`))
      .map(([key, count]) => {
        const [a, b] = key.split("|");
        const other = a === champ.id ? b : a;
        return { name: other, count, rateWithChampion: (count / champ.pickCount) * 100 };
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
      <div class="stat-card"><div class="stat-label">Best Item</div><div class="stat-value">${champ.topItems[0] ? itemDisplayName(champ.topItems[0].item) : "N/A"}</div></div>
      <div class="stat-card"><div class="stat-label">Strongest Partner</div><div class="stat-value">${partners[0] ? partners[0].name : "N/A"}</div></div>
    `;

    const placementBox = document.createElement("div");
    placementBox.innerHTML = `<h3 style="margin:0 0 4px 0;font-size:0.95rem">Placement Distribution</h3><div id="placement-hist"></div>`;

    const itemBox = document.createElement("div");
    itemBox.innerHTML = `<h3 style="margin:0 0 4px 0;font-size:0.95rem">Top Items</h3><div id="item-list"></div>`;

    const augmentBox = document.createElement("div");
    augmentBox.innerHTML = `<h3 style="margin:0 0 4px 0;font-size:0.95rem">Top Augments</h3><div id="augment-list"></div>`;

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

    this.container.appendChild(header);
    this.container.appendChild(stat);
    this.container.appendChild(placementBox);
    this.container.appendChild(itemBox);
    this.container.appendChild(augmentBox);
    this.container.appendChild(partnerBox);

    drawPlacementHistogram("#placement-hist", champ.placementDist);
    drawIconStatList("#item-list", champ.topItems.map(d => ({
      id: d.item,
      label: itemDisplayName(d.item),
      count: d.count,
      iconCandidates: [itemIconUrl(d.item)]
    })));
    drawIconStatList("#augment-list", (champ.topAugments || []).map(d => ({
      id: d.augment,
      label: augmentDisplayName(d.augment),
      count: d.count,
      iconCandidates: augmentIconCandidates(d.augment)
    })), "No augment data in current CSV.");
  }
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

  g.selectAll("rect").data(data).join("rect")
    .attr("x", d => x(d.place))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => innerH - y(d.count))
    .attr("fill", "#1bb5a5");

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y).ticks(3));
}

function drawIconStatList(selector, rows, emptyText = "No data available.") {
  const root = document.querySelector(selector);
  if (!root) return;

  root.innerHTML = "";
  const data = rows || [];
  if (!data.length) {
    root.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }

  const max = d3.max(data, d => d.count) || 1;
  const list = document.createElement("div");
  list.className = "icon-stat-list";

  data.forEach(row => {
    const item = document.createElement("div");
    item.className = "icon-stat-item";

    const left = document.createElement("div");
    left.className = "icon-stat-left";

    const img = createFallbackImage(row.iconCandidates || [], row.label);
    img.className = "icon-stat-img";

    const label = document.createElement("span");
    label.className = "icon-stat-label";
    label.textContent = row.label;

    left.appendChild(img);
    left.appendChild(label);

    const right = document.createElement("div");
    right.className = "icon-stat-right";

    const bar = document.createElement("div");
    bar.className = "icon-stat-bar";
    const fill = document.createElement("div");
    fill.className = "icon-stat-fill";
    fill.style.width = `${Math.max(4, (row.count / max) * 100)}%`;
    bar.appendChild(fill);

    const count = document.createElement("span");
    count.className = "icon-stat-count";
    count.textContent = String(row.count);

    right.appendChild(bar);
    right.appendChild(count);

    item.appendChild(left);
    item.appendChild(right);
    list.appendChild(item);
  });

  root.appendChild(list);
}

function createFallbackImage(candidates, alt) {
  const img = document.createElement("img");
  img.alt = alt;
  const queue = [...(candidates || [])].filter(Boolean);

  const tryNext = () => {
    const next = queue.shift();
    if (!next) {
      img.style.display = "none";
      return;
    }
    img.src = next;
  };

  img.addEventListener("error", tryNext);
  tryNext();
  return img;
}

