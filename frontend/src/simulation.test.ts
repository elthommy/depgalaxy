import { describe, expect, it } from "vitest";
import { LARGE_GRAPH_ELEMENTS, simulationSettings } from "./simulation";

describe("simulationSettings", () => {
  it("keeps the library defaults for small and medium graphs", () => {
    // demo galaxy (large): 5000 nodes / 6307 links
    expect(simulationSettings(5000, 6307)).toEqual({
      warmupTicks: 60,
      cooldownTime: 15_000,
      d3AlphaDecay: 0.0228,
      d3AlphaMin: 0,
    });
    expect(simulationSettings(LARGE_GRAPH_ELEMENTS, 0).warmupTicks).toBe(60);
  });

  it("skips the warmup and stops once settled on large graphs", () => {
    // Arch core + extra: 15311 nodes / 80393 links
    const large = simulationSettings(15311, 80393);
    expect(large.warmupTicks).toBe(0);
    // ticks until alpha drops below d3AlphaMin
    const ticks = Math.ceil(Math.log(large.d3AlphaMin) / Math.log(1 - large.d3AlphaDecay));
    expect(ticks).toBeGreaterThan(100);
    expect(ticks).toBeLessThan(150);
  });
});
