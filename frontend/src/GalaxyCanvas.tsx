import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { fetchGraph } from "./api";
import { useGalaxyStore } from "./store";
import type { GraphView, ViewEdge, ViewNode } from "./types";

const BACKGROUND = "#04050c";

const KIND_COLORS: Record<string, string> = {
  library: "#60a5fa",
  package: "#c084fc",
  service: "#f472b6",
  tool: "#34d399",
  binary: "#fbbf24",
};
const FALLBACK_COLORS = ["#93c5fd", "#a5b4fc", "#f9a8d4", "#86efac", "#fcd34d", "#67e8f9"];

function kindColor(kind: string): string {
  const known = KIND_COLORS[kind];
  if (known) return known;
  let hash = 0;
  for (const ch of kind) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

interface NodeData extends ViewNode {
  fanIn: number;
  color: string;
}
type GNode = NodeObject<NodeData>;
type GLink = LinkObject<NodeData, ViewEdge>;
type FGMethods = ForceGraphMethods<GNode, GLink>;

// Shared link materials: dynamic = solid cyan, static = dashed amber.
const dynamicLinkMaterial = new THREE.LineBasicMaterial({
  color: 0x22d3ee,
  transparent: true,
  opacity: 0.45,
});
const staticLinkMaterial = new THREE.LineDashedMaterial({
  color: 0xfbbf24,
  transparent: true,
  opacity: 0.6,
  dashSize: 2,
  gapSize: 1.5,
});
const defaultLinkMaterial = new THREE.LineBasicMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.35,
});

function linkMaterial(link: GLink): THREE.Material {
  switch (link.attrs?.link_type) {
    case "dynamic":
      return dynamicLinkMaterial;
    case "static":
      return staticLinkMaterial;
    default:
      return defaultLinkMaterial;
  }
}

/** Radial-gradient sprite texture used for pack glow halos. */
function makeHaloTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  grad.addColorStop(0.25, "rgba(255, 255, 255, 0.35)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const haloTexture = makeHaloTexture();

/** Packs render as a glowing sphere + additive halo sprite; larger than plain nodes. */
function packObject(node: GNode): THREE.Object3D {
  const radius = 5 + Math.sqrt(node.member_count);
  const color = new THREE.Color(node.color);
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(radius * 5);
  group.add(sphere);
  group.add(halo);
  return group;
}

function toGraphData(view: GraphView): { nodes: GNode[]; links: GLink[] } {
  const fanIn = new Map<string, number>();
  for (const edge of view.edges) {
    fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + edge.weight);
  }
  const nodes = view.nodes.map((n) => ({
    ...n,
    fanIn: fanIn.get(n.id) ?? 0,
    color: kindColor(n.kind),
  }));
  return { nodes, links: view.edges.map((e) => ({ ...e })) };
}

export default function GalaxyCanvas() {
  const fgRef = useRef<FGMethods | undefined>(undefined);
  const [view, setView] = useState<GraphView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collapsed = useGalaxyStore((s) => s.collapsed);
  const depth = useGalaxyStore((s) => s.depth);
  const root = useGalaxyStore((s) => s.root);
  const togglePack = useGalaxyStore((s) => s.togglePack);
  const select = useGalaxyStore((s) => s.select);

  useEffect(() => {
    let cancelled = false;
    fetchGraph({ collapsed, depth, root })
      .then((v) => {
        if (cancelled) return;
        setView(v);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [collapsed, depth, root]);

  // Bloom pass over the whole scene.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,
      0.6,
      0.08,
    );
    fg.postProcessingComposer().addPass(bloom);
    return () => {
      fg.postProcessingComposer().removePass(bloom);
    };
  }, []);

  const graphData = useMemo(() => (view ? toGraphData(view) : { nodes: [], links: [] }), [view]);

  const onNodeClick = useCallback(
    (node: GNode) => {
      if (node.is_pack) togglePack(node.id);
      else select(node.id);
    },
    [togglePack, select],
  );

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <ForceGraph3D<NodeData, ViewEdge>
        ref={fgRef}
        graphData={graphData}
        backgroundColor={BACKGROUND}
        nodeLabel={(node) => `${node.label} · ${node.kind}${node.is_pack ? " (pack)" : ""}`}
        nodeColor={(node) => node.color}
        nodeVal={(node) => 1 + Math.min(node.fanIn, 50) * 0.8}
        // returning a falsy value means "use the default sphere"; the typings don't admit it
        nodeThreeObject={(node) =>
          node.is_pack ? packObject(node) : (undefined as unknown as THREE.Object3D)
        }
        nodeOpacity={0.85}
        linkMaterial={linkMaterial}
        linkWidth={0}
        onNodeClick={onNodeClick}
        onBackgroundClick={() => select(null)}
        warmupTicks={60}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#7d8ec7",
            fontFamily: "monospace",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p>no galaxy loaded — {error}</p>
            <p>run `make seed` with the backend up, then reload</p>
          </div>
        </div>
      )}
    </div>
  );
}
