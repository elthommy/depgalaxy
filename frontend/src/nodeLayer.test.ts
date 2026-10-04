import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildNodeLayer, nodeRadius, pickProxy } from "./nodeLayer";

function nodes() {
  return [
    { id: "a", x: 1, y: 2, z: 3, val: 1, color: "#ff0000" },
    { id: "b", x: -4, y: 0, z: 8, val: 8, color: "#00ff00" },
  ];
}

function layerOf(ns = nodes()) {
  return buildNodeLayer(
    ns,
    (n) => nodeRadius(n.val),
    (n) => n.color,
  );
}

describe("nodeRadius", () => {
  it("matches react-force-graph: cube root of the value times 4", () => {
    expect(nodeRadius(1)).toBe(4);
    expect(nodeRadius(8)).toBe(8);
    expect(nodeRadius(0)).toBe(4);
  });
});

describe("buildNodeLayer", () => {
  it("draws one instance per node, never culled", () => {
    const layer = layerOf();
    expect(layer.object.count).toBe(2);
    expect(layer.object.frustumCulled).toBe(false);
  });

  it("places and sizes each instance from the node", () => {
    const layer = layerOf();
    layer.update();
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    layer.object.getMatrixAt(1, m);
    m.decompose(pos, new THREE.Quaternion(), scale);
    expect(pos.toArray()).toEqual([-4, 0, 8]);
    expect(scale.x).toBeCloseTo(8);
  });

  it("follows nodes as they move", () => {
    const ns = nodes();
    const layer = layerOf(ns);
    ns[0].x = 50;
    layer.update();
    const m = new THREE.Matrix4();
    layer.object.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBe(50);
    expect(layer.object.instanceMatrix.version).toBeGreaterThan(0);
  });

  it("tints each instance with the node color", () => {
    const layer = layerOf();
    const c = new THREE.Color();
    layer.object.getColorAt(1, c);
    expect(c.getHexString()).toBe("00ff00");
  });

  it("disposes its geometry and material", () => {
    const layer = layerOf();
    let disposed = 0;
    layer.object.geometry.addEventListener("dispose", () => disposed++);
    (layer.object.material as THREE.Material).addEventListener("dispose", () => disposed++);
    layer.dispose();
    expect(disposed).toBe(2);
  });
});

describe("pickProxy", () => {
  it("is a hit target of the node's size that is never drawn", () => {
    const proxy = pickProxy(8);
    proxy.updateMatrixWorld();
    expect((proxy.material as THREE.Material).visible).toBe(false);
    const down = new THREE.Vector3(0, 0, -1);
    const origin = new THREE.Vector3(0.3, 0.2, 50);
    const through = new THREE.Raycaster(origin, down).intersectObject(proxy);
    expect(through.length).toBeGreaterThan(0);
    // first surface hit about 50 - 8 away (facets sit slightly inside the radius)
    expect(through[0].distance).toBeGreaterThan(41.9);
    expect(through[0].distance).toBeLessThan(43);
    const beside = new THREE.Raycaster(new THREE.Vector3(9, 0, 50), down).intersectObject(proxy);
    expect(beside).toHaveLength(0);
  });
});
