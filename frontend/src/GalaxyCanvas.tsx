import { useCallback, useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import SpriteText from "three-spritetext";
import { DIM_NODE, LINK_STYLES, PATH_EDGE, kindColor } from "./palette";
import { type PathHighlight, edgeKey, pathHighlight } from "./pathHighlight";
import { useGalaxyStore } from "./store";
import type { GraphView, ViewEdge, ViewNode } from "./types";

const BACKGROUND = "#04050c";

interface NodeData extends ViewNode {
  fanIn: number;
  color: string;
}
export type GNode = NodeObject<NodeData>;
export type GLink = LinkObject<NodeData, ViewEdge>;
export type FGMethods = ForceGraphMethods<GNode, GLink>;

// One shared material per declared link_type (LINK_STYLES), plus a fallback.
const linkMaterials = new Map<string, THREE.Material>(
  Object.entries(LINK_STYLES).map(([type, style]) => [
    type,
    style.dashed
      ? new THREE.LineDashedMaterial({
          color: new THREE.Color(style.color),
          transparent: true,
          opacity: 0.6,
          dashSize: 2,
          gapSize: 1.5,
        })
      : new THREE.LineBasicMaterial({
          color: new THREE.Color(style.color),
          transparent: true,
          opacity: 0.45,
        }),
  ]),
);
const defaultLinkMaterial = new THREE.LineBasicMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.35,
});

const pathLinkMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color(PATH_EDGE),
  transparent: true,
  opacity: 0.95,
});
const dimLinkMaterial = new THREE.LineBasicMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.06,
});

function linkMaterial(link: GLink): THREE.Material {
  const type = link.attrs?.link_type;
  return (typeof type === "string" && linkMaterials.get(type)) || defaultLinkMaterial;
}

function isPathLink(link: GLink, highlight: PathHighlight): boolean {
  return highlight.edges.has(edgeKey(link.source, link.target));
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
function packObject(node: GNode, colorHex: string): THREE.Object3D {
  const radius = 5 + Math.sqrt(node.member_count);
  const color = new THREE.Color(colorHex);
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

// muted so the bloom pass doesn't turn labels into glare
const LABEL_COLOR = "#c7d2fe";

/** Name sprite shown above a node when the "Show names" toggle is on. */
function makeLabel(node: GNode): SpriteText {
  const label = new SpriteText(node.label, node.is_pack ? 4 : 3, LABEL_COLOR);
  label.material.depthWrite = false;
  // packs: clear their sphere (radius 5 + sqrt(members)); plain nodes: small offset
  label.position.y = node.is_pack ? 9 + Math.sqrt(node.member_count) : 4;
  return label;
}

/**
 * Fly the camera so every given node is in view, aimed at their center.
 * Uses the simulated node positions: zoomToFit measures the three.js
 * objects, which are stale right after a highlight change rebuilds them.
 */
function frameNodes(fg: FGMethods, nodes: GNode[]): void {
  const points = nodes
    .filter((n) => n.x !== undefined && n.y !== undefined && n.z !== undefined)
    .map((n) => new THREE.Vector3(n.x, n.y, n.z));
  if (points.length === 0) return;
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 40);
  const camera = fg.camera() as THREE.PerspectiveCamera;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1;
  const direction = camera.position.clone().sub(center).normalize();
  if (direction.lengthSq() === 0) direction.set(0, 0, 1);
  const position = center.clone().addScaledVector(direction, distance);
  fg.cameraPosition(
    { x: position.x, y: position.y, z: position.z },
    { x: center.x, y: center.y, z: center.z },
    1200,
  );
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

export default function GalaxyCanvas({
  fgRef,
}: {
  fgRef: React.MutableRefObject<FGMethods | undefined>;
}) {
  const view = useGalaxyStore((s) => s.view);
  const viewError = useGalaxyStore((s) => s.viewError);
  const focus = useGalaxyStore((s) => s.focus);
  const autoRotate = useGalaxyStore((s) => s.autoRotate);
  const togglePack = useGalaxyStore((s) => s.togglePack);
  const select = useGalaxyStore((s) => s.select);
  const showLabels = useGalaxyStore((s) => s.showLabels);
  const pathFrom = useGalaxyStore((s) => s.pathFrom);
  const pickPathTarget = useGalaxyStore((s) => s.pickPathTarget);
  const cancelPathPick = useGalaxyStore((s) => s.cancelPathPick);
  const path = useGalaxyStore((s) => s.path);
  const highlight = useMemo(() => pathHighlight(path), [path]);

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
  }, [fgRef]);

  // Slow galaxy rotation, toggled by the play/pause control.
  useEffect(() => {
    const controls = fgRef.current?.controls() as
      | { autoRotate: boolean; autoRotateSpeed: number }
      | undefined;
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;
  }, [fgRef, autoRotate]);

  const graphData = useMemo(() => (view ? toGraphData(view) : { nodes: [], links: [] }), [view]);

  // Fly the camera to a node picked from the search panel or a detail-panel row.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !focus) return;
    const node = graphData.nodes.find((n) => n.id === focus.id);
    if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return;
    const distance = 90;
    const len = Math.hypot(node.x, node.y, node.z) || 1;
    const ratio = 1 + distance / len;
    fg.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      { x: node.x, y: node.y, z: node.z },
      1200,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // while a path search is in progress, a click picks the destination
  // (packs included) instead of toggling or selecting
  const onNodeClick = useCallback(
    (node: GNode) => {
      if (pathFrom !== null) {
        if (node.id !== pathFrom) pickPathTarget(node.id);
      } else if (node.is_pack) togglePack(node.id);
      else select(node.id);
    },
    [pathFrom, pickPathTarget, togglePack, select],
  );

  // Frame the whole path once per search (not on refetches after a collapse).
  const framedPath = useRef<string | null>(null);
  useEffect(() => {
    const fg = fgRef.current;
    if (!path) framedPath.current = null;
    if (!fg || !path || !highlight) return;
    const key = edgeKey(path.source, path.target);
    if (framedPath.current === key) return;
    framedPath.current = key;
    frameNodes(fg, graphData.nodes.filter((n) => highlight.nodes.has(n.id)));
  }, [fgRef, path, highlight, graphData]);

  // while a path is shown, nodes off the path dim
  const nodeColor = useCallback(
    (node: GNode) => (highlight && !highlight.nodes.has(node.id) ? DIM_NODE : node.color),
    [highlight],
  );

  // new function identity on toggle makes react-force-graph rebuild node objects
  const nodeThreeObject = useCallback(
    (node: GNode) => {
      if (node.is_pack) {
        const obj = packObject(node, nodeColor(node));
        if (showLabels) obj.add(makeLabel(node));
        return obj;
      }
      // returning a falsy value means "use the default sphere"; the typings don't admit it
      return showLabels ? makeLabel(node) : (undefined as unknown as THREE.Object3D);
    },
    [showLabels, nodeColor],
  );

  const pathAwareLinkMaterial = useCallback(
    (link: GLink) => {
      if (!highlight) return linkMaterial(link);
      return isPathLink(link, highlight) ? pathLinkMaterial : dimLinkMaterial;
    },
    [highlight],
  );

  const linkParticles = useCallback(
    (link: GLink) => (highlight && isPathLink(link, highlight) ? 4 : 0),
    [highlight],
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, cursor: pathFrom !== null ? "crosshair" : undefined }}
    >
      <ForceGraph3D<NodeData, ViewEdge>
        ref={fgRef}
        graphData={graphData}
        backgroundColor={BACKGROUND}
        nodeLabel={(node) => `${node.label} · ${node.kind}${node.is_pack ? " (pack)" : ""}`}
        nodeColor={nodeColor}
        nodeVal={(node) => 1 + Math.min(node.fanIn, 50) * 0.8}
        nodeThreeObject={nodeThreeObject}
        // packs replace the default object; plain nodes keep their sphere under the label
        nodeThreeObjectExtend={(node) => !node.is_pack}
        nodeOpacity={0.85}
        linkMaterial={pathAwareLinkMaterial}
        linkWidth={0}
        // particles flow along path links in dependency direction
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={() => PATH_EDGE}
        onNodeClick={onNodeClick}
        onBackgroundClick={() => (pathFrom !== null ? cancelPathPick() : select(null))}
        warmupTicks={60}
      />
      {viewError && !view && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#7d8ec7",
            fontFamily: "'JetBrains Mono', monospace",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p>no galaxy loaded — {viewError}</p>
            <p>run `make seed` with the backend up, then reload</p>
          </div>
        </div>
      )}
    </div>
  );
}
