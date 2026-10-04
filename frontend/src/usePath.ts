import { useEffect } from "react";
import { fetchPath } from "./api";
import { useGalaxyStore } from "./store";

/** Keeps the store's `path` in sync with the requested ends and the collapsed packs. */
export function usePath(): void {
  const pathEnds = useGalaxyStore((s) => s.pathEnds);
  const collapsed = useGalaxyStore((s) => s.collapsed);
  const setPath = useGalaxyStore((s) => s.setPath);
  const setPathError = useGalaxyStore((s) => s.setPathError);

  // collapsing / expanding packs changes which orbs stand in for the path
  useEffect(() => {
    if (pathEnds === null) return;
    let cancelled = false;
    fetchPath(pathEnds.source, pathEnds.target, collapsed)
      .then((path) => {
        if (!cancelled) setPath(path);
      })
      .catch((err: Error) => {
        if (!cancelled) setPathError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [pathEnds, collapsed, setPath, setPathError]);
}
