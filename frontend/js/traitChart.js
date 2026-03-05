import { mapStyleMapToArray } from "./utils.js";

export class TraitChart {
  constructor(containerId, model) {
    this.model = model;

    const container = document.getElementById(containerId);
    const w = container.clientWidth || 420;
    const h = Math.max(250, container.clientHeight || 300);

    const margin = { top: 12, right: 12, bottom: 24, left: 130 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    this.svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    this.g = this.svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    this.x = d3.scaleLinear().range([0, innerW]);
    this.y = d3.scaleBand().range([0, innerH]).padding(0.16);
    this.color = d3.scaleOrdinal().domain([0, 1, 2, 3]).range(["#99cee2", "#5ca9d1", "#2f7fb4", "#f39c12"]);

    this.gx = this.g.append("g").attr("transform", `translate(0,${innerH})`);
    this.gy = this.g.append("g");
  }

  update(selectedChampion) {
    let data;
    if (selectedChampion) {
      const traitMap = this.model.championTraitStyle.get(selectedChampion) || new Map();
      data = mapStyleMapToArray(traitMap).sort((a, b) => b.total - a.total).slice(0, 12);
    } else {
      data = this.model.traitGlobal;
    }

    const visible = data.length ? data : [{ key: "NoData", styles: [0, 0, 0, 0], total: 0 }];

    this.x.domain([0, d3.max(visible, d => d.total) || 1]);
    this.y.domain(visible.map(d => d.key));

    this.gx.transition().duration(350)
      .call(d3.axisBottom(this.x).ticks(5))
      .call(g => g.selectAll("text").attr("fill", "#c8d3e8"))
      .call(g => g.selectAll("line,path").attr("stroke", "#4d607f"));

    this.gy.transition().duration(350)
      .call(d3.axisLeft(this.y))
      .call(g => g.selectAll("text").attr("fill", "#dce4f3").style("font-size", "11px"))
      .call(g => g.selectAll("line,path").attr("stroke", "#4d607f"));

    const stacked = d3.stack().keys([0, 1, 2, 3]).value((d, key) => d.styles[key])(visible);

    const groups = this.g.selectAll(".stack-layer").data(stacked, d => d.key);
    groups.join(
      enter => enter.append("g").attr("class", "stack-layer").attr("fill", d => this.color(d.key)),
      update => update,
      exit => exit.remove()
    );

    this.g.selectAll(".stack-layer")
      .selectAll("rect")
      .data(d => d.map(v => ({ ...v, key: d.key })), d => d.data.key)
      .join(
        enter => enter.append("rect").attr("opacity", 0.9),
        update => update,
        exit => exit.remove()
      )
      .transition()
      .duration(400)
      .attr("x", d => this.x(d[0]))
      .attr("y", d => this.y(d.data.key))
      .attr("height", this.y.bandwidth())
      .attr("width", d => Math.max(0, this.x(d[1]) - this.x(d[0])));
  }
}
