// Batched node rendering. react-force-graph draws every node as its own
// mesh (one draw call each); with 15k nodes that dominates the frame once
// links are batched. Here plain nodes are drawn by a single InstancedMesh.
// The library keeps one invisible "pick proxy" per node, so hover labels,
// clicks and drags still work: raycasting ignores material visibility,
// rendering skips invisible materials.
import * as THREE from "three";

// react-force-graph defaults, so batched spheres match the library's
const NODE_REL_SIZE = 4;
const NODE_RESOLUTION = 8;
const NODE_OPACITY = 0.85;

interface LayerNode {
  x?: number;
  y?: number;
  z?: number;
}

export interface NodeLayer {
  object: THREE.InstancedMesh;
  /** Copy the current node positions into the instance matrices. */
  update: () => void;
  dispose: () => void;
}

/** Sphere radius for a node value, as react-force-graph computes it. */
export function nodeRadius(val: number): number {
  return Math.cbrt(Math.max(0, val) || 1) * NODE_REL_SIZE;
}

// same tessellation as the drawn spheres, so the hit target matches what is seen
const proxyGeometry = new THREE.SphereGeometry(1, NODE_RESOLUTION, NODE_RESOLUTION);
const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

/** Invisible sphere of the given radius: hit target only, never drawn. */
export function pickProxy(radius: number): THREE.Mesh {
  const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
  proxy.scale.setScalar(radius);
  return proxy;
}

/** One InstancedMesh drawing a sphere per node, sized by `radius`, tinted by `color`. */
export function buildNodeLayer<N extends LayerNode>(
  nodes: N[],
  radius: (node: N) => number,
  color: (node: N) => string,
): NodeLayer {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, NODE_RESOLUTION, NODE_RESOLUTION),
    new THREE.MeshLambertMaterial({ transparent: true, opacity: NODE_OPACITY }),
    nodes.length,
  );
  // instance bounds move with the layout: never cull
  mesh.frustumCulled = false;
  const tint = new THREE.Color();
  nodes.forEach((node, i) => mesh.setColorAt(i, tint.set(color(node))));
  const radii = nodes.map(radius);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  return {
    object: mesh,
    update: () => {
      nodes.forEach((node, i) => {
        position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
        mesh.setMatrixAt(i, matrix.compose(position, rotation, scale.setScalar(radii[i])));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
  };
}
