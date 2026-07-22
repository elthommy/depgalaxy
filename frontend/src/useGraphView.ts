import { useEffect } from "react";
import { fetchGraph } from "./api";
import { useGalaxyStore } from "./store";

/** Keeps the store's `view` in sync with the (collapsed, depth, root) parameters. */
export function useGraphView(): void {
  const collapsed = useGalaxyStore((s) => s.collapsed);
  const depth = useGalaxyStore((s) => s.depth);
  const root = useGalaxyStore((s) => s.root);
  const selectedId = useGalaxyStore((s) => s.selectedId);
  const graphEpoch = useGalaxyStore((s) => s.graphEpoch);
  const setView = useGalaxyStore((s) => s.setView);
  const setViewError = useGalaxyStore((s) => s.setViewError);

  // explicit isolation wins; otherwise a depth limit is rooted at the
  // selected node, falling back to a global top-level slice
  const effectiveRoot = root ?? (depth !== null ? selectedId : null);

  useEffect(() => {
    let cancelled = false;
    fetchGraph({ collapsed, depth, root: effectiveRoot })
      .then((view) => {
        if (!cancelled) setView(view);
      })
      .catch((err: Error) => {
        if (!cancelled) setViewError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [collapsed, depth, effectiveRoot, graphEpoch, setView, setViewError]);
}
