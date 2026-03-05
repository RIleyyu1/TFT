import { META_COMPS } from "./constants.js";
import { loadData, buildModel } from "./dataProcessor.js";
import { initAssetCatalog } from "./utils.js";
import { NetworkGraph } from "./networkGraph.js";
import { TraitChart } from "./traitChart.js";
import { DetailPanel } from "./detailPanel.js";

const state = {
  selectedChampion: null,
  selectedComp: "all",
  activeCosts: new Set(),
  model: null,
  network: null,
  traitChart: null,
  detailPanel: null
};

init();

async function init() {
  try {
    await initAssetCatalog();
    const raw = await loadData();
    state.model = buildModel(raw);
    state.activeCosts = new Set(state.model.availableCosts);

    setupControls();

    state.network = new NetworkGraph("network-view", state.model, champion => {
      state.selectedChampion = champion;
      updateViews();
    });
    state.traitChart = new TraitChart("trait-view", state.model);
    state.detailPanel = new DetailPanel("detail-view", state.model);

    wireActions();
    updateViews();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<p style="padding:24px;color:#fff">Failed to load data. Run this from a local server (for example: <code>python -m http.server</code>) and open <code>frontend/index.html</code>.</p>`;
  }
}

function setupControls() {
  const wrap = document.getElementById("cost-filters");
  wrap.innerHTML = "";

  state.model.availableCosts.forEach(cost => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip active";
    btn.textContent = `${cost}-cost`;
    btn.dataset.cost = String(cost);
    btn.addEventListener("click", () => {
      if (state.activeCosts.has(cost)) state.activeCosts.delete(cost);
      else state.activeCosts.add(cost);
      btn.classList.toggle("active", state.activeCosts.has(cost));
      updateViews();
    });
    wrap.appendChild(btn);
  });

  const select = document.getElementById("comp-select");
  select.innerHTML = "";
  [{ id: "all", label: "No composition highlight" }, ...META_COMPS].forEach(opt => {
    const el = document.createElement("option");
    el.value = opt.id;
    el.textContent = opt.label;
    select.appendChild(el);
  });

  select.addEventListener("change", () => {
    state.selectedComp = select.value;
    updateViews();
  });
}

function wireActions() {
  document.getElementById("reset-btn").addEventListener("click", () => {
    state.selectedChampion = null;
    state.selectedComp = "all";
    state.activeCosts = new Set(state.model.availableCosts);

    document.querySelectorAll("#cost-filters .chip").forEach(btn => btn.classList.add("active"));
    document.getElementById("comp-select").value = "all";

    updateViews();
  });
}

function updateViews() {
  state.network.update(state);
  state.traitChart.update(state.selectedChampion);
  state.detailPanel.update(state.selectedChampion);
  writeCaptions();
}

function writeCaptions() {
  const caption = document.getElementById("network-caption");
  const compDescription = document.getElementById("comp-description");

  const selectedComp = META_COMPS.find(c => c.id === state.selectedComp);

  if (state.selectedChampion) {
    caption.textContent = `Selected: ${state.selectedChampion}. Connected champions and linked details are highlighted.`;
  } else if (selectedComp) {
    caption.textContent = `${selectedComp.label} highlighted. Avg placement ${selectedComp.avgPlacement}, Top 4 ${selectedComp.top4}%.`;
  } else {
    caption.textContent = "Top 30 champions, edges show >= 5% co-occurrence.";
  }

  if (!selectedComp) {
    compDescription.textContent = "Highlight known meta shells in the network.";
  } else {
    compDescription.textContent = `${selectedComp.note} Avg placement ${selectedComp.avgPlacement}, Top 4 rate ${selectedComp.top4}%.`;
  }
}
