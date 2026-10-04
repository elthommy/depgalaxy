// Force-layout tuning by graph size. The d3 simulation runs on the main
// thread, one tick per rendered frame. On big graphs (e.g. Arch core +
// extra, 15k nodes / 80k links) the synchronous warmup freezes the page,
// and with the library defaults (d3AlphaMin 0) the simulation keeps
// ticking until the 15 s cooldown even once the layout has settled.

/** Nodes + links above which a graph counts as large. */
export const LARGE_GRAPH_ELEMENTS = 20_000;

export interface SimulationSettings {
  warmupTicks: number;
  cooldownTime: number;
  d3AlphaDecay: number;
  d3AlphaMin: number;
}

// react-force-graph defaults
const DEFAULT: SimulationSettings = {
  warmupTicks: 60,
  cooldownTime: 15_000,
  d3AlphaDecay: 0.0228,
  d3AlphaMin: 0,
};

// no synchronous warmup (the galaxy settles on screen instead of freezing);
// stop once settled: alpha 1 -> 0.001 at decay 0.05 takes ~135 ticks,
// whatever the frame rate; the cooldown is only a safety net
const LARGE: SimulationSettings = {
  warmupTicks: 0,
  cooldownTime: 30_000,
  d3AlphaDecay: 0.05,
  d3AlphaMin: 0.001,
};

/** Simulation settings for a graph of the given size. */
export function simulationSettings(nodes: number, links: number): SimulationSettings {
  return nodes + links > LARGE_GRAPH_ELEMENTS ? LARGE : DEFAULT;
}
