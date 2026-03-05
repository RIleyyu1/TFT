import { CO_OCCURRENCE_THRESHOLD, META_COMPS } from "./constants.js";
import { champIconUrl, cleanItemName, fmtFloat, fmtPct, showTooltip, moveTooltip, hideTooltip } from "./utils.js";

export class NetworkGraph {
  constructor(containerId, model, onSelectChampion) {
    this.model = model;
    this.onSelectChampion = onSelectChampion;

    const container = document.getElementById(containerId);
    const w = container.clientWidth || 900;
    const h = Math.max(420, container.clientHeight || 520);

    this.svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    this.g = this.svg.append("g");
    this.defs = this.svg.append("defs");

    this.svg.call(d3.zoom().scaleExtent([0.5, 2.2]).on("zoom", ev => this.g.attr("transform", ev.transform)));

    const placementExtent = d3.extent(model.nodes, d => d.avgPlacement);
    this.nodeColor = d3.scaleLinear().domain([placementExtent[0], 4.5, placementExtent[1]]).range(["#22c55e", "#eab308", "#ef4444"]).clamp(true);
    const nodeSize = d3.scaleSqrt().domain(d3.extent(model.nodes, d => d.pickRate)).range([8, 26]);
    this.nodeRadius = d => nodeSize(d.pickRate);

    const linkW = d3.scaleLinear().domain(d3.extent(model.links, d => d.rate)).range([1.4, 6]);

    this.link = this.g.append("g").selectAll("line").data(model.links).join("line")
      .attr("stroke", "#5b6f95")
      .attr("stroke-opacity", d => d3.scaleLinear().domain([CO_OCCURRENCE_THRESHOLD, 20]).range([0.2, 0.85]).clamp(true)(d.rate))
      .attr("stroke-width", d => linkW(d.rate));

    const clipPrefix = `avatar-clip-${Math.floor(Math.random() * 1e9)}-`;
    this.nodeClip = this.defs.selectAll("clipPath")
      .data(model.nodes)
      .join("clipPath")
      .attr("id", (_, i) => `${clipPrefix}${i}`);

    this.nodeClip.append("circle")
      .attr("r", d => Math.max(2, this.nodeRadius(d) - 1));

    this.nodeAvatar = this.g.append("g")
      .selectAll("image")
      .data(model.nodes)
      .join("image")
      .attr("href", d => champIconUrl(d.id))
      .attr("class", "node-avatar")
      .attr("preserveAspectRatio", "xMidYMid slice")
      .style("pointer-events", "none")
      .attr("clip-path", (_, i) => `url(#${clipPrefix}${i})`)
      .attr("width", d => Math.max(4, 2 * this.nodeRadius(d)))
      .attr("height", d => Math.max(4, 2 * this.nodeRadius(d)));

    this.node = this.g.append("g").selectAll("circle").data(model.nodes).join("circle")
      .attr("r", d => this.nodeRadius(d))
      .attr("fill", d => this.nodeColor(d.avgPlacement))
      .attr("fill-opacity", 0.32)
      .attr("stroke", "#dfe7f5")
      .attr("stroke-width", 1.4)
      .style("cursor", "pointer")
      .on("mouseenter", (ev, d) => {
        const top3 = d.topItems.slice(0, 3).map(i => cleanItemName(i.item)).join(", ") || "No items";
        showTooltip(ev, `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <img src="${champIconUrl(d.id)}" alt="${d.id}" width="24" height="24" style="border-radius:4px;border:1px solid #334155" onerror="this.style.display='none'" />
            <strong>${d.id}</strong>
          </div>
          <div>${d.cost}-cost | Pick rate: ${fmtPct(d.pickRate)}</div>
          <div>Avg placement: ${fmtFloat(d.avgPlacement)}</div>
          <div style="margin-top:3px">Top items: ${top3}</div>
        `);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip)
      .on("click", (ev, d) => {
        ev.stopPropagation();
        this.onSelectChampion(d.id);
      })
      .call(d3.drag()
        .on("start", (ev, d) => {
          if (!ev.active) this.sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (ev, d) => {
          d.fx = ev.x;
          d.fy = ev.y;
        })
        .on("end", (ev, d) => {
          if (!ev.active) this.sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    this.label = this.g.append("g").selectAll("text").data(model.nodes).join("text")
      .attr("class", "node-label")
      .text(d => d.id)
      .attr("dy", d => -(this.nodeRadius(d) + 6));

    this.sim = d3.forceSimulation(model.nodes)
      .force("link", d3.forceLink(model.links).id(d => d.id).distance(80).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide().radius(d => this.nodeRadius(d) + 4))
      .on("tick", () => {
        this.link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        this.node.attr("cx", d => d.x).attr("cy", d => d.y);
        this.nodeClip.select("circle").attr("cx", d => d.x).attr("cy", d => d.y);
        this.nodeAvatar
          .attr("x", d => d.x - this.nodeRadius(d))
          .attr("y", d => d.y - this.nodeRadius(d));
        this.label.attr("x", d => d.x).attr("y", d => d.y);
      });

    this.svg.on("click", () => this.onSelectChampion(null));
  }

  update({ selectedChampion, selectedComp, activeCosts }) {
    const selectedCompData = META_COMPS.find(c => c.id === selectedComp);
    const compSet = selectedCompData ? new Set(selectedCompData.champs) : null;

    const connectedSet = new Set();
    if (selectedChampion) {
      connectedSet.add(selectedChampion);
      this.model.links.forEach(l => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        if (s === selectedChampion) connectedSet.add(t);
        if (t === selectedChampion) connectedSet.add(s);
      });
    }

    const opacityFor = d => {
      if (!activeCosts.has(d.cost)) return 0;
      if (selectedChampion) return connectedSet.has(d.id) ? 1 : 0.18;
      if (compSet) return compSet.has(d.id) ? 1 : 0.45;
      return 0.95;
    };

    this.node
      .attr("display", d => activeCosts.has(d.cost) ? null : "none")
      .attr("fill", d => this.nodeColor(d.avgPlacement))
      .attr("opacity", d => opacityFor(d))
      .attr("stroke-width", d => {
        if (selectedChampion && d.id === selectedChampion) return 2.4;
        if (compSet && compSet.has(d.id)) return 2;
        return 1.4;
      })
      .attr("stroke", d => {
        if (selectedChampion && d.id === selectedChampion) return "#f2d38f";
        if (compSet && compSet.has(d.id)) return "#f2d38f";
        return "#dfe7f5";
      });

    this.nodeAvatar
      .attr("display", d => activeCosts.has(d.cost) ? null : "none")
      .attr("opacity", d => opacityFor(d));

    this.label
      .attr("display", d => activeCosts.has(d.cost) ? null : "none")
      .attr("opacity", d => {
        if (!activeCosts.has(d.cost)) return 0;
        if (selectedChampion) return connectedSet.has(d.id) ? 0.95 : 0.15;
        if (compSet) return compSet.has(d.id) ? 0.95 : 0.45;
        return 0.85;
      });

    this.link
      .attr("display", d => {
        const s = typeof d.source === "string" ? d.source : d.source.id;
        const t = typeof d.target === "string" ? d.target : d.target.id;
        const sourceNode = this.model.championById.get(s);
        const targetNode = this.model.championById.get(t);
        const allowed = sourceNode && targetNode && activeCosts.has(sourceNode.cost) && activeCosts.has(targetNode.cost);
        return allowed ? null : "none";
      })
      .attr("opacity", d => {
        const s = typeof d.source === "string" ? d.source : d.source.id;
        const t = typeof d.target === "string" ? d.target : d.target.id;
        if (selectedChampion) return s === selectedChampion || t === selectedChampion ? 0.9 : 0.08;
        if (compSet) return compSet.has(s) && compSet.has(t) ? 0.78 : 0.18;
        return 0.36;
      })
      .attr("stroke", d => {
        const s = typeof d.source === "string" ? d.source : d.source.id;
        const t = typeof d.target === "string" ? d.target : d.target.id;
        if (selectedChampion && (s === selectedChampion || t === selectedChampion)) return "#f3d08a";
        if (compSet && compSet.has(s) && compSet.has(t)) return "#f3d08a";
        return "#5b6f95";
      });
  }
}
