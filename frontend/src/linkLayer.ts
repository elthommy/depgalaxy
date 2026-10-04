// Batched link rendering. react-force-graph draws every link as its own
// THREE.Line, i.e. one draw call per link; with 80k links that dominates
// the frame. Here links sharing a material are merged into one
// LineSegments, so a frame costs one draw call per material instead.
import * as THREE from "three";

interface Positioned {
  x?: number;
  y?: number;
  z?: number;
}

/** A link endpoint: a node id before react-force-graph resolves it, the node object after. */
type Endpoint = string | number | ({ id?: string | number } & Positioned) | undefined;

export interface LayerLink {
  source?: Endpoint;
  target?: Endpoint;
}

export interface LinkLayer {
  object: THREE.Group;
  /** Copy the current node positions into the segment buffers. */
  update: () => void;
  dispose: () => void;
}

function endpointId(end: Endpoint): string {
  return String(typeof end === "object" ? end.id : end);
}

interface Batch {
  segments: THREE.LineSegments;
  positions: Float32Array;
  ends: [Positioned, Positioned][];
}

function makeBatch(
  material: THREE.Material,
  links: LayerLink[],
  nodes: Map<string, Positioned>,
): Batch {
  const ends = links.map(
    (l) => [nodes.get(endpointId(l.source)) ?? {}, nodes.get(endpointId(l.target)) ?? {}] as [
      Positioned,
      Positioned,
    ],
  );
  const positions = new Float32Array(links.length * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const segments = new THREE.LineSegments(geometry, material);
  // the bounding sphere would go stale as nodes move: never cull
  segments.frustumCulled = false;
  return { segments, positions, ends };
}

function updateBatch({ segments, positions, ends }: Batch): void {
  ends.forEach(([a, b], i) => {
    positions.set([a.x ?? 0, a.y ?? 0, a.z ?? 0, b.x ?? 0, b.y ?? 0, b.z ?? 0], i * 6);
  });
  segments.geometry.attributes.position.needsUpdate = true;
  // dashed materials measure dashes along each segment
  if (segments.material instanceof THREE.LineDashedMaterial) segments.computeLineDistances();
}

/**
 * Merge `links` into one LineSegments per material returned by `materialFor`.
 * Endpoints are looked up by id in `nodes`, the objects react-force-graph
 * positions, so the layer works before and after the library resolves links.
 */
export function buildLinkLayer<L extends LayerLink>(
  links: L[],
  nodes: (Positioned & { id: string })[],
  materialFor: (link: L) => THREE.Material,
): LinkLayer {
  const byId = new Map(nodes.map((n) => [n.id, n as Positioned]));
  const groups = new Map<THREE.Material, L[]>();
  for (const link of links) {
    const material = materialFor(link);
    const group = groups.get(material);
    if (group) group.push(link);
    else groups.set(material, [link]);
  }
  const object = new THREE.Group();
  const batches = [...groups].map(([material, group]) => makeBatch(material, group, byId));
  batches.forEach((b) => object.add(b.segments));
  return {
    object,
    update: () => batches.forEach(updateBatch),
    // materials are shared with the caller: only the geometries belong to the layer
    dispose: () => batches.forEach((b) => b.segments.geometry.dispose()),
  };
}
