import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildLinkLayer } from "./linkLayer";

const solid = new THREE.LineBasicMaterial();
const dashed = new THREE.LineDashedMaterial();

function nodes() {
  return [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 1, y: 2, z: 3 },
    { id: "c", x: 4, y: 5, z: 6 },
  ];
}

function segments(layer: ReturnType<typeof buildLinkLayer>) {
  return layer.object.children as THREE.LineSegments[];
}

describe("buildLinkLayer", () => {
  it("merges links sharing a material into one LineSegments", () => {
    const links = [
      { source: "a", target: "b", kind: "solid" },
      { source: "b", target: "c", kind: "solid" },
      { source: "a", target: "c", kind: "dashed" },
    ];
    const layer = buildLinkLayer(links, nodes(), (l) => (l.kind === "solid" ? solid : dashed));
    expect(segments(layer).map((s) => s.material)).toEqual([solid, dashed]);
    expect(segments(layer).map((s) => s.geometry.attributes.position.count)).toEqual([4, 2]);
  });

  it("copies node positions into the segment buffer", () => {
    const links = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const layer = buildLinkLayer(links, nodes(), () => solid);
    layer.update();
    const positions = segments(layer)[0].geometry.attributes.position.array;
    expect([...positions]).toEqual([0, 0, 0, 1, 2, 3, 1, 2, 3, 4, 5, 6]);
  });

  it("follows nodes as they move, whether endpoints are ids or node objects", () => {
    const ns = nodes();
    // react-force-graph replaces ids with the node objects
    const layer = buildLinkLayer([{ source: ns[0], target: ns[2] }], ns, () => solid);
    ns[2].x = 40;
    layer.update();
    const geometry = segments(layer)[0].geometry;
    expect(geometry.attributes.position.array[3]).toBe(40);
    expect((geometry.attributes.position as THREE.BufferAttribute).version).toBeGreaterThan(0);
  });

  it("measures dashes for dashed materials only", () => {
    const links = [
      { source: "a", target: "b", kind: "dashed" },
      { source: "b", target: "c", kind: "solid" },
    ];
    const layer = buildLinkLayer(links, nodes(), (l) => (l.kind === "solid" ? solid : dashed));
    layer.update();
    const [dashedSegs, solidSegs] = segments(layer);
    expect(dashedSegs.geometry.attributes.lineDistance).toBeDefined();
    expect(solidSegs.geometry.attributes.lineDistance).toBeUndefined();
  });

  it("is never frustum-culled and disposes only its geometries", () => {
    const layer = buildLinkLayer([{ source: "a", target: "b" }], nodes(), () => solid);
    expect(segments(layer)[0].frustumCulled).toBe(false);
    let disposed = false;
    segments(layer)[0].geometry.addEventListener("dispose", () => (disposed = true));
    layer.dispose();
    expect(disposed).toBe(true);
  });

  it("draws an unknown endpoint at the origin instead of failing", () => {
    const layer = buildLinkLayer([{ source: "a", target: "gone" }], nodes(), () => solid);
    layer.update();
    expect([...segments(layer)[0].geometry.attributes.position.array]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
